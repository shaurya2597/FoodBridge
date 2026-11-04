import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as payments from '../services/paymentService';

export const create = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await payments.createPayment(req.user!, req.params.orderId) }));

export const verify = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await payments.verifyPayment(req.user!, req.params.orderId, req.body) }));

export const failed = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await payments.reportPaymentFailed(req.user!, req.params.orderId, req.body.reason, req.body.description) }));
