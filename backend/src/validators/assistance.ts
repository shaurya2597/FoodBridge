import { z } from 'zod';
import { REQUIREMENT_OPTIONS } from '../services/rules/assistanceRules';
import { paginationQuery } from './common';

export const createAssistanceBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  people: z.number().int().min(1).max(500),
  requirements: z.array(z.enum(REQUIREMENT_OPTIONS)).min(1).max(5),
  foodType: z.enum(['VEG', 'NON_VEG']).optional(),
  location: z.string().trim().min(5).max(250),
  city: z.string().trim().min(2).max(60),
  notes: z.string().trim().max(300).optional(),
});

export const assistanceListQuery = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'FULFILLED', 'CLOSED']).optional(),
  mine: z.enum(['true', 'false']).optional(),
  city: z.string().trim().min(1).max(60).optional(),
  ...paginationQuery,
});

export const assistanceStatusBody = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'FULFILLED', 'CLOSED']),
  note: z.string().trim().min(3).max(200).optional(),
});
