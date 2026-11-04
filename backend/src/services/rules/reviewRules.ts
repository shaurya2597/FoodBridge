export type ReviewEligibility = { ok: true } | { ok: false; httpStatus: 403 | 404 | 409; message: string };

/**
 * A customer may review only their own order, and only once it has been delivered.
 * Non-owners get 404 so order ids can't be probed.
 */
export function checkReviewEligibility(args: { orderStatus: string; orderUserId: string; userId: string }): ReviewEligibility {
  if (args.orderUserId !== args.userId) return { ok: false, httpStatus: 404, message: 'Order not found' };
  if (args.orderStatus !== 'DELIVERED') return { ok: false, httpStatus: 409, message: 'You can review an order only after it has been delivered' };
  return { ok: true };
}
