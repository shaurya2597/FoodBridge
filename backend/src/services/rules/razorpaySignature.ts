import { createHmac, timingSafeEqual } from 'node:crypto';

/** Razorpay: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret), hex encoded. */
export function signPayment(orderId: string, paymentId: string, secret: string): string {
  return createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = Buffer.from(signPayment(orderId, paymentId, secret), 'utf8');
  const given = Buffer.from(signature, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
