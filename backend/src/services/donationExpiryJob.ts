import { expireStaleDonations } from './donationService';

/** Runs the expiry sweep now and then every minute. The timer does not keep the process alive. */
export function startDonationExpiryJob(intervalMs = 60_000) {
  const run = () => expireStaleDonations().then((n) => { if (n) console.log(`Expired ${n} donation(s)`); }).catch((e) => console.error('Donation expiry sweep failed:', e?.message ?? e));
  void run();
  const timer = setInterval(run, intervalMs) as unknown as { unref?: () => void };
  timer.unref?.(); // never keep the process alive just for this
  return () => clearInterval(timer as unknown as Parameters<typeof clearInterval>[0]);
}
