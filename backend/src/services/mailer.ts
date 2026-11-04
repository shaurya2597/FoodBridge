import nodemailer from 'nodemailer';
import { env, smtpEnabled } from '../config/env';

/**
 * Sends the password-reset email through SMTP when configured. Without SMTP it runs in DEMO mode:
 * the link is printed to the server console only (it is never put in an API response unless the
 * explicit, non-production DEMO_RETURN_RESET_TOKEN switch is on).
 */
export async function sendPasswordResetEmail(to: string, link: string): Promise<'sent' | 'demo' | 'failed'> {
  if (!smtpEnabled) {
    console.log(`[DEMO MAIL] Password reset requested for ${to}\n[DEMO MAIL] Link (valid 30 minutes): ${link}`);
    return 'demo';
  }
  try {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    await transport.sendMail({
      from: env.MAIL_FROM, to, subject: 'Reset your FoodBridge password',
      text: `We received a request to reset your password.\n\nOpen this link within 30 minutes:\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    });
    return 'sent';
  } catch (e) {
    console.error('Password reset email failed:', (e as Error).message); // never log the link or credentials
    return 'failed';
  }
}
