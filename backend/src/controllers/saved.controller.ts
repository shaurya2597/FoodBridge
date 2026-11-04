import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as saved from '../services/savedService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await saved.listSaved(req.user!.id);
  res.json({ success: true, data });
});

export const saveRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const data = await saved.saveRestaurant(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const removeRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const data = await saved.removeRestaurant(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const saveFood = asyncHandler(async (req: Request, res: Response) => {
  const data = await saved.saveFood(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const removeFood = asyncHandler(async (req: Request, res: Response) => {
  const data = await saved.removeFood(req.user!.id, req.params.id);
  res.json({ success: true, data });
});