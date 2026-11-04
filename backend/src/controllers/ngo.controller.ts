import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as ngo from '../services/ngoService';

export const getProfile = asyncHandler(async (req: Request, res: Response) => res.json({ success: true, data: await ngo.getProfile(req.user!) }));
export const updateProfile = asyncHandler(async (req: Request, res: Response) => res.json({ success: true, data: await ngo.updateProfile(req.user!, req.body) }));
export const summary = asyncHandler(async (req: Request, res: Response) => res.json({ success: true, data: await ngo.getNgoSummary(req.user!) }));
