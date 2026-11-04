import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { cancelBody, orderListQuery, placeOrderBody, updateStatusBody } from '../validators/order';
import * as c from '../controllers/order.controller';

const placeLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many orders, slow down' } });

const r = Router();
r.use(authenticate);
r.post('/', authorize('CUSTOMER'), placeLimiter, validate(placeOrderBody), c.place);
r.get('/', authorize('CUSTOMER', 'RESTAURANT_OWNER', 'ADMIN'), validate(orderListQuery, 'query'), c.list);
r.get('/:id', authorize('CUSTOMER', 'RESTAURANT_OWNER', 'ADMIN'), c.getOne);
r.patch('/:id/status', authorize('RESTAURANT_OWNER', 'ADMIN'), validate(updateStatusBody), c.updateStatus);
r.post('/:id/cancel', authorize('CUSTOMER', 'RESTAURANT_OWNER', 'ADMIN'), validate(cancelBody), c.cancel);
export default r;
