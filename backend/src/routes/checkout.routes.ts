import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { previewBody } from '../validators/order';
import * as c from '../controllers/checkout.controller';

const r = Router();
r.post('/preview', authenticate, authorize('CUSTOMER'), validate(previewBody), c.preview);
export default r;
