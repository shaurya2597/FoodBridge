import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

export const notFound = (req: Request, _res: Response, next: NextFunction) =>
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false, message: 'Validation failed',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'A record with this value already exists' });
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Record not found' });
    if (err.code === 'P2003') return res.status(409).json({ success: false, message: 'This action conflicts with related records' });
  }
  // Errors raised by express itself (malformed JSON, payload too large, ...) carry a 4xx status.
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const type = (err as { type?: string }).type;
    return res.status(status).json({
      success: false,
      message: type === 'entity.parse.failed' ? 'Malformed JSON body' : type === 'entity.too.large' ? 'Request body too large' : 'Bad request',
    });
  }
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Something went wrong',
    ...(env.NODE_ENV === 'development' && { debug: String((err as Error)?.message) }),
  });
}
