import { randomBytes } from 'node:crypto';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { getPagination, pageMeta } from '../utils/pagination';
import { AuthUser } from '../middleware/auth';
import { emitOrderEvent } from '../sockets/orderEvents';
import { actorForRole, canAccessOrder } from './rules/orderAccess';
import { ACTIVE_STATUSES, OrderStatus, checkTransition } from './rules/orderStateMachine';
import { toRupees } from './rules/pricing';
import { assertCheckoutReady, quoteCart } from './cartPricing';

export const ORDER_INCLUDE = {
  items: true,
  payment: { select: { id: true, method: true, status: true, amount: true, isDemo: true, paidAt: true, note: true } },
  restaurant: { select: { id: true, name: true, imageUrl: true, address: true, city: true, ownerId: true, deliveryTime: true } },
  coupon: { select: { code: true, description: true } },
} satisfies Prisma.OrderInclude;
type OrderWithRels = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

interface HistoryEntry { status: string; at: string; by: string; note?: string }

/** API representation: numbers in rupees, owner id never exposed to customers. */
export function toOrderResponse(o: OrderWithRels) {
  const { restaurant: { ownerId: _owner, ...restaurant }, ...rest } = o;
  return {
    ...rest,
    restaurant,
    subtotal: Number(o.subtotal), deliveryFee: Number(o.deliveryFee), tax: Number(o.tax),
    platformFee: Number(o.platformFee), discount: Number(o.discount), total: Number(o.total),
    items: o.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), lineTotal: Number(i.unitPrice) * i.quantity })),
    payment: o.payment && { ...o.payment, amount: Number(o.payment.amount) },
  };
}

const newOrderNumber = () => {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join('');
  return `FB-${ymd}-${rand}`;
};

async function resolveAddress(userId: string, input: { addressId?: string; address?: any; saveAddress?: boolean }) {
  if (input.addressId) {
    const a = await prisma.address.findFirst({ where: { id: input.addressId, userId } }); // must be YOUR address
    if (!a) throw new AppError(400, 'Delivery address not found');
    return { addressId: a.id, city: a.city, text: [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', '), save: false as const, data: null };
  }
  const a = input.address;
  return {
    addressId: null as string | null, city: a.city as string,
    text: [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', '),
    save: Boolean(input.saveAddress), data: a,
  };
}

export async function placeOrder(user: AuthUser, input: {
  addressId?: string; address?: any; saveAddress: boolean; contactName: string; contactPhone: string;
  instructions?: string; couponCode?: string; paymentMethod: 'COD' | 'UPI' | 'RAZORPAY';
}) {
  const address = await resolveAddress(user.id, input);

  let orderId: string | undefined;
  for (let attempt = 0; attempt < 3 && !orderId; attempt++) {
    try {
      orderId = await prisma.$transaction(async (tx) => {
        const now = new Date();
        // Everything below is priced from the database inside this transaction.
        const q = await quoteCart(tx, user.id, input.couponCode, now);
        assertCheckoutReady(q);
        if (q.coupon && !q.coupon.applied) throw new AppError(400, q.coupon.error!.message, { code: `COUPON_${q.coupon.error!.code}` });
        const restaurant = q.restaurant!;
        if (restaurant.city.trim().toLowerCase() !== address.city.trim().toLowerCase())
          throw new AppError(400, `${restaurant.name} delivers only within ${restaurant.city}`, { code: 'OUT_OF_DELIVERY_AREA' });

        // Claim the cart rows. A concurrent duplicate submit blocks here, then finds 0 rows and fails,
        // so one cart can never become two orders.
        const claimed = await tx.cartItem.deleteMany({ where: { cartId: q.cart!.id } });
        if (claimed.count !== q.cart!.items.length) throw new AppError(409, 'Your cart changed while ordering. Please review it and try again.');
        await tx.cart.update({ where: { id: q.cart!.id }, data: { restaurantId: null } });

        let couponId: string | null = null;
        if (q.coupon?.applied) {
          const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: q.coupon.id! } });
          // Atomic guard: increments only while the global limit still has room.
          const bumped = await tx.coupon.updateMany({
            where: { id: coupon.id, isActive: true, ...(coupon.usageLimit !== null && { usedCount: { lt: coupon.usageLimit } }) },
            data: { usedCount: { increment: 1 } },
          });
          if (bumped.count !== 1) throw new AppError(400, 'This coupon has reached its usage limit', { code: 'COUPON_EXHAUSTED' });
          couponId = coupon.id;
        }

        let addressId = address.addressId;
        if (address.save && address.data) {
          const { label, line1, line2, city, state, pincode } = address.data;
          const saved = await tx.address.create({ data: { userId: user.id, label, line1, line2, city, state, pincode } });
          addressId = saved.id;
        }

        const b = q.breakdown;
        const history: HistoryEntry[] = [{ status: 'PLACED', at: now.toISOString(), by: 'CUSTOMER' }];
        const order = await tx.order.create({
          data: {
            orderNumber: newOrderNumber(), userId: user.id, restaurantId: restaurant.id, addressId,
            deliveryAddress: address.text, contactName: input.contactName, contactPhone: input.contactPhone,
            instructions: input.instructions || null, status: 'PLACED',
            subtotal: toRupees(b.subtotalPaise), deliveryFee: toRupees(b.deliveryFeePaise), tax: toRupees(b.taxPaise),
            platformFee: toRupees(b.platformFeePaise), discount: toRupees(b.discountPaise), total: toRupees(b.totalPaise),
            couponId, estimatedAt: new Date(now.getTime() + restaurant.deliveryTime * 60_000),
            statusHistory: history as unknown as Prisma.InputJsonValue,
            items: {
              create: q.lines.map((l) => ({
                foodItemId: l.foodItemId, name: l.name, unitPrice: toRupees(l.unitPricePaise), quantity: l.quantity,
                customization: l.selections.length ? (l.selections as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
                instructions: l.instructions,
              })),
            },
            payment: { create: { method: input.paymentMethod, status: 'PENDING', amount: toRupees(b.totalPaise) } },
          },
        });
        return order.id;
      }, { timeout: 15_000 });
    } catch (e) {
      const dup = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target).includes('orderNumber');
      if (!dup) throw e; // retry only on an order-number collision
    }
  }
  if (!orderId) throw new AppError(500, 'Could not generate an order number, please retry');

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
  emitOrderEvent('order:placed', {
    orderId: order.id, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.payment?.status,
    estimatedAt: order.estimatedAt.toISOString(), at: new Date().toISOString(),
  }, { customerId: order.userId, ownerId: order.restaurant.ownerId, orderId: order.id });
  return toOrderResponse(order);
}

function visibilityWhere(user: AuthUser): Prisma.OrderWhereInput {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'RESTAURANT_OWNER') return { restaurant: { ownerId: user.id } };
  if (user.role === 'CUSTOMER') return { userId: user.id };
  return { id: { in: [] } }; // other roles see nothing
}

export async function listOrders(user: AuthUser, query: { status?: OrderStatus; active?: string; restaurantId?: string; page?: unknown; limit?: unknown }) {
  const { page, limit, skip, take } = getPagination(query);
  const where: Prisma.OrderWhereInput = { ...visibilityWhere(user) };
  if (query.status) where.status = query.status;
  else if (query.active === 'true') where.status = { in: ACTIVE_STATUSES };
  else if (query.active === 'false') where.status = { in: ['DELIVERED', 'CANCELLED'] };
  if (query.restaurantId && user.role !== 'CUSTOMER') where.restaurantId = query.restaurantId; // still ANDed with visibility

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data: rows.map(toOrderResponse), meta: pageMeta(total, page, limit) };
}

async function loadAuthorized(user: AuthUser, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  // 404 (not 403) for orders you may not see, so ids cannot be probed.
  if (!order || !canAccessOrder(user, { userId: order.userId, restaurantOwnerId: order.restaurant.ownerId }))
    throw new AppError(404, 'Order not found');
  return order;
}

export async function getOrder(user: AuthUser, orderId: string) {
  return toOrderResponse(await loadAuthorized(user, orderId));
}

export async function changeOrderStatus(user: AuthUser, orderId: string, to: OrderStatus, reason?: string) {
  const order = await loadAuthorized(user, orderId);
  const actor = actorForRole(user.role as Role);
  if (!actor) throw new AppError(403, 'You do not have permission for this action');

  const from = order.status as OrderStatus;
  const paymentOk = order.payment?.method === 'COD' || order.payment?.status === 'PAID';
  const check = checkTransition(from, to, actor, { paymentOk });
  if (!check.ok) throw new AppError(check.httpStatus, check.message);
  if (to === 'CANCELLED' && actor !== 'CUSTOMER' && !reason) throw new AppError(400, 'A reason is required when a restaurant or admin cancels an order');

  const now = new Date();
  const history = [...((order.statusHistory as unknown as HistoryEntry[]) ?? []),
    { status: to, at: now.toISOString(), by: actor, ...(reason && { note: reason }) }];

  await prisma.$transaction(async (tx) => {
    // Optimistic lock: only succeeds if nobody changed the status since we read it.
    const moved = await tx.order.updateMany({
      where: { id: order.id, status: from },
      data: { status: to, statusHistory: history as unknown as Prisma.InputJsonValue, ...(to === 'CANCELLED' && { cancelReason: reason ?? 'Cancelled by customer' }) },
    });
    if (moved.count !== 1) throw new AppError(409, 'This order was just updated by someone else. Refresh and try again.');

    const pay = order.payment;
    if (to === 'CANCELLED') {
      if (order.couponId) await tx.coupon.updateMany({ where: { id: order.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
      if (pay) {
        if (pay.status === 'PAID' && pay.method !== 'COD') {
          // Demo money is "refunded" instantly. Razorpay test refunds are NOT automated (see README limitations).
          await tx.payment.update({ where: { id: pay.id }, data: pay.isDemo
            ? { status: 'REFUNDED', note: 'Demo refund (no real money moved)' }
            : { note: 'Order cancelled after payment: refund must be issued from the Razorpay dashboard' } });
        } else if (pay.status !== 'PAID') {
          await tx.payment.update({ where: { id: pay.id }, data: { status: 'FAILED', note: 'Order cancelled' } });
        }
      }
    }
    if (to === 'DELIVERED' && pay && pay.method === 'COD') {
      await tx.payment.update({ where: { id: pay.id }, data: { status: 'PAID', paidAt: now, note: 'Cash collected on delivery' } });
    }
  });

  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
  emitOrderEvent('order:status', {
    orderId: updated.id, orderNumber: updated.orderNumber, status: updated.status, previousStatus: from,
    paymentStatus: updated.payment?.status, reason: updated.cancelReason, estimatedAt: updated.estimatedAt.toISOString(), at: now.toISOString(),
  }, { customerId: updated.userId, ownerId: updated.restaurant.ownerId, orderId: updated.id });
  return toOrderResponse(updated);
}
