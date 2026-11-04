import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRestaurantStatusChange, RestaurantStatus } from '../../src/services/rules/restaurantModeration';
import { checkComplaintTransition, ComplaintStatus } from '../../src/services/rules/complaintRules';
import { checkFlag, statusAfterUnflag, FLAGGABLE } from '../../src/services/rules/donationModeration';
import { checkBlockTarget, isTokenCurrent } from '../../src/services/rules/adminRules';
import { generateResetToken, hashResetToken, isResetExpired, RESET_TOKEN_TTL_MINUTES } from '../../src/services/rules/resetToken';
import { bucketDonations, bucketOrders, istDayKey, istDayRange } from '../../src/services/rules/analyticsBuckets';

describe('restaurant moderation', () => {
  test('pending restaurants can be approved or rejected', () => {
    assert.equal(checkRestaurantStatusChange('PENDING', 'APPROVED').ok, true);
    assert.equal(checkRestaurantStatusChange('PENDING', 'REJECTED', 'Incomplete documents').ok, true);
  });
  test('rejecting and suspending need a reason', () => {
    for (const [f, t] of [['PENDING', 'REJECTED'], ['APPROVED', 'SUSPENDED']] as const) {
      assert.equal((checkRestaurantStatusChange(f, t) as any).httpStatus, 400, `${f}->${t}`);
      assert.equal(checkRestaurantStatusChange(f, t, '  ').ok, false);
      assert.equal(checkRestaurantStatusChange(f, t, 'Hygiene complaint').ok, true);
    }
  });
  test('suspended and rejected restaurants can be reinstated', () => {
    assert.equal(checkRestaurantStatusChange('SUSPENDED', 'APPROVED').ok, true);
    assert.equal(checkRestaurantStatusChange('REJECTED', 'APPROVED').ok, true);
  });
  test('nonsensical moves are refused', () => {
    for (const [f, t] of [['PENDING', 'SUSPENDED'], ['APPROVED', 'REJECTED'], ['APPROVED', 'PENDING'], ['SUSPENDED', 'REJECTED'], ['REJECTED', 'SUSPENDED']] as const)
      assert.equal((checkRestaurantStatusChange(f, t, 'reason here') as any).httpStatus, 409, `${f}->${t}`);
    assert.equal(checkRestaurantStatusChange('APPROVED', 'APPROVED').ok, false);
  });
  test('the transition table is exhaustive: every pair is either allowed or refused, never throws', () => {
    const all: RestaurantStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    for (const f of all) for (const t of all) assert.equal(typeof checkRestaurantStatusChange(f, t, 'some reason').ok, 'boolean');
  });
});

describe('complaint handling', () => {
  test('open complaints can be reviewed, resolved or rejected', () => {
    assert.equal(checkComplaintTransition('OPEN', 'IN_REVIEW').ok, true);
    assert.equal(checkComplaintTransition('IN_REVIEW', 'RESOLVED', 'Refund issued to customer').ok, true);
    assert.equal(checkComplaintTransition('OPEN', 'REJECTED', 'Not enough evidence').ok, true);
  });
  test('closing needs a real resolution message', () => {
    for (const to of ['RESOLVED', 'REJECTED'] as const) {
      assert.equal((checkComplaintTransition('IN_REVIEW', to) as any).httpStatus, 400);
      assert.equal(checkComplaintTransition('IN_REVIEW', to, 'ok').ok, false);
    }
  });
  test('closed complaints are frozen; no going back to review', () => {
    for (const f of ['RESOLVED', 'REJECTED'] as ComplaintStatus[])
      for (const t of ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'] as ComplaintStatus[]) assert.equal(checkComplaintTransition(f, t, 'long enough text').ok, false, `${f}->${t}`);
    assert.equal(checkComplaintTransition('IN_REVIEW', 'OPEN').ok, false);
  });
});

describe('flagging unsafe donations', () => {
  test('flaggable states and the reason requirement', () => {
    for (const s of FLAGGABLE) { assert.equal(checkFlag(s, 'Reported as spoiled').ok, true, s); assert.equal((checkFlag(s) as any).httpStatus, 400, s); }
    for (const s of ['DISTRIBUTED', 'CANCELLED', 'EXPIRED'] as const) assert.equal((checkFlag(s, 'reason') as any).httpStatus, 409, s);
    assert.match((checkFlag('FLAGGED', 'x y z') as any).message, /already flagged/);
  });
  const now = new Date('2026-11-01T12:00:00Z');
  const future = new Date('2026-11-01T15:00:00Z');
  test('unflagging returns an uncollected donation to the pool and releases the NGO', () => {
    const h = [{ status: 'POSTED' }, { status: 'NGO_REQUESTED' }, { status: 'ACCEPTED' }, { status: 'FLAGGED' }];
    assert.deepEqual(statusAfterUnflag(h, future, now), { status: 'POSTED', releaseNgo: true });
  });
  test('a donation flagged after collection goes back to COLLECTED, never re-offered', () => {
    const h = [{ status: 'POSTED' }, { status: 'NGO_REQUESTED' }, { status: 'ACCEPTED' }, { status: 'PICKUP_SCHEDULED' }, { status: 'COLLECTED' }, { status: 'FLAGGED' }];
    assert.deepEqual(statusAfterUnflag(h, future, now), { status: 'COLLECTED', releaseNgo: false });
  });
  test('a donation that expired while flagged becomes EXPIRED', () => {
    assert.deepEqual(statusAfterUnflag([{ status: 'POSTED' }, { status: 'FLAGGED' }], new Date('2026-11-01T11:00:00Z'), now), { status: 'EXPIRED', releaseNgo: true });
  });
  test('uses the most recent flag when a donation was flagged more than once', () => {
    const h = [{ status: 'POSTED' }, { status: 'FLAGGED' }, { status: 'POSTED' }, { status: 'NGO_REQUESTED' }, { status: 'ACCEPTED' }, { status: 'PICKUP_SCHEDULED' }, { status: 'COLLECTED' }, { status: 'FLAGGED' }];
    assert.equal(statusAfterUnflag(h, future, now).status, 'COLLECTED');
  });
  test('missing or malformed history falls back safely', () => {
    assert.equal(statusAfterUnflag(null, future, now).status, 'POSTED');
    assert.equal(statusAfterUnflag([], future, now).status, 'POSTED');
  });
});

describe('blocking users and revoking sessions', () => {
  test('admins cannot block themselves or other admins, but can unblock', () => {
    assert.equal((checkBlockTarget({ id: 'a1' }, { id: 'a1', role: 'ADMIN' }, true) as any).httpStatus, 400);
    assert.equal((checkBlockTarget({ id: 'a1' }, { id: 'a2', role: 'ADMIN' }, true) as any).httpStatus, 403);
    assert.equal(checkBlockTarget({ id: 'a1' }, { id: 'a2', role: 'ADMIN' }, false).ok, true);
  });
  test('ordinary users, owners and NGOs can be blocked', () => {
    for (const role of ['CUSTOMER', 'RESTAURANT_OWNER', 'NGO']) assert.equal(checkBlockTarget({ id: 'a1' }, { id: 'u1', role }, true).ok, true, role);
  });
  test('token versions: old tokens without a claim still work until a password change', () => {
    assert.equal(isTokenCurrent(undefined, 0), true);
    assert.equal(isTokenCurrent(0, 0), true);
    assert.equal(isTokenCurrent(undefined, 1), false); // password changed since this token was issued
    assert.equal(isTokenCurrent(1, 2), false);
    assert.equal(isTokenCurrent(3, 3), true);
  });
});

describe('password reset tokens', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  test('only the hash is stored, and it matches the emailed token', () => {
    const t = generateResetToken(now);
    assert.equal(t.token.length, 64);
    assert.notEqual(t.hash, t.token);
    assert.equal(hashResetToken(t.token), t.hash);
    assert.equal(t.hash.includes(t.token), false);
  });
  test('tokens are unique and expire after 30 minutes', () => {
    const a = generateResetToken(now); const b = generateResetToken(now);
    assert.notEqual(a.token, b.token);
    assert.equal(a.expiresAt.getTime() - now.getTime(), RESET_TOKEN_TTL_MINUTES * 60_000);
    assert.equal(isResetExpired(a.expiresAt, new Date(now.getTime() + 29 * 60_000)), false);
    assert.equal(isResetExpired(a.expiresAt, new Date(now.getTime() + 30 * 60_000)), true);
    assert.equal(isResetExpired(null, now), true);
  });
  test('a tampered token hashes differently', () => {
    const t = generateResetToken(now);
    assert.notEqual(hashResetToken(t.token.slice(0, -1) + (t.token.endsWith('a') ? 'b' : 'a')), t.hash);
  });
});

describe('analytics bucketing (India time)', () => {
  test('day keys use IST: 19:00 UTC is already the next day in India', () => {
    assert.equal(istDayKey(new Date('2026-11-01T18:29:59Z')), '2026-11-01');
    assert.equal(istDayKey(new Date('2026-11-01T18:30:00Z')), '2026-11-02');
  });
  test('the range has exactly N consecutive days ending today, and starts at IST midnight', () => {
    const now = new Date('2026-11-01T10:00:00Z'); // 15:30 IST on 1 Nov
    const { keys, since } = istDayRange(now, 7);
    assert.deepEqual(keys, ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    assert.equal(since.toISOString(), '2026-10-25T18:30:00.000Z'); // 26 Oct 00:00 IST
    assert.equal(istDayRange(now, 1).keys.length, 1);
  });
  test('orders: counts, cancellations and revenue (only paid, non-cancelled orders); empty days are zero', () => {
    const { keys } = istDayRange(new Date('2026-11-01T10:00:00Z'), 3);
    const rows = [
      { createdAt: new Date('2026-11-01T05:00:00Z'), total: 100.5, status: 'DELIVERED', paymentStatus: 'PAID' },
      { createdAt: new Date('2026-11-01T06:00:00Z'), total: 200, status: 'PLACED', paymentStatus: 'PENDING' },
      { createdAt: new Date('2026-11-01T07:00:00Z'), total: 300, status: 'CANCELLED', paymentStatus: 'PAID' },
      { createdAt: new Date('2026-10-30T07:00:00Z'), total: 50.25, status: 'DELIVERED', paymentStatus: 'PAID' },
      { createdAt: new Date('2026-09-01T07:00:00Z'), total: 999, status: 'DELIVERED', paymentStatus: 'PAID' }, // outside the window: ignored
    ];
    assert.deepEqual(bucketOrders(rows, keys), [
      { date: '2026-10-30', orders: 1, cancelled: 0, revenue: 50.25 },
      { date: '2026-10-31', orders: 0, cancelled: 0, revenue: 0 },
      { date: '2026-11-01', orders: 3, cancelled: 1, revenue: 100.5 },
    ]);
  });
  test('donations per day with servings', () => {
    const { keys } = istDayRange(new Date('2026-11-01T10:00:00Z'), 2);
    assert.deepEqual(bucketDonations([
      { createdAt: new Date('2026-11-01T01:00:00Z'), servings: 10, status: 'POSTED' },
      { createdAt: new Date('2026-11-01T02:00:00Z'), servings: 5, status: 'POSTED' },
    ], keys), [{ date: '2026-10-31', donations: 0, servingsPosted: 0 }, { date: '2026-11-01', donations: 2, servingsPosted: 15 }]);
  });
});
