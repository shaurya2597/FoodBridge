import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateNgoProfileBody } from '../validators/ngo';
import * as c from '../controllers/ngo.controller';

const r = Router();
r.use(authenticate, authorize('NGO'));
r.get('/profile', c.getProfile);
r.put('/profile', validate(updateNgoProfileBody), c.updateProfile);
r.get('/summary', c.summary);
export default r;
