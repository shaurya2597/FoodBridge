import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createFoodReviewBody, createRestaurantReviewBody, reviewListQuery, updateReviewBody } from '../validators/review';
import * as c from '../controllers/review.controller';

const r = Router();
// public reads
r.get('/restaurants/:restaurantId', validate(reviewListQuery, 'query'), c.listRestaurant);
r.get('/foods/:foodItemId', validate(reviewListQuery, 'query'), c.listFood);
// writes
r.post('/restaurants', authenticate, authorize('CUSTOMER'), validate(createRestaurantReviewBody), c.createRestaurant);
r.post('/foods', authenticate, authorize('CUSTOMER'), validate(createFoodReviewBody), c.createFood);
r.put('/restaurants/:id', authenticate, authorize('CUSTOMER'), validate(updateReviewBody), c.updateRestaurant);
r.put('/foods/:id', authenticate, authorize('CUSTOMER'), validate(updateReviewBody), c.updateFood);
r.delete('/restaurants/:id', authenticate, authorize('CUSTOMER', 'ADMIN'), c.removeRestaurant);
r.delete('/foods/:id', authenticate, authorize('CUSTOMER', 'ADMIN'), c.removeFood);
export default r;
