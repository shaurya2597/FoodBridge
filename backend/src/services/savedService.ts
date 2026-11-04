import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';

export async function listSaved(userId: string) {
  const [restaurants, foods] = await Promise.all([
    prisma.savedRestaurant.findMany({
      where: {
        userId,
        restaurant: { status: 'APPROVED' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            city: true,
            isOpen: true,
            deliveryTime: true,
            deliveryFee: true,
            minOrder: true,
            rating: true,
          },
        },
      },
    }),
    prisma.savedFoodItem.findMany({
      where: {
        userId,
        foodItem: {
          isAvailable: true,
          restaurant: { status: 'APPROVED' },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        foodItem: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                slug: true,
                imageUrl: true,
                city: true,
                isOpen: true,
                deliveryTime: true,
                deliveryFee: true,
                minOrder: true,
              },
            },
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return {
    restaurants: restaurants.map((entry) => ({
      savedAt: entry.createdAt,
      ...entry.restaurant,
    })),
    foods: foods.map((entry) => ({
      savedAt: entry.createdAt,
      ...entry.foodItem,
    })),
  };
}

export async function saveRestaurant(userId: string, restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, status: true },
  });

  if (!restaurant || restaurant.status !== 'APPROVED') {
    throw new AppError(404, 'Restaurant not found');
  }

  await prisma.savedRestaurant.upsert({
    where: { userId_restaurantId: { userId, restaurantId } },
    update: {},
    create: { userId, restaurantId },
  });

  return { saved: true };
}

export async function removeRestaurant(userId: string, restaurantId: string) {
  await prisma.savedRestaurant.deleteMany({
    where: { userId, restaurantId },
  });

  return { saved: false };
}

export async function saveFood(userId: string, foodItemId: string) {
  const food = await prisma.foodItem.findUnique({
    where: { id: foodItemId },
    select: {
      id: true,
      isAvailable: true,
      restaurant: { select: { status: true } },
    },
  });

  if (!food || !food.isAvailable || food.restaurant.status !== 'APPROVED') {
    throw new AppError(404, 'Food item not found');
  }

  await prisma.savedFoodItem.upsert({
    where: { userId_foodItemId: { userId, foodItemId } },
    update: {},
    create: { userId, foodItemId },
  });

  return { saved: true };
}

export async function removeFood(userId: string, foodItemId: string) {
  await prisma.savedFoodItem.deleteMany({
    where: { userId, foodItemId },
  });

  return { saved: false };
}