import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as orders from '../services/orderService';

export const place = asyncHandler(async (req: Request, res: Response) => {
  const data = await orders.placeOrder(req.user!, req.body);
  res.status(201).json({
    success: true, data,
    next: data.payment && data.payment.method !== 'COD'
      ? { action: 'PAY_ONLINE', endpoint: `/api/payments/orders/${data.id}/create` }
      : { action: 'NONE', message: 'Pay cash on delivery' },
  });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await orders.listOrders(req.user!, req.query as any);
  res.json({ success: true, data, meta });
});

export const getOne = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await orders.getOrder(req.user!, req.params.id) }));

export const updateStatus = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await orders.changeOrderStatus(req.user!, req.params.id, req.body.status, req.body.reason) }));

export const cancel = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await orders.changeOrderStatus(req.user!, req.params.id, 'CANCELLED', req.body.reason) }));
