import { z } from 'zod';
import { paginationQuery } from './common';

export const inlineAddress = z.object({
  label: z.string().trim().max(30).default('Home'),
  line1: z.string().trim().min(5).max(150),
  line2: z.string().trim().max(150).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
});

const couponCode = z.string().trim().toUpperCase().min(3).max(30).regex(/^[A-Z0-9_-]+$/, 'Invalid coupon code');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

/** Either a saved address id or a new address, never both, never neither. */
const addressChoice = z.object({ addressId: z.string().min(1).max(40).optional(), address: inlineAddress.optional() });

export const previewBody = addressChoice.extend({ couponCode: couponCode.optional() })
  .refine((d) => !(d.addressId && d.address), { message: 'Send addressId or address, not both', path: ['address'] });

export const placeOrderBody = addressChoice.extend({
  saveAddress: z.boolean().default(false),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: phone,
  instructions: z.string().trim().max(300).optional(),
  couponCode: couponCode.optional(),
  paymentMethod: z.enum(['COD', 'UPI', 'RAZORPAY']),
}).refine((d) => Boolean(d.addressId) !== Boolean(d.address), { message: 'Send exactly one of addressId or address', path: ['address'] });

export const orderListQuery = z.object({
  status: z.enum(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']).optional(),
  active: z.enum(['true', 'false']).optional(), // "current orders" = not delivered/cancelled
  restaurantId: z.string().min(1).max(40).optional(), // owners/admins only
  ...paginationQuery,
});

export const updateStatusBody = z.object({
  status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  reason: z.string().trim().min(3).max(200).optional(),
});

export const cancelBody = z.object({ reason: z.string().trim().min(3).max(200).optional() });

export const addressBody = inlineAddress.extend({ isDefault: z.boolean().default(false) });

export const updateAddressBody = inlineAddress.partial().extend({ isDefault: z.boolean().optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });
