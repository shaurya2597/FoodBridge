import { env } from '../config/env';
import { AppError } from '../utils/AppError';

/**
 * Minimal Razorpay REST client (Orders API only). No SDK needed, and the secret never leaves the server.
 * Only rzp_test_ keys are accepted (enforced in config/env.ts).
 */
export async function createRazorpayOrder(args: { amountPaise: number; receipt: string }): Promise<{ id: string }> {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let res: Response;
  try {
    res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: args.amountPaise, currency: 'INR', receipt: args.receipt.slice(0, 40) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError(502, 'Payment provider is unreachable, please try again');
  }
  if (!res.ok) {
    console.error('Razorpay order creation failed with status', res.status); // never log the body or credentials
    throw new AppError(502, 'Payment provider rejected the request');
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new AppError(502, 'Unexpected response from payment provider');
  return { id: body.id };
}
