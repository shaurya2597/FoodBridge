import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as donations from '../services/donationService';

export const create = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json({ success: true, data: await donations.createDonation(req.user!, req.body) }));

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await donations.listDonations(req.user, req.query);
  res.json({ success: true, data, meta });
});

export const getOne = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await donations.getDonation(req.user, req.params.id) }));

export const request = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json({ success: true, data: await donations.requestDonation(req.user!, req.params.id, req.body.message) }));

export const updateStatus = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: await donations.changeDonationStatus(req.user!, req.params.id, req.body) }));
