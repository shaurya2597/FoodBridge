import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createDonationBody, donationListQuery, donationStatusBody, requestDonationBody } from '../validators/donation';
import * as c from '../controllers/donation.controller';

const postLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many donations posted, please try again later' } });

const r = Router();
// Public (limited view) and role-aware: the service decides what each caller may see.
r.get('/', optionalAuth, validate(donationListQuery, 'query'), c.list);
r.get('/:id', optionalAuth, c.getOne);
r.post('/', authenticate, authorize('CUSTOMER', 'RESTAURANT_OWNER'), postLimiter, validate(createDonationBody), c.create);
r.post('/:id/request', authenticate, authorize('NGO'), validate(requestDonationBody), c.request);
// ADMIN is allowed through the role gate on purpose: changeDonationStatus recognises only the donor and the
// holding NGO as actors, so an admin gets the same 404 as any other stranger. Admins stay read-only in Phase 3.
r.patch('/:id/status', authenticate, authorize('CUSTOMER', 'RESTAURANT_OWNER', 'NGO', 'ADMIN'), validate(donationStatusBody), c.updateStatus);
export default r;
