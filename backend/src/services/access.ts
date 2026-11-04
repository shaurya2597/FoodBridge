import { prisma } from '../config/prisma';
import { AuthUser } from '../middleware/auth';
import { AppError } from '../utils/AppError';

/** Owners may only touch their own restaurants; admins may touch any. */
export async function assertRestaurantAccess(user: AuthUser, restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new AppError(404, 'Restaurant not found');
  if (user.role !== 'ADMIN' && restaurant.ownerId !== user.id) throw new AppError(403, 'You do not own this restaurant');
  return restaurant;
}

/** True for admins and for the owner of the given restaurant. */
export const isRestaurantStaff = (user: AuthUser | undefined, ownerId: string | undefined) =>
  Boolean(user && (user.role === 'ADMIN' || user.id === ownerId));
