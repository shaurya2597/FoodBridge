import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { assistanceListQuery, assistanceStatusBody, createAssistanceBody } from '../validators/assistance';
import * as c from '../controllers/assistance.controller';

// People in need may not have accounts, so creating a request is public. Throttle it per IP to limit abuse.
// Production: 10 per hour per IP. The integration tests send every request from one IP (and count invalid
// requests too, because the limiter runs before validation), so they get a much higher ceiling.
const CREATE_LIMIT_PER_HOUR = env.NODE_ENV === 'test' ? 1000 : 10;
const createLimiter = rateLimit({ windowMs: 60 * 60_000, limit: CREATE_LIMIT_PER_HOUR, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests from this network, please try again later' } });

const r = Router();
r.post('/', optionalAuth, createLimiter, validate(createAssistanceBody), c.create);
r.get('/', authenticate, authorize('CUSTOMER', 'RESTAURANT_OWNER', 'NGO', 'ADMIN'), validate(assistanceListQuery, 'query'), c.list);
r.get('/:id', optionalAuth, c.getOne);
r.patch('/:id/status', authenticate, authorize('CUSTOMER', 'RESTAURANT_OWNER', 'NGO'), validate(assistanceStatusBody), c.updateStatus);
export default r;
