import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as reviews from '../services/reviewService';

export const createRestaurant = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json({ success: true, data: await reviews.createRestaurantReview(req.user!, req.body) }));
export const createFood = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json({ success: true, data: await reviews.createFoodReview(req.user!, req.body) }));

export const listRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await reviews.listRestaurantReviews(req.params.restaurantId, req.query as any);
  res.json({ success: true, data, meta });
});
export const listFood = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await reviews.listFoodReviews(req.params.foodItemId, req.query as any);
  res.json({ success: true, data, meta });
});

export const updateRestaurant = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await reviews.updateReview('restaurant', req.params.id, req.user!, req.body) }));
export const updateFood = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await reviews.updateReview('food', req.params.id, req.user!, req.body) }));
export const removeRestaurant = asyncHandler(async (req: Request, res: Response) => {
  await reviews.deleteReview('restaurant', req.params.id, req.user!);
  res.json({ success: true, message: 'Review deleted' });
});
export const removeFood = asyncHandler(async (req: Request, res: Response) => {
  await reviews.deleteReview('food', req.params.id, req.user!);
  res.json({ success: true, message: 'Review deleted' });
});
