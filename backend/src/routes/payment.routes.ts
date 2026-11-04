import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paymentFailedBody, verifyPaymentBody } from '../validators/payment';
import * as c from '../controllers/payment.controller';

const r = Router();
r.use(authenticate, authorize('CUSTOMER'));
r.post('/orders/:orderId/create', c.create);
r.post('/orders/:orderId/verify', validate(verifyPaymentBody), c.verify);
r.post('/orders/:orderId/failed', validate(paymentFailedBody), c.failed);
export default r;
