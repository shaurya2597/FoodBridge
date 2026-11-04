import { z } from 'zod';

export const verifyPaymentBody = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('razorpay'),
    razorpay_order_id: z.string().min(1).max(100),
    razorpay_payment_id: z.string().min(1).max(100),
    razorpay_signature: z.string().min(1).max(200),
  }),
  // Demo mode only: lets you rehearse the success/failure paths with no real money.
  z.object({ provider: z.literal('demo'), outcome: z.enum(['success', 'failure']) }),
]);

export const paymentFailedBody = z.object({
  reason: z.enum(['FAILED', 'CANCELLED_BY_USER']).default('FAILED'),
  description: z.string().trim().max(200).optional(),
});
