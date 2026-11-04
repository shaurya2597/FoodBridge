import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as c from '../controllers/saved.controller';

const r = Router();

r.use(authenticate, authorize('CUSTOMER'));

r.get('/', c.list);

r.post('/restaurants/:id', c.saveRestaurant);
r.delete('/restaurants/:id', c.removeRestaurant);

r.post('/foods/:id', c.saveFood);
r.delete('/foods/:id', c.removeFood);

export default r;