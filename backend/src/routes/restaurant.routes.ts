import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { restaurantBody, restaurantQuery, restaurantUpdate } from '../validators/restaurant';
import * as c from '../controllers/restaurant.controller';

const r = Router();
r.get('/mine', authenticate, authorize('RESTAURANT_OWNER', 'ADMIN'), c.mine);
r.get('/', validate(restaurantQuery, 'query'), c.list);
r.get('/:id', optionalAuth, c.getOne);
r.post('/', authenticate, authorize('RESTAURANT_OWNER', 'ADMIN'), validate(restaurantBody), c.create);
r.put('/:id', authenticate, authorize('RESTAURANT_OWNER', 'ADMIN'), validate(restaurantUpdate), c.update);
r.delete('/:id', authenticate, authorize('RESTAURANT_OWNER', 'ADMIN'), c.remove);
export default r;
