import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { env } from '../config/env';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, updateProfileSchema } from '../validators/auth';
import * as ctrl from '../controllers/auth.controller';

const opts = { standardHeaders: true, legacyHeaders: false } as const;
const message = { success: false, message: 'Too many attempts, please try again later' };
// Only failed logins count, so normal use is never throttled but brute force is.
const loginLimiter = rateLimit({ ...opts, windowMs: 15 * 60_000, limit: 20, skipSuccessfulRequests: true, message });
const registerLimiter = rateLimit({ ...opts, windowMs: 60 * 60_000, limit: 20, message });

// Per IP, per hour. Tests send everything from one IP, so they get a high ceiling; production limits are unchanged.
const hourly = (limit: number) => rateLimit({ ...opts, windowMs: 60 * 60_000, limit: env.NODE_ENV === 'test' ? 1000 : limit, message });
const forgotLimiter = hourly(5);
const resetLimiter = hourly(10);

const r = Router();
r.post('/register', registerLimiter, validate(registerSchema), ctrl.register);
r.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
r.post('/logout', ctrl.logout);
r.get('/me', authenticate, ctrl.me);
r.put('/me', authenticate, validate(updateProfileSchema), ctrl.updateProfile);
r.post('/forgot-password', forgotLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
r.post('/reset-password', resetLimiter, validate(resetPasswordSchema), ctrl.resetPassword);
r.post('/change-password', authenticate, resetLimiter, validate(changePasswordSchema), ctrl.changePassword);
r.post('/logout-all', authenticate, ctrl.logoutAll);
export default r;
