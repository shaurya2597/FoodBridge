export interface CouponState {
  isActive: boolean;
  validUntil: Date;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  minOrderPaise: number;
}

export type CouponCheck =
  | { ok: true }
  | { ok: false; code: 'INACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'USER_LIMIT' | 'MIN_ORDER'; message: string };

export function evaluateCoupon(
  coupon: CouponState,
  ctx: { subtotalPaise: number; now: Date; userUses: number },
): CouponCheck {
  if (!coupon.isActive) return { ok: false, code: 'INACTIVE', message: 'This coupon is not active' };
  if (coupon.validUntil.getTime() <= ctx.now.getTime()) return { ok: false, code: 'EXPIRED', message: 'This coupon has expired' };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, code: 'EXHAUSTED', message: 'This coupon has reached its usage limit' };
  if (ctx.userUses >= coupon.perUserLimit)
    return { ok: false, code: 'USER_LIMIT', message: 'You have already used this coupon' };
  if (ctx.subtotalPaise < coupon.minOrderPaise)
    return {
      ok: false, code: 'MIN_ORDER',
      message: `Add items worth ₹${((coupon.minOrderPaise - ctx.subtotalPaise) / 100).toFixed(2)} more to use this coupon`,
    };
  return { ok: true };
}
