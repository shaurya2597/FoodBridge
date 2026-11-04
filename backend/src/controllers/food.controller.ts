import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { getPagination, pageMeta } from '../utils/pagination';
import { assertRestaurantAccess, isRestaurantStaff } from '../services/access';

const publicRestaurant = {
  id: true, name: true, slug: true, imageUrl: true, city: true, isOpen: true,
  deliveryTime: true, deliveryFee: true, minOrder: true, status: true,
} as const;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { q, restaurantId, type, includeUnavailable } = req.query as any;
  const { page, limit, skip, take } = getPagination(req.query);

  // Unavailable items are only listed for the owner/admin of that restaurant.
  let showUnavailable = false;
  if (includeUnavailable === 'true') {
    if (!restaurantId) throw new AppError(400, 'includeUnavailable requires restaurantId');
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
    showUnavailable = isRestaurantStaff(req.user, r?.ownerId);
    if (!showUnavailable) throw new AppError(403, 'Only the restaurant owner or an admin can list unavailable items');
  }

  const where: Prisma.FoodItemWhereInput = {};
  if (!showUnavailable) {
    where.isAvailable = true;
    where.restaurant = { status: 'APPROVED' };
  }
  if (q) where.name = { contains: q, mode: 'insensitive' };
  if (restaurantId) where.restaurantId = restaurantId;
  if (type) where.foodType = type;
  const [total, items] = await Promise.all([
    prisma.foodItem.count({ where }),
    prisma.foodItem.findMany({
      where, skip, take, orderBy: [{ isPopular: 'desc' }, { rating: 'desc' }, { id: 'asc' }],
      include: { restaurant: { select: { id: true, name: true } }, category: { select: { name: true } } },
    }),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const food = await prisma.foodItem.findUnique({
    where: { id: req.params.id },
    include: { restaurant: { select: { ...publicRestaurant, ownerId: true } }, category: { select: { id: true, name: true } } },
  });
  if (!food) throw new AppError(404, 'Food item not found');

  const staff = isRestaurantStaff(req.user, food.restaurant.ownerId);
  // Same 404 for "missing" and "hidden" so unavailable items can't be probed by id.
  if (!staff && (!food.isAvailable || food.restaurant.status !== 'APPROVED')) throw new AppError(404, 'Food item not found');

  const { ownerId: _o, ...restaurant } = food.restaurant;
  res.json({ success: true, data: { ...food, restaurant } });
});

async function categoryId(restaurantId: string, name: string) {
  const count = await prisma.foodCategory.count({ where: { restaurantId } });
  // upsert avoids a unique-constraint race when two items create the same new category at once
  const cat = await prisma.foodCategory.upsert({
    where: { restaurantId_name: { restaurantId, name } },
    update: {},
    create: { restaurantId, name, sortOrder: count },
  });
  return cat.id;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId, categoryName, ...data } = req.body;
  await assertRestaurantAccess(req.user!, restaurantId);
  const food = await prisma.foodItem.create({
    data: { ...data, restaurantId, categoryId: await categoryId(restaurantId, categoryName) },
  });
  res.status(201).json({ success: true, data: food });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.foodItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, 'Food item not found');
  await assertRestaurantAccess(req.user!, existing.restaurantId);
  const { categoryName, ...data } = req.body;
  const food = await prisma.foodItem.update({
    where: { id: existing.id },
    data: { ...data, ...(categoryName && { categoryId: await categoryId(existing.restaurantId, categoryName) }) },
  });
  res.json({ success: true, data: food });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.foodItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, 'Food item not found');
  await assertRestaurantAccess(req.user!, existing.restaurantId);
  if (await prisma.orderItem.count({ where: { foodItemId: existing.id } })) {
    await prisma.foodItem.update({ where: { id: existing.id }, data: { isAvailable: false } });
    return res.json({ success: true, message: 'Item is in past orders, so it was marked unavailable instead' });
  }
  await prisma.foodItem.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Food item deleted' });
});
