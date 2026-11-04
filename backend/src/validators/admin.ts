import { z } from 'zod';
import { COMPLAINT_CATEGORIES } from '../services/rules/complaintRules';
import { paginationQuery } from './common';

const bool = z.enum(['true', 'false']);
const q = z.string().trim().min(1).max(80).optional();

export const adminUsersQuery = z.object({
  q, role: z.enum(['CUSTOMER', 'RESTAURANT_OWNER', 'NGO', 'ADMIN']).optional(), blocked: bool.optional(), ...paginationQuery,
});
export const blockUserBody = z.object({ blocked: z.boolean(), reason: z.string().trim().min(3).max(200).optional() })
  .refine((d) => !d.blocked || !!d.reason, { message: 'A reason is required when blocking a user', path: ['reason'] });

export const adminRestaurantsQuery = z.object({
  q, status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(), city: z.string().trim().min(1).max(60).optional(), ...paginationQuery,
});
export const restaurantStatusBody = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']), reason: z.string().trim().min(3).max(300).optional() });

export const adminOrdersQuery = z.object({
  q, status: z.enum(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  paymentMethod: z.enum(['COD', 'UPI', 'RAZORPAY']).optional(),
  restaurantId: z.string().min(1).max(40).optional(), userId: z.string().min(1).max(40).optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(), ...paginationQuery,
}).refine((d) => !d.from || !d.to || d.from <= d.to, { message: '"from" must not be after "to"', path: ['from'] });

export const adminNgosQuery = z.object({ q, verified: bool.optional(), ...paginationQuery });
export const verifyNgoBody = z.object({ verified: z.boolean(), note: z.string().trim().min(3).max(300).optional() });

export const adminDonationsQuery = z.object({
  q, status: z.enum(['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED', 'EXPIRED', 'FLAGGED', 'CANCELLED']).optional(),
  city: z.string().trim().min(1).max(60).optional(), donorType: z.enum(['INDIVIDUAL', 'RESTAURANT']).optional(),
  ngoId: z.string().min(1).max(40).optional(), expired: bool.optional(), ...paginationQuery,
});
export const flagDonationBody = z.object({ reason: z.string().trim().min(3).max(300) });
export const adminRequestsQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN']).optional(), ngoId: z.string().min(1).max(40).optional(), ...paginationQuery,
});

export const adminComplaintsQuery = z.object({
  q, status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED']).optional(), category: z.enum(COMPLAINT_CATEGORIES).optional(), ...paginationQuery,
});
export const updateComplaintBody = z.object({ status: z.enum(['IN_REVIEW', 'RESOLVED', 'REJECTED']), resolution: z.string().trim().min(5).max(1000).optional() });

export const analyticsQuery = z.object({
  days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d), 'days must be 7, 30 or 90').default(30),
});
export const auditQuery = z.object({
  entityType: z.enum(['USER', 'RESTAURANT', 'NGO', 'DONATION', 'COMPLAINT']).optional(), adminId: z.string().min(1).max(40).optional(), ...paginationQuery,
});

export const createComplaintBody = z.object({
  category: z.enum(COMPLAINT_CATEGORIES), subject: z.string().trim().min(5).max(120), details: z.string().trim().min(10).max(1000),
  orderId: z.string().min(1).max(40).optional(), donationId: z.string().min(1).max(40).optional(),
}).refine((d) => !(d.orderId && d.donationId), { message: 'Link the complaint to an order or a donation, not both', path: ['donationId'] });
export const complaintListQuery = z.object({ status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED']).optional(), ...paginationQuery });
