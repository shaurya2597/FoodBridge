import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { Selection, makeLineKey, resolveSelections } from './rules/cartLines';

export async function addToCart(userId: string, input: {
  foodItemId: string; quantity: number; selections: Selection[]; instructions?: string; replaceCart: boolean;
}) {
  const food = await prisma.foodItem.findUnique({ where: { id: input.foodItemId }, include: { restaurant: true } });
  // Same 404 whether the dish is missing, unavailable or belongs to a hidden restaurant.
  if (!food || !food.isAvailable || food.restaurant.status !== 'APPROVED') throw new AppError(404, 'Food item not found or unavailable');
  if (!food.restaurant.isOpen) throw new AppError(409, `${food.restaurant.name} is currently closed`, { code: 'RESTAURANT_CLOSED' });

  const resolved = resolveSelections(food.customizations, input.selections);
  if (!resolved.ok) throw new AppError(400, resolved.message);
  const lineKey = makeLineKey(food.id, resolved.normalized, input.instructions);

  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({ where: { userId }, update: {}, create: { userId } });
    const count = await tx.cartItem.count({ where: { cartId: cart.id } });

    if (count > 0 && cart.restaurantId && cart.restaurantId !== food.restaurantId) {
      if (!input.replaceCart) {
        throw new AppError(409, 'Your cart has items from another restaurant. Clear it first or set replaceCart to true.', {
          code: 'CART_RESTAURANT_CONFLICT', currentRestaurantId: cart.restaurantId,
        });
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    await tx.cart.update({ where: { id: cart.id }, data: { restaurantId: food.restaurantId } });

    const existing = await tx.cartItem.findUnique({ where: { cartId_lineKey: { cartId: cart.id, lineKey } } });
    const newQty = (existing?.quantity ?? 0) + input.quantity;
    if (newQty > 20) throw new AppError(400, 'You can order at most 20 of the same item');

    await tx.cartItem.upsert({
      where: { cartId_lineKey: { cartId: cart.id, lineKey } },
      update: { quantity: { increment: input.quantity } },
      create: {
        cartId: cart.id, foodItemId: food.id, quantity: input.quantity, lineKey,
        customization: resolved.normalized.length ? (resolved.normalized as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        instructions: input.instructions || null,
      },
    });
  });
}

/** Ownership is enforced by the query itself: the cart item must sit in THIS user's cart. */
async function findOwnItem(userId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
  if (!item) throw new AppError(404, 'Cart item not found');
  return item;
}

export async function setQuantity(userId: string, itemId: string, quantity: number) {
  const item = await findOwnItem(userId, itemId);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeItem(userId: string, itemId: string) {
  const item = await findOwnItem(userId, itemId);
  await prisma.$transaction(async (tx) => {
    await tx.cartItem.delete({ where: { id: item.id } });
    if ((await tx.cartItem.count({ where: { cartId: item.cartId } })) === 0)
      await tx.cart.update({ where: { id: item.cartId }, data: { restaurantId: null } });
  });
}

export async function clearCart(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { restaurantId: null } }),
  ]);
}
