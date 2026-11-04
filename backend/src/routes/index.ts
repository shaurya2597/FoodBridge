import { Router } from 'express';
import auth from './auth.routes';
import restaurants from './restaurant.routes';
import foods from './food.routes';
import cart from './cart.routes';
import checkout from './checkout.routes';
import orders from './order.routes';
import payments from './payment.routes';
import reviews from './review.routes';
import addresses from './address.routes';
import donations from './donation.routes';
import assistance from './assistance.routes';
import ngo from './ngo.routes';
import admin from './admin.routes';
import complaintsRoutes from './complaint.routes';
import { demoPaymentsAllowed, razorpayEnabled } from '../config/env';
import { prisma } from '../config/prisma';

const r = Router();
r.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'up';
  try { await prisma.$queryRaw`SELECT 1`; } catch { database = 'down'; }
  res.status(database === 'up' ? 200 : 503).json({
    success: database === 'up', status: database === 'up' ? 'ok' : 'degraded', database,
    razorpay: razorpayEnabled ? 'test-keys' : 'demo',
    demoPayments: demoPaymentsAllowed,
  });
});
r.use('/auth', auth);
r.use('/restaurants', restaurants);
r.use('/foods', foods);
r.use('/cart', cart);
r.use('/checkout', checkout);
r.use('/orders', orders);
r.use('/payments', payments);
r.use('/reviews', reviews);
r.use('/addresses', addresses);
r.use('/donations', donations);
r.use('/assistance', assistance);
r.use('/ngo', ngo);
r.use('/admin', admin);
r.use('/complaints', complaintsRoutes);
export default r;
