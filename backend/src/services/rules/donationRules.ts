/** Food-safety rules for donations. Pure functions: easy to test, shared by validators and services. */

export const DONATION_CATEGORIES = ['Cooked meal', 'Bakery', 'Packaged food', 'Fruits & vegetables', 'Beverages', 'Other'] as const;
export type DonationCategory = (typeof DONATION_CATEGORIES)[number];

/** NGOs need time to arrange pickup, so a donation must stay collectable for at least this long. */
export const MIN_COLLECTION_WINDOW_MINUTES = 30;
/** Allowed clock difference between the donor's device and the server when saying "prepared at". */
export const CLOCK_SKEW_MINUTES = 5;

/** Longest time between preparation and the consume-before time. Cooked food is the riskiest. */
export const maxShelfLifeHours = (category: string): number =>
  category === 'Cooked meal' ? 12 : category === 'Beverages' || category === 'Bakery' ? 48 : 24 * 7;

export interface TimingProblem { field: 'preparedAt' | 'expiresAt'; message: string }

export function validateDonationTiming(args: { category: string; preparedAt: Date; expiresAt: Date; now: Date }): TimingProblem[] {
  const { category, preparedAt, expiresAt, now } = args;
  const problems: TimingProblem[] = [];
  const min = 60_000;
  if (preparedAt.getTime() > now.getTime() + CLOCK_SKEW_MINUTES * min)
    problems.push({ field: 'preparedAt', message: 'Preparation time cannot be in the future' });
  if (expiresAt.getTime() <= now.getTime())
    problems.push({ field: 'expiresAt', message: 'This food has already expired and cannot be donated' });
  else if (expiresAt.getTime() < now.getTime() + MIN_COLLECTION_WINDOW_MINUTES * min)
    problems.push({ field: 'expiresAt', message: `Food must stay safe to collect for at least ${MIN_COLLECTION_WINDOW_MINUTES} more minutes` });
  if (expiresAt.getTime() <= preparedAt.getTime())
    problems.push({ field: 'expiresAt', message: 'Consume-before time must be after the preparation time' });
  else {
    const hours = (expiresAt.getTime() - preparedAt.getTime()) / (60 * min);
    const limit = maxShelfLifeHours(category);
    if (hours > limit)
      problems.push({ field: 'expiresAt', message: `${category} can be donated for at most ${limit} hours after it was prepared` });
  }
  return problems;
}

export const isExpired = (expiresAt: Date, now: Date) => expiresAt.getTime() <= now.getTime();
