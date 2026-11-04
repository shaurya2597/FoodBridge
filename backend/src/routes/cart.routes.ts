import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addCartItemBody, updateCartItemBody } from '../validators/cart';
import * as c from '../controllers/cart.controller';

const r = Router();
r.use(authenticate, authorize('CUSTOMER'));
r.get('/', c.get);
r.post('/items', validate(addCartItemBody), c.add);
r.patch('/items/:itemId', validate(updateCartItemBody), c.update);
r.delete('/items/:itemId', c.remove);
r.delete('/', c.clear);
export default r;
