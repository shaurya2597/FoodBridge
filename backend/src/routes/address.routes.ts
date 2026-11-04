import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addressBody, updateAddressBody } from '../validators/order';
import * as c from '../controllers/address.controller';

const r = Router();
r.use(authenticate, authorize('CUSTOMER'));
r.get('/', c.list);
r.post('/', validate(addressBody), c.create);
r.put('/:id', validate(updateAddressBody), c.update);
r.delete('/:id', c.remove);
export default r;
