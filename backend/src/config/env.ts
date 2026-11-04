import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  // Number of reverse proxies in front of the API (0 = none). Needed for correct client IPs in rate limiting.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  // Pricing (Phase 2)
  TAX_RATE_PERCENT: z.coerce.number().min(0).max(30).default(5),
  PLATFORM_FEE: z.coerce.number().min(0).max(100).default(5), // rupees
  ENFORCE_OPENING_HOURS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  // Demo payments (no real money). Defaults to on outside production.
  ALLOW_DEMO_PAYMENTS: z.enum(['true', 'false']).optional(),
  // Password-reset email. Without SMTP the reset link is printed to the server console (demo mode).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('FoodBridge <no-reply@foodbridge.local>'),
  // DEMO ONLY: return the reset token in the API response so you can demo the flow without email. Never in production.
  DEMO_RETURN_RESET_TOKEN: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
}).superRefine((v, ctx) => {
  if (v.NODE_ENV === 'production' && v.DEMO_RETURN_RESET_TOKEN)
    ctx.addIssue({ code: 'custom', path: ['DEMO_RETURN_RESET_TOKEN'], message: 'DEMO_RETURN_RESET_TOKEN must be false in production' });
  if (v.RAZORPAY_KEY_ID?.startsWith('rzp_live_'))
    ctx.addIssue({ code: 'custom', path: ['RAZORPAY_KEY_ID'], message: 'Live Razorpay keys are not allowed in this project. Use rzp_test_ keys.' });
  if (v.NODE_ENV === 'production' && (v.JWT_SECRET.length < 32 || /change-?me/i.test(v.JWT_SECRET)))
    ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Use a random secret of 32+ characters in production' });
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}
export const env = parsed.data;
export const clientOrigins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
export const smtpEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
export const razorpayEnabled = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
export const demoPaymentsAllowed = env.ALLOW_DEMO_PAYMENTS ? env.ALLOW_DEMO_PAYMENTS === 'true' : env.NODE_ENV !== 'production';
