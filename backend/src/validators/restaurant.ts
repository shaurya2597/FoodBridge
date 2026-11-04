import { z } from 'zod';
import { httpUrl, money, paginationQuery } from './common';

export const restaurantQuery = z.object({
  q: z.string().trim().optional(),
  cuisine: z.string().trim().optional(),
  veg: z.enum(['true', 'false']).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxPriceForTwo: z.coerce.number().positive().optional(),
  sort: z.enum(['popularity', 'rating', 'deliveryTime', 'price']).default('popularity'),
  ...paginationQuery,
});

export const restaurantBody = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(1000),
  cuisines: z.array(z.string().trim().min(2).max(40)).min(1).max(8),
  imageUrl: httpUrl,
  bannerUrl: httpUrl.optional(),
  address: z.string().min(5),
  city: z.string().min(2),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deliveryTime: z.number().int().min(10).max(120).default(30),
  deliveryFee: z.number().min(0).max(200).refine((v) => Math.round(v * 100) / 100 === v).default(0),
  minOrder: z.number().min(0).max(5000).default(0),
  priceForTwo: z.number().int().min(50).max(10000).default(300),
  isVegOnly: z.boolean().default(false),
  isOpen: z.boolean().default(true),
  opensAt: z.string().regex(/^\d{2}:\d{2}$/).default('10:00'),
  closesAt: z.string().regex(/^\d{2}:\d{2}$/).default('23:00'),
  ownerId: z.string().min(1).optional(), // honoured only for ADMIN
});
export const restaurantUpdate = restaurantBody.partial();

export const foodQuery = z.object({
  q: z.string().trim().optional(),
  restaurantId: z.string().optional(),
  type: z.enum(['VEG', 'NON_VEG']).optional(),
  includeUnavailable: z.enum(['true', 'false']).optional(),
  ...paginationQuery,
});

export const foodBody = z.object({
  restaurantId: z.string(),
  categoryName: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(500),
  price: money(10000),
  imageUrl: httpUrl,
  foodType: z.enum(['VEG', 'NON_VEG']),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  customizations: z.array(z.object({
    name: z.string(), options: z.array(z.object({ label: z.string(), extraPrice: z.number().min(0) })),
  })).optional(),
});
export const foodUpdate = foodBody.omit({ restaurantId: true }).partial();
