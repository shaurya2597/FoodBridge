import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  res.json({ success: true, data });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const data = await prisma.$transaction(async (tx) => {
    if (req.body.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...req.body, userId } });
  });
  res.status(201).json({ success: true, data });
});

/** Both handlers look the address up by id AND owner, so other people's addresses always look like 404. */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const data = await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) throw new AppError(404, 'Address not found');
    if (req.body.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.update({ where: { id: existing.id }, data: req.body });
  });
  res.json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const done = await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  if (done.count !== 1) throw new AppError(404, 'Address not found');
  res.json({ success: true, message: 'Address deleted' }); // past orders keep their own copy of the address text
});
