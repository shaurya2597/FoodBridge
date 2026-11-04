/** Pure money maths. Everything is in integer paise so rounding never drifts. */

export interface PricingConfig {
  taxRatePercent: number; // GST on (subtotal - discount)
  platformFeePaise: number;
}

export interface CouponDiscountRule {
  discountType: 'PERCENT' | 'FLAT';
  /** PERCENT: the percentage (e.g. 50). FLAT: the amount in paise. */
  value: number;
  maxDiscountPaise: number | null;
}

export interface PriceBreakdownPaise {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  deliveryFeePaise: number;
  platformFeePaise: number;
  totalPaise: number;
}

export const toPaise = (rupees: number | string | { toString(): string }): number =>
  Math.round(Number(rupees.toString()) * 100);
export const toRupees = (paise: number): number => Math.round(paise) / 100;

export function lineTotalPaise(unitPricePaise: number, quantity: number): number {
  return unitPricePaise * quantity;
}

export function calcDiscountPaise(rule: CouponDiscountRule, subtotalPaise: number): number {
  if (subtotalPaise <= 0) return 0;
  let discount =
    rule.discountType === 'PERCENT' ? Math.floor((subtotalPaise * rule.value) / 100) : Math.round(rule.value);
  if (rule.maxDiscountPaise !== null) discount = Math.min(discount, rule.maxDiscountPaise);
  return Math.max(0, Math.min(discount, subtotalPaise)); // a discount can never exceed the food total
}

export function computeBreakdown(args: {
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  config: PricingConfig;
}): PriceBreakdownPaise {
  const { subtotalPaise, discountPaise, deliveryFeePaise, config } = args;
  const taxable = Math.max(0, subtotalPaise - discountPaise);
  const taxPaise = Math.round((taxable * config.taxRatePercent) / 100);
  const platformFeePaise = subtotalPaise > 0 ? config.platformFeePaise : 0;
  const totalPaise = taxable + taxPaise + deliveryFeePaise + platformFeePaise;
  return { subtotalPaise, discountPaise, taxPaise, deliveryFeePaise, platformFeePaise, totalPaise };
}

/** API-friendly view: rupees with 2 decimals. */
export function breakdownToRupees(b: PriceBreakdownPaise) {
  return {
    subtotal: toRupees(b.subtotalPaise),
    discount: toRupees(b.discountPaise),
    tax: toRupees(b.taxPaise),
    deliveryFee: toRupees(b.deliveryFeePaise),
    platformFee: toRupees(b.platformFeePaise),
    total: toRupees(b.totalPaise),
  };
}
