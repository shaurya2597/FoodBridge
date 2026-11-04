import { randomBytes } from 'node:crypto';
import { Payment } from '@prisma/client';
import { demoPaymentsAllowed, env, razorpayEnabled } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../middleware/auth';
import { emitOrderEvent } from '../sockets/orderEvents';
import { verifyPaymentSignature } from './rules/razorpaySignature';
import { toPaise } from './rules/pricing';
import { createRazorpayOrder } from './razorpayClient';

const demoId = (prefix: string) => `demo_${prefix}_${randomBytes(8).toString('hex')}`;

/** Only the customer who placed the order may touch its payment. Others get 404. */
async function loadOwnOrderWithPayment(user: AuthUser, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { payment: true, restaurant: { select: { ownerId: true } } },
  });
  if (!order || !order.payment) throw new AppError(404, 'Order not found');
  return { order, payment: order.payment };
}

const publicPayment = (p: Payment) => ({
  id: p.id, method: p.method, status: p.status, amount: Number(p.amount), isDemo: p.isDemo, paidAt: p.paidAt, note: p.note,
});

function announce(order: { id: string; orderNumber: string; status: string; userId: string; restaurant: { ownerId: string } }, p: Payment) {
  emitOrderEvent('order:payment', {
    orderId: order.id, orderNumber: order.orderNumber, status: order.status, paymentStatus: p.status, at: new Date().toISOString(),
  }, { customerId: order.userId, ownerId: order.restaurant.ownerId, orderId: order.id });
}

/** Step 1 of an online payment: create (or reuse) the provider order for the amount stored on OUR order. */
export async function createPayment(user: AuthUser, orderId: string) {
  const { order, payment } = await loadOwnOrderWithPayment(user, orderId);
  if (payment.method === 'COD') throw new AppError(400, 'Cash on Delivery orders need no online payment');
  if (order.status !== 'PLACED') throw new AppError(409, `Payment is not possible for an order that is ${order.status.toLowerCase().replace(/_/g, ' ')}`);
  if (payment.status === 'PAID') throw new AppError(409, 'This order is already paid');

  const isDemo = !razorpayEnabled;
  if (isDemo && !demoPaymentsAllowed) throw new AppError(503, 'Online payments are not configured on this server');

  // Retrying after a failure creates a fresh provider order; a pending one is reused (idempotent).
  let providerRef = payment.status === 'PENDING' ? payment.providerRef : null;
  if (!providerRef) {
    providerRef = isDemo
      ? demoId(payment.method === 'UPI' ? 'upi' : 'order')
      : (await createRazorpayOrder({ amountPaise: toPaise(payment.amount), receipt: order.orderNumber })).id;
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef, providerPaymentId: null, isDemo, status: 'PENDING', note: null },
    });
  }

  const amountPaise = toPaise(payment.amount);
  return {
    mode: isDemo ? 'demo' : 'razorpay_test',
    notice: isDemo ? 'DEMO MODE: no real money is charged and no payment provider is contacted.' : 'Razorpay TEST mode: use test cards/UPI only.',
    method: payment.method,
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: amountPaise / 100,
    currency: 'INR',
    razorpay: isDemo ? null : { keyId: env.RAZORPAY_KEY_ID, razorpayOrderId: providerRef },
    // A real UPI app link is only meaningful with a live PSP, so UPI here is a labelled demo.
    demoUpi: isDemo && payment.method === 'UPI'
      ? { intent: `upi://pay?pa=foodbridge@demo&pn=FoodBridge&am=${(amountPaise / 100).toFixed(2)}&cu=INR&tn=${order.orderNumber}`, note: 'Demo VPA, not a real account' }
      : null,
  };
}

type VerifyInput =
  | { provider: 'razorpay'; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  | { provider: 'demo'; outcome: 'success' | 'failure' };

/** Step 2: the ONLY way an online payment becomes PAID. The browser's word is never enough. */
export async function verifyPayment(user: AuthUser, orderId: string, input: VerifyInput) {
  const { order, payment } = await loadOwnOrderWithPayment(user, orderId);
  if (payment.status === 'PAID') return { payment: publicPayment(payment), alreadyPaid: true }; // idempotent
  if (order.status === 'CANCELLED') throw new AppError(409, 'This order was cancelled');
  if (!payment.providerRef) throw new AppError(409, 'Start the payment first');

  let paidWith: string | null = null;
  let failure: string | null = null;

  if (input.provider === 'razorpay') {
    if (payment.isDemo || !razorpayEnabled) throw new AppError(400, 'This order is using demo payments');
    if (input.razorpay_order_id !== payment.providerRef) throw new AppError(400, 'Payment does not belong to this order');
    const valid = verifyPaymentSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature, env.RAZORPAY_KEY_SECRET!);
    if (!valid) {
      console.warn(`Invalid Razorpay signature for order ${order.orderNumber}`);
      throw new AppError(400, 'Payment verification failed');
    }
    paidWith = input.razorpay_payment_id;
  } else {
    if (!payment.isDemo || !demoPaymentsAllowed) throw new AppError(400, 'Demo payments are not enabled for this order');
    if (input.outcome === 'success') paidWith = demoId('pay');
    else failure = 'Demo payment failed';
  }

  // Conditional update: only PENDING/FAILED payments can move, so a replayed request cannot double-apply.
  const moved = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
    data: paidWith
      ? { status: 'PAID', providerPaymentId: paidWith, paidAt: new Date(), note: payment.isDemo ? 'Demo payment: no real money moved' : null }
      : { status: 'FAILED', note: failure },
  });
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  if (moved.count === 1) announce(order, fresh);
  return { payment: publicPayment(fresh), alreadyPaid: false };
}

/** The customer closed the checkout window or the provider reported a failure. Never downgrades a PAID payment. */
export async function reportPaymentFailed(user: AuthUser, orderId: string, reason: 'FAILED' | 'CANCELLED_BY_USER', description?: string) {
  const { order, payment } = await loadOwnOrderWithPayment(user, orderId);
  if (payment.method === 'COD') throw new AppError(400, 'Cash on Delivery orders have no online payment');
  const note = reason === 'CANCELLED_BY_USER' ? 'Payment cancelled by customer' : (description ? `Payment failed: ${description}` : 'Payment failed');
  const moved = await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', note } });
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  if (moved.count === 1) announce(order, fresh);
  return { payment: publicPayment(fresh), canRetry: order.status === 'PLACED' };
}
