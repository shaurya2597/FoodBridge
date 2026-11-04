/** "HH:mm" strings in the restaurant's local time (default India). Handles overnight hours (e.g. 18:00-02:00). */
export function minutesInTimeZone(now: Date, timeZone = 'Asia/Kolkata'): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function isWithinOpeningHours(opensAt: string, closesAt: string, now: Date, timeZone = 'Asia/Kolkata'): boolean {
  const open = toMinutes(opensAt);
  const close = toMinutes(closesAt);
  const cur = minutesInTimeZone(now, timeZone);
  if (open === close) return true; // treated as open 24h
  return open < close ? cur >= open && cur < close : cur >= open || cur < close;
}
