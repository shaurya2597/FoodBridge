import { z } from 'zod';
import { DONATION_CATEGORIES } from '../services/rules/donationRules';
import { httpUrl, paginationQuery } from './common';

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const createDonationBody = z.object({
  // Restaurant owners must say which of THEIR restaurants is donating; customers donate as individuals.
  restaurantId: z.string().min(1).max(40).optional(),
  foodName: z.string().trim().min(2).max(100),
  category: z.enum(DONATION_CATEGORIES),
  quantity: z.string().trim().min(1).max(60),
  servings: z.number().int().min(1).max(5000),
  foodType: z.enum(['VEG', 'NON_VEG']),
  preparedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  pickupAddress: z.string().trim().min(10).max(250),
  city: z.string().trim().min(2).max(60),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactPhone: phone,
  imageUrl: httpUrl.optional(),
  instructions: z.string().trim().max(500).optional(),
  // The donor must explicitly confirm the food is safe. `false` or missing is rejected.
  safetyConfirmed: z.literal(true, { errorMap: () => ({ message: 'You must confirm that the food is safe to eat' }) }),
});

export const donationListQuery = z.object({
  city: z.string().trim().min(1).max(60).optional(),
  foodType: z.enum(['VEG', 'NON_VEG']).optional(),
  q: z.string().trim().min(1).max(60).optional(),
  status: z.enum(['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED', 'EXPIRED', 'FLAGGED', 'CANCELLED']).optional(),
  mine: z.enum(['true', 'false']).optional(),
  sort: z.enum(['expiry', 'newest']).default('expiry'),
  ...paginationQuery,
});

export const requestDonationBody = z.object({ message: z.string().trim().max(300).optional() });

export const donationStatusBody = z.object({
  status: z.enum(['POSTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED', 'CANCELLED']),
  pickupAt: z.coerce.date().optional(),
  reason: z.string().trim().min(3).max(200).optional(),
});
