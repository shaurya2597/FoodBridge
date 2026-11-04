import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as assistance from '../services/assistanceService';

export const create = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json({ success: true, data: await assistance.createAssistance(req.user, req.body) }));

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await assistance.listAssistance(req.user!, req.query);
  res.json({ success: true, data, meta });
});

export const getOne = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await assistance.getAssistance(req.user, req.params.id) }));

export const updateStatus = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await assistance.changeAssistanceStatus(req.user!, req.params.id, req.body.status, req.body.note) }));
