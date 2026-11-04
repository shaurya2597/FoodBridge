
import { z } from 'zod';
import { BCRYPT_LIMIT_MESSAGE, withinBcryptLimit } from './common';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password needs a letter')
    .regex(/\d/, 'Password needs a number')
    .refine(withinBcryptLimit, BCRYPT_LIMIT_MESSAGE),
  // ADMIN can never be self-assigned.
  role: z.enum(['CUSTOMER', 'RESTAURANT_OWNER', 'NGO']).default('CUSTOMER'),
  ngo: z.object({
    orgName: z.string().trim().min(2).max(120),
    registrationNo: z.string().trim().toUpperCase().min(4).max(40).optional(),
    contactPhone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
    serviceCity: z.string().trim().min(2).max(60),
    serviceArea: z.string().trim().max(120).optional(),
  }).optional(),
}).refine((d) => d.role !== 'NGO' || d.ngo, {
  message: 'NGO details are required',
  path: ['ngo'],
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).refine(withinBcryptLimit, BCRYPT_LIMIT_MESSAGE),
});

const newPassword = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number')
  .refine(withinBcryptLimit, BCRYPT_LIMIT_MESSAGE);

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().length(64).regex(/^[a-f0-9]+$/),
  password: newPassword,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).refine(withinBcryptLimit, BCRYPT_LIMIT_MESSAGE),
  newPassword,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').nullable().optional(),
}).refine((d) => d.name !== undefined || d.phone !== undefined, {
  message: 'Nothing to update',
});
