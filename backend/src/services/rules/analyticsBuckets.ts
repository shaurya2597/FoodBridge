/** Day bucketing for the admin charts. India has no daylight saving, so a fixed +05:30 offset is exact. */
const IST_OFFSET_MS = 5.5 * 3600_000;

export const istDayKey = (d: Date): string => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The last `days` calendar days in IST (oldest first), and the UTC instant the first one starts. */
export function istDayRange(now: Date, days: number): { keys: string[]; since: Date } {
  const todayKey = istDayKey(now);
  const [y, m, d] = todayKey.split('-').map(Number);
  const todayStartUtcMs = Date.UTC(y, m - 1, d) - IST_OFFSET_MS;
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(istDayKey(new Date(todayStartUtcMs + IST_OFFSET_MS - i * 86_400_000)));
  return { keys, since: new Date(todayStartUtcMs - (days - 1) * 86_400_000) };
}

export interface OrderRow { createdAt: Date; total: number; status: string; paymentStatus: string | null }
export interface DonationRow { createdAt: Date; servings: number; status: string }

/** Orders and revenue per day. Revenue counts only money actually received on orders that were not cancelled. */
export function bucketOrders(rows: OrderRow[], keys: string[]) {
  const map = new Map(keys.map((k) => [k, { date: k, orders: 0, cancelled: 0, revenue: 0 }]));
  for (const r of rows) {
    const b = map.get(istDayKey(r.createdAt));
    if (!b) continue;
    b.orders += 1;
    if (r.status === 'CANCELLED') b.cancelled += 1;
    else if (r.paymentStatus === 'PAID') b.revenue += r.total;
  }
  return [...map.values()].map((b) => ({ ...b, revenue: Math.round(b.revenue * 100) / 100 }));
}

export function bucketDonations(rows: DonationRow[], keys: string[]) {
  const map = new Map(keys.map((k) => [k, { date: k, donations: 0, servingsPosted: 0 }]));
  for (const r of rows) {
    const b = map.get(istDayKey(r.createdAt));
    if (!b) continue;
    b.donations += 1;
    b.servingsPosted += r.servings;
  }
  return [...map.values()];
}
