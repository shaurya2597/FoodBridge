import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calcDiscountPaise, computeBreakdown, toPaise, toRupees, breakdownToRupees } from '../../src/services/rules/pricing';
import { evaluateCoupon, CouponState } from '../../src/services/rules/coupons';

const cfg = { taxRatePercent: 5, platformFeePaise: 500 };

describe('checkout pricing', () => {
  test('converts rupees to paise without float drift', () => {
    assert.equal(toPaise(249), 24900);
    assert.equal(toPaise('99.99'), 9999);
    assert.equal(toPaise(0.1 + 0.2), 30);
    assert.equal(toRupees(24950), 249.5);
  });

  test('full breakdown: subtotal, tax on discounted amount, delivery, platform fee', () => {
    // 2 x Paneer 260 + 1 x Naan 55 = 575. Delivery 30. No coupon.
    const b = computeBreakdown({ subtotalPaise: 57500, discountPaise: 0, deliveryFeePaise: 3000, config: cfg });
    assert.equal(b.taxPaise, 2875); // 5% of 575
    assert.equal(b.platformFeePaise, 500);
    assert.equal(b.totalPaise, 57500 + 2875 + 3000 + 500);
    assert.deepEqual(breakdownToRupees(b), { subtotal: 575, discount: 0, tax: 28.75, deliveryFee: 30, platformFee: 5, total: 638.75 });
  });

  test('tax is charged on the discounted food total, not the original', () => {
    const b = computeBreakdown({ subtotalPaise: 100000, discountPaise: 10000, deliveryFeePaise: 0, config: cfg });
    assert.equal(b.taxPaise, 4500);
    assert.equal(b.totalPaise, 90000 + 4500 + 500);
  });

  test('percentage discount is capped by maxDiscount', () => {
    const rule = { discountType: 'PERCENT' as const, value: 50, maxDiscountPaise: 10000 };
    assert.equal(calcDiscountPaise(rule, 30000), 10000); // 50% = 150 but capped at 100
    assert.equal(calcDiscountPaise(rule, 10000), 5000); // below the cap
  });

  test('flat discount never exceeds the subtotal', () => {
    const rule = { discountType: 'FLAT' as const, value: 7500, maxDiscountPaise: null };
    assert.equal(calcDiscountPaise(rule, 50000), 7500);
    assert.equal(calcDiscountPaise(rule, 5000), 5000);
    assert.equal(calcDiscountPaise(rule, 0), 0);
  });

  test('empty cart has no platform fee and a zero total', () => {
    const b = computeBreakdown({ subtotalPaise: 0, discountPaise: 0, deliveryFeePaise: 0, config: cfg });
    assert.equal(b.totalPaise, 0);
  });
});

describe('coupon validation', () => {
  const now = new Date('2026-10-30T10:00:00Z');
  const base: CouponState = { isActive: true, validUntil: new Date('2027-01-01T00:00:00Z'), usageLimit: 100, usedCount: 5, perUserLimit: 1, minOrderPaise: 19900 };
  const ctx = { subtotalPaise: 30000, now, userUses: 0 };

  test('valid coupon passes', () => assert.deepEqual(evaluateCoupon(base, ctx), { ok: true }));
  test('inactive coupon is rejected', () => assert.equal((evaluateCoupon({ ...base, isActive: false }, ctx) as any).code, 'INACTIVE'));
  test('expired coupon is rejected', () => assert.equal((evaluateCoupon({ ...base, validUntil: new Date('2026-10-30T09:59:59Z') }, ctx) as any).code, 'EXPIRED'));
  test('coupon expiring exactly now is rejected', () => assert.equal((evaluateCoupon({ ...base, validUntil: now }, ctx) as any).code, 'EXPIRED'));
  test('global usage limit reached', () => assert.equal((evaluateCoupon({ ...base, usedCount: 100 }, ctx) as any).code, 'EXHAUSTED'));
  test('null usage limit means unlimited', () => assert.equal(evaluateCoupon({ ...base, usageLimit: null, usedCount: 99999 }, ctx).ok, true));
  test('per-user limit reached', () => assert.equal((evaluateCoupon(base, { ...ctx, userUses: 1 }) as any).code, 'USER_LIMIT'));
  test('minimum order not met, message says how much more', () => {
    const r: any = evaluateCoupon(base, { ...ctx, subtotalPaise: 15000 });
    assert.equal(r.code, 'MIN_ORDER');
    assert.match(r.message, /₹49\.00/);
  });
});
