import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import slugify from '../utils/slugify';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { getPagination, pageMeta } from '../utils/pagination';
import { assertRestaurantAccess, isRestaurantStaff } from '../services/access';

/** Public responses never expose the owner's user id or an admin's internal moderation note. */
const withoutOwner = <T extends { ownerId: string; moderationNote?: string | null }>({ ownerId: _o, moderationNote: _n, ...rest }: T) => rest;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { q, cuisine, veg, minRating, maxPriceForTwo, sort } = req.query as any;
  const { page, limit, skip, take } = getPagination(req.query);

  const where: Prisma.RestaurantWhereInput = { status: 'APPROVED' };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { foods: { some: { name: { contains: q, mode: 'insensitive' }, isAvailable: true } } }, // dish search
    ];
  }
  if (cuisine) where.cuisines = { has: cuisine };
  if (veg === 'true') where.isVegOnly = true;
  if (minRating) where.rating = { gte: minRating };
  if (maxPriceForTwo) where.priceForTwo = { lte: maxPriceForTwo };
  // `id` as a final tiebreaker keeps pagination stable when many rows share a rating/time.
  const primary: Prisma.RestaurantOrderByWithRelationInput =
    sort === 'rating' ? { rating: 'desc' }
    : sort === 'deliveryTime' ? { deliveryTime: 'asc' }
    : sort === 'price' ? { priceForTwo: 'asc' }
    : { ratingCount: 'desc' };

  const [total, items] = await Promise.all([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({ where, orderBy: [primary, { id: 'asc' }], skip, take }),
  ]);
  res.json({ success: true, data: items.map(withoutOwner), meta: pageMeta(total, page, limit) });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const base = await prisma.restaurant.findUnique({ where: { id: req.params.id }, select: { ownerId: true, status: true } });
  const staff = isRestaurantStaff(req.user, base?.ownerId);
  if (!base || (base.status !== 'APPROVED' && !staff)) throw new AppError(404, 'Restaurant not found');

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      categories: {
        orderBy: { sortOrder: 'asc' },
        // Customers only see available dishes; the owner/admin also needs unavailable ones to re-enable them.
        include: { foods: { where: staff ? {} : { isAvailable: true }, orderBy: [{ isPopular: 'desc' }, { name: 'asc' }] } },
      },
    },
  });
  res.json({ success: true, data: staff ? restaurant : withoutOwner(restaurant) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { ownerId, ...data } = req.body;
  const isAdmin = req.user!.role === 'ADMIN';

  let finalOwnerId = req.user!.id;
  if (isAdmin && ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== 'RESTAURANT_OWNER' || owner.isBlocked)
      throw new AppError(400, 'ownerId must be an active RESTAURANT_OWNER user');
    finalOwnerId = owner.id;
  }
  const restaurant = await prisma.restaurant.create({
    data: {
      ...data,
      slug: `${slugify(data.name) || 'restaurant'}-${Date.now().toString(36)}`,
      ownerId: finalOwnerId,
      // Owner submissions wait for admin approval; admin-created ones go live.
      status: isAdmin ? 'APPROVED' : 'PENDING',
    },
  });
  res.status(201).json({ success: true, data: restaurant });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  await assertRestaurantAccess(req.user!, req.params.id);
  const { ownerId: _ignored, ...data } = req.body; // owner and status can never change here
  const updated = await prisma.restaurant.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await assertRestaurantAccess(req.user!, req.params.id);
  if (await prisma.order.count({ where: { restaurantId: req.params.id } })) {
    // Preserve order history: suspend instead of deleting.
    await prisma.restaurant.update({ where: { id: req.params.id }, data: { status: 'SUSPENDED', isOpen: false } });
    return res.json({ success: true, message: 'Restaurant has orders, so it was suspended instead of deleted' });
  }
  await prisma.restaurant.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Restaurant deleted' });
});


export const mine = asyncHandler(async (req: Request, res: Response) => {
  const restaurants = await prisma.restaurant.findMany({
    where: { ownerId: req.user!.id },
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: restaurants });
});