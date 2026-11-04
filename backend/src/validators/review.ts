import { z } from 'zod';
import { paginationQuery } from './common';

const rating = z.number().int().min(1).max(5);
const comment = z.string().trim().max(1000).optional();

export const createRestaurantReviewBody = z.object({ orderId: z.string().min(1).max(40), rating, comment });
export const createFoodReviewBody = z.object({ orderItemId: z.string().min(1).max(40), rating, comment });
export const updateReviewBody = z.object({ rating: rating.optional(), comment: z.string().trim().max(1000).nullable().optional() })
  .refine((d) => d.rating !== undefined || d.comment !== undefined, { message: 'Nothing to update' });
export const reviewListQuery = z.object({ ...paginationQuery });
