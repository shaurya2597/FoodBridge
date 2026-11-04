import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as v from '../validators/admin';
import * as c from '../controllers/admin.controller';

const r = Router();
// Every admin route requires a valid token AND the ADMIN role. Nothing here is reachable otherwise.
r.use(authenticate, authorize('ADMIN'));

r.get('/dashboard', c.dashboard);
r.get('/analytics', validate(v.analyticsQuery, 'query'), c.analytics);

r.get('/users', validate(v.adminUsersQuery, 'query'), c.users);
r.patch('/users/:id/block', validate(v.blockUserBody), c.blockUser);

r.get('/restaurants', validate(v.adminRestaurantsQuery, 'query'), c.restaurants);
r.patch('/restaurants/:id/status', validate(v.restaurantStatusBody), c.restaurantStatus);

r.get('/orders', validate(v.adminOrdersQuery, 'query'), c.orders);
r.get('/orders/:id', c.order);

r.get('/ngos', validate(v.adminNgosQuery, 'query'), c.ngos);
r.patch('/ngos/:id/verification', validate(v.verifyNgoBody), c.verifyNgo);

r.get('/donations', validate(v.adminDonationsQuery, 'query'), c.donations);
r.get('/donations/:id', c.donation);
r.post('/donations/:id/flag', validate(v.flagDonationBody), c.flagDonation);
r.post('/donations/:id/unflag', c.unflagDonation);
r.get('/donation-requests', validate(v.adminRequestsQuery, 'query'), c.donationRequests);

r.get('/complaints', validate(v.adminComplaintsQuery, 'query'), c.complaintList);
r.get('/complaints/:id', c.complaint);
r.patch('/complaints/:id', validate(v.updateComplaintBody), c.updateComplaint);

r.get('/audit-logs', validate(v.auditQuery, 'query'), c.auditLogs);
export default r;
