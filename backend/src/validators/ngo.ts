import { z } from 'zod';

// registrationNo and isVerified are deliberately NOT editable here: changing them would let an NGO dodge verification.
export const updateNgoProfileBody = z.object({
  orgName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  serviceCity: z.string().trim().min(2).max(60),
  serviceArea: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).partial().refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });
