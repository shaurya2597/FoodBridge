import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../middleware/auth';
import { getPagination, pageMeta } from '../utils/pagination';
import { checkReviewEligibility } from './rules/reviewRules';
import { ratingAdded, ratingChanged, ratingRemoved } from './ratingStats';

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const author = { select: { id: true, name: true } } as const;

export async function createRestaurantReview(user: AuthUser, input: { orderId: string; rating: number; comment?: string }) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new AppError(404, 'Order not found');
  const check = checkReviewEligibility({ orderStatus: order.status, orderUserId: order.userId, userId: user.id });
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  try {
    return await prisma.$transaction(async (tx) => {
      // Review.orderId is UNIQUE: the database itself rejects a second review for the same order.
      const review = await tx.review.create({
        data: { userId: user.id, restaurantId: order.restaurantId, orderId: order.id, rating: input.rating, comment: input.comment || null },
        include: { user: author },
      });
      await ratingAdded(tx, { table: 'Restaurant', id: order.restaurantId }, input.rating);
      return review;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(409, 'You have already reviewed this order');
    throw e;
  }
}

export async function createFoodReview(user: AuthUser, input: { orderItemId: string; rating: number; comment?: string }) {
  const item = await prisma.orderItem.findUnique({ where: { id: input.orderItemId }, include: { order: true } });
  if (!item) throw new AppError(404, 'Order item not found');
  const check = checkReviewEligibility({ orderStatus: item.order.status, orderUserId: item.order.userId, userId: user.id });
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  try {
    return await prisma.$transaction(async (tx) => {
      // FoodReview.orderItemId is UNIQUE: one review per ordered line.
      const review = await tx.foodReview.create({
        data: { userId: user.id, foodItemId: item.foodItemId, orderItemId: item.id, rating: input.rating, comment: input.comment || null },
        include: { user: author },
      });
      await ratingAdded(tx, { table: 'FoodItem', id: item.foodItemId }, input.rating);
      return review;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(409, 'You have already reviewed this item');
    throw e;
  }
}

export async function listRestaurantReviews(restaurantId: string, query: { page?: unknown; limit?: unknown }) {
  const { page, limit, skip, take } = getPagination(query);
  const where = { restaurantId };
  const [total, data] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({ where, include: { user: author }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data, meta: pageMeta(total, page, limit) };
}

export async function listFoodReviews(foodItemId: string, query: { page?: unknown; limit?: unknown }) {
  const { page, limit, skip, take } = getPagination(query);
  const where = { foodItemId };
  const [total, data] = await Promise.all([
    prisma.foodReview.count({ where }),
    prisma.foodReview.findMany({ where, include: { user: author }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data, meta: pageMeta(total, page, limit) };
}

type Kind = 'restaurant' | 'food';

/** Only the author may edit. The author or an admin may delete. Everyone else sees 404. */
async function loadForChange(kind: Kind, id: string, user: AuthUser, action: 'edit' | 'delete') {
  const review = kind === 'restaurant' ? await prisma.review.findUnique({ where: { id } }) : await prisma.foodReview.findUnique({ where: { id } });
  if (!review) throw new AppError(404, 'Review not found');
  const isAuthor = review.userId === user.id;
  const isAdminDelete = action === 'delete' && user.role === 'ADMIN';
  if (!isAuthor && !isAdminDelete) throw new AppError(404, 'Review not found');
  return review;
}

export async function updateReview(kind: Kind, id: string, user: AuthUser, patch: { rating?: number; comment?: string | null }) {
  const existing = await loadForChange(kind, id, user, 'edit');
  return prisma.$transaction(async (tx) => {
    const data = { ...(patch.rating !== undefined && { rating: patch.rating }), ...(patch.comment !== undefined && { comment: patch.comment || null }) };
    const updated = kind === 'restaurant'
      ? await tx.review.update({ where: { id }, data, include: { user: author } })
      : await tx.foodReview.update({ where: { id }, data, include: { user: author } });
    if (patch.rating !== undefined && patch.rating !== existing.rating) {
      const target = kind === 'restaurant'
        ? { table: 'Restaurant' as const, id: (existing as { restaurantId: string }).restaurantId }
        : { table: 'FoodItem' as const, id: (existing as { foodItemId: string }).foodItemId };
      await ratingChanged(tx, target, existing.rating, patch.rating);
    }
    return updated;
  });
}

export async function deleteReview(kind: Kind, id: string, user: AuthUser) {
  const existing = await loadForChange(kind, id, user, 'delete');
  await prisma.$transaction(async (tx) => {
    if (kind === 'restaurant') {
      await tx.review.delete({ where: { id } });
      await ratingRemoved(tx, { table: 'Restaurant', id: (existing as { restaurantId: string }).restaurantId }, existing.rating);
    } else {
      await tx.foodReview.delete({ where: { id } });
      await ratingRemoved(tx, { table: 'FoodItem', id: (existing as { foodItemId: string }).foodItemId }, existing.rating);
    }
  });
}
