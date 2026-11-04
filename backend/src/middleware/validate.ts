import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validates req.body / req.query / req.params and replaces it with the parsed (coerced,
 * stripped, defaulted) value. In Express 5 req.query is a getter-only property, so plain
 * assignment throws; defineProperty works on Express 4 and 5.
 */
export const validate =
  (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    Object.defineProperty(req, source, {
      value: result.data, writable: true, configurable: true, enumerable: true,
    });
    next();
  };
