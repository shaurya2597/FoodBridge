import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { quoteCart, quoteToResponse } from '../services/cartPricing';
import * as cart from '../services/cartService';

const view = async (userId: string) => ({ success: true, data: quoteToResponse(await quoteCart(prisma, userId)) });

export const get = asyncHandler(async (req: Request, res: Response) => res.json(await view(req.user!.id)));

export const add = asyncHandler(async (req: Request, res: Response) => {
  await cart.addToCart(req.user!.id, req.body);
  res.status(201).json(await view(req.user!.id));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  await cart.setQuantity(req.user!.id, req.params.itemId, req.body.quantity);
  res.json(await view(req.user!.id));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await cart.removeItem(req.user!.id, req.params.itemId);
  res.json(await view(req.user!.id));
});

export const clear = asyncHandler(async (req: Request, res: Response) => {
  await cart.clearCart(req.user!.id);
  res.json(await view(req.user!.id));
});
