import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { quoteCart, quoteToResponse } from '../services/cartPricing';

/** Price breakdown before placing the order. Coupon problems are reported, not thrown, so the UI can show them inline. */
export const preview = asyncHandler(async (req: Request, res: Response) => {
  const { couponCode, addressId, address } = req.body;
  const q = await quoteCart(prisma, req.user!.id, couponCode);

  let deliverable: { ok: boolean; message?: string } | undefined;
  if (q.restaurant && (addressId || address)) {
    let city: string | undefined = address?.city;
    if (addressId) {
      const a = await prisma.address.findFirst({ where: { id: addressId, userId: req.user!.id } });
      if (!a) throw new AppError(400, 'Delivery address not found');
      city = a.city;
    }
    const ok = city!.trim().toLowerCase() === q.restaurant.city.trim().toLowerCase();
    deliverable = ok ? { ok } : { ok, message: `${q.restaurant.name} delivers only within ${q.restaurant.city}` };
  }
  const minOrderMessage = q.restaurant && !q.meetsMinOrder ? `Minimum order is ₹${(q.minOrderPaise / 100).toFixed(2)}` : undefined;
  res.json({
    success: true,
    data: { ...quoteToResponse(q), deliverable, minOrderMessage, canCheckout: q.lines.length > 0 && q.issues.length === 0 && q.meetsMinOrder && (deliverable?.ok ?? true) && (q.coupon?.applied ?? true) },
  });
});
