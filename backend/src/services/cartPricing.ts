import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { evaluateCoupon } from './rules/coupons';
import { resolveSelections, Selection } from './rules/cartLines';
import { isWithinOpeningHours } from './rules/openingHours';
import { PriceBreakdownPaise, breakdownToRupees, calcDiscountPaise, computeBreakdown, toPaise, toRupees } from './rules/pricing';
import { pricingConfig } from './pricingConfig';

/** Works with the global client and with an interactive-transaction client. */
export type Db = Prisma.TransactionClient;

export interface CartIssue { cartItemId?: string; code: string; message: string }

export interface PricedLine {
  cartItemId: string;
  foodItemId: string;
  name: string;
  imageUrl: string;
  foodType: 'VEG' | 'NON_VEG';
  quantity: number;
  selections: Selection[];
  instructions: string | null;
  unitPricePaise: number;
  linePaise: number;
}

export async function loadCart(db: Db, userId: string) {
  return db.cart.findUnique({
    where: { userId },
    include: {
      restaurant: true,
      items: { orderBy: { id: 'asc' }, include: { foodItem: true } },
    },
  });
}
export type LoadedCart = NonNullable<Awaited<ReturnType<typeof loadCart>>>;

/** Prices every line from the CURRENT database prices and reports anything that blocks checkout. */
export function priceCartLines(cart: LoadedCart | null, now = new Date()) {
  const lines: PricedLine[] = [];
  const issues: CartIssue[] = [];
  if (!cart || cart.items.length === 0) return { lines, issues, subtotalPaise: 0 };

  const restaurant = cart.restaurant;
  if (!restaurant || restaurant.status !== 'APPROVED') {
    issues.push({ code: 'RESTAURANT_UNAVAILABLE', message: 'This restaurant is not accepting orders' });
  } else if (!restaurant.isOpen) {
    issues.push({ code: 'RESTAURANT_CLOSED', message: `${restaurant.name} is currently closed` });
  } else if (env.ENFORCE_OPENING_HOURS && !isWithinOpeningHours(restaurant.opensAt, restaurant.closesAt, now)) {
    issues.push({ code: 'RESTAURANT_CLOSED', message: `${restaurant.name} is open ${restaurant.opensAt}-${restaurant.closesAt}` });
  }

  for (const item of cart.items) {
    const food = item.foodItem;
    if (!food.isAvailable) {
      issues.push({ cartItemId: item.id, code: 'ITEM_UNAVAILABLE', message: `${food.name} is no longer available` });
      continue;
    }
    if (food.restaurantId !== cart.restaurantId) {
      issues.push({ cartItemId: item.id, code: 'ITEM_UNAVAILABLE', message: `${food.name} does not belong to this restaurant` });
      continue;
    }
    const selections = Array.isArray(item.customization) ? (item.customization as unknown as Selection[]) : [];
    const resolved = resolveSelections(food.customizations, selections);
    if (!resolved.ok) {
      issues.push({ cartItemId: item.id, code: 'ITEM_OPTIONS_INVALID', message: `${food.name}: ${resolved.message}` });
      continue;
    }
    const unitPricePaise = toPaise(food.price) + resolved.extraPricePaise;
    lines.push({
      cartItemId: item.id, foodItemId: food.id, name: food.name, imageUrl: food.imageUrl, foodType: food.foodType,
      quantity: item.quantity, selections: resolved.normalized, instructions: item.instructions,
      unitPricePaise, linePaise: unitPricePaise * item.quantity,
    });
  }
  return { lines, issues, subtotalPaise: lines.reduce((s, l) => s + l.linePaise, 0) };
}

export interface CouponOutcome {
  code: string;
  applied: boolean;
  id?: string;
  description?: string;
  discountPaise: number;
  error?: { code: string; message: string };
}

async function resolveCoupon(db: Db, userId: string, code: string | undefined, subtotalPaise: number, now: Date): Promise<CouponOutcome | null> {
  if (!code) return null;
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return { code, applied: false, discountPaise: 0, error: { code: 'NOT_FOUND', message: 'Invalid coupon code' } };

  const userUses = await db.order.count({ where: { userId, couponId: coupon.id, status: { not: 'CANCELLED' } } });
  const check = evaluateCoupon(
    { isActive: coupon.isActive, validUntil: coupon.validUntil, usageLimit: coupon.usageLimit, usedCount: coupon.usedCount,
      perUserLimit: coupon.perUserLimit, minOrderPaise: toPaise(coupon.minOrder) },
    { subtotalPaise, now, userUses },
  );
  if (!check.ok) return { code, applied: false, id: coupon.id, discountPaise: 0, error: { code: check.code, message: check.message } };

  const discountPaise = calcDiscountPaise(
    {
      discountType: coupon.discountType,
      value: coupon.discountType === 'FLAT' ? toPaise(coupon.value) : Number(coupon.value.toString()),
      maxDiscountPaise: coupon.maxDiscount ? toPaise(coupon.maxDiscount) : null,
    },
    subtotalPaise,
  );
  return { code, applied: true, id: coupon.id, description: coupon.description, discountPaise };
}

/** Full server-side quote for the user's current cart. Never reads a price from the client. */
export async function quoteCart(db: Db, userId: string, couponCode?: string, now = new Date()) {
  const cart = await loadCart(db, userId);
  const priced = priceCartLines(cart, now);
  const restaurant = cart?.restaurant ?? null;

  const coupon = await resolveCoupon(db, userId, couponCode, priced.subtotalPaise, now);
  const breakdown: PriceBreakdownPaise = computeBreakdown({
    subtotalPaise: priced.subtotalPaise,
    discountPaise: coupon?.applied ? coupon.discountPaise : 0,
    deliveryFeePaise: restaurant && priced.lines.length ? toPaise(restaurant.deliveryFee) : 0,
    config: pricingConfig,
  });

  const minOrderPaise = restaurant ? toPaise(restaurant.minOrder) : 0;
  return {
    cart, restaurant, ...priced, coupon, breakdown,
    minOrderPaise, meetsMinOrder: priced.subtotalPaise >= minOrderPaise,
  };
}
export type Quote = Awaited<ReturnType<typeof quoteCart>>;

export function assertCheckoutReady(q: Quote) {
  if (!q.cart || q.cart.items.length === 0) throw new AppError(400, 'Your cart is empty');
  if (q.issues.length) throw new AppError(409, 'Some items in your cart need attention', { issues: q.issues });
  if (!q.meetsMinOrder)
    throw new AppError(400, `Minimum order for ${q.restaurant!.name} is ₹${toRupees(q.minOrderPaise).toFixed(2)}`);
}

/** Shape returned to API clients (rupees, no internal ids beyond what the UI needs). */
export function quoteToResponse(q: Quote) {
  return {
    restaurant: q.restaurant && {
      id: q.restaurant.id, name: q.restaurant.name, imageUrl: q.restaurant.imageUrl, city: q.restaurant.city,
      deliveryTime: q.restaurant.deliveryTime, isOpen: q.restaurant.isOpen, minOrder: toRupees(q.minOrderPaise),
    },
    items: q.lines.map((l) => ({
      id: l.cartItemId, foodItemId: l.foodItemId, name: l.name, imageUrl: l.imageUrl, foodType: l.foodType,
      quantity: l.quantity, selections: l.selections, instructions: l.instructions,
      unitPrice: toRupees(l.unitPricePaise), lineTotal: toRupees(l.linePaise),
    })),
    itemCount: q.lines.reduce((n, l) => n + l.quantity, 0),
    issues: q.issues,
    meetsMinOrder: q.meetsMinOrder,
    coupon: q.coupon && {
      code: q.coupon.code, applied: q.coupon.applied, description: q.coupon.description,
      discount: toRupees(q.coupon.discountPaise), error: q.coupon.error,
    },
    breakdown: breakdownToRupees(q.breakdown),
  };
}
