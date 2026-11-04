import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { foodBody, foodQuery, foodUpdate } from '../validators/restaurant';
import * as c from '../controllers/food.controller';

const r = Router();
r.get('/', optionalAuth, validate(foodQuery, 'query'), c.list);
r.get('/:id', optionalAuth, c.getOne);
r.post('/', authenticate, authorize('RESTAURANT_OWNER', 'ADMIN'), validate(foodBody), c.create);
r.put('/:id', authenticate, authorize('RESTAURANT_OWNER', 'ADMIN'), validate(foodUpdate), c.update);
r.delete('/:id', authenticate, authorize('RESTAURANT_OWNER', 'ADMIN'), c.remove);
export default r;
