import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { complaintListQuery, createComplaintBody } from '../validators/admin';
import * as c from '../controllers/admin.controller';

const createLimiter = rateLimit({ windowMs: 60 * 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many complaints, please try again later' } });

const r = Router();
r.use(authenticate); // any logged-in role; each person sees only their own complaints
r.post('/', createLimiter, validate(createComplaintBody), c.createMyComplaint);
r.get('/', validate(complaintListQuery, 'query'), c.listMyComplaints);
r.get('/:id', c.getMyComplaint);
export default r;
