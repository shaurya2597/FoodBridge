import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDonationTiming, maxShelfLifeHours, isExpired } from '../../src/services/rules/donationRules';
import { checkDonationTransition, DonationStatus, DonationActor } from '../../src/services/rules/donationStateMachine';
import { checkAssistanceTransition } from '../../src/services/rules/assistanceRules';
import { toDonationView, toAssistanceView, DonationLike, AssistanceLike } from '../../src/services/rules/donationView';

const now = new Date('2026-11-01T12:00:00Z');
const mins = (m: number) => new Date(now.getTime() + m * 60_000);

describe('donation food-safety timing', () => {
  const ok = { category: 'Cooked meal', preparedAt: mins(-60), expiresAt: mins(180), now };
  test('a normal cooked-meal donation is valid', () => assert.deepEqual(validateDonationTiming(ok), []));
  test('already expired food is rejected', () => {
    const p = validateDonationTiming({ ...ok, expiresAt: mins(-1) });
    assert.ok(p.some((x) => x.field === 'expiresAt' && /expired/.test(x.message)));
  });
  test('expiring exactly now is rejected', () => assert.ok(validateDonationTiming({ ...ok, expiresAt: now }).length > 0));
  test('less than 30 minutes left is rejected, exactly 30 is fine', () => {
    assert.ok(validateDonationTiming({ ...ok, expiresAt: mins(29) }).some((x) => /30 more minutes/.test(x.message)));
    assert.deepEqual(validateDonationTiming({ ...ok, expiresAt: mins(30) }), []);
  });
  test('preparation time in the future is rejected, small clock skew tolerated', () => {
    assert.ok(validateDonationTiming({ ...ok, preparedAt: mins(60) }).some((x) => x.field === 'preparedAt'));
    assert.deepEqual(validateDonationTiming({ ...ok, preparedAt: mins(4) }), []);
  });
  test('consume-before must be after preparation', () => {
    assert.ok(validateDonationTiming({ ...ok, preparedAt: mins(-10), expiresAt: mins(-20) }).length > 0);
  });
  test('cooked meals may not be offered more than 12 hours after preparation', () => {
    assert.ok(validateDonationTiming({ ...ok, preparedAt: mins(-60), expiresAt: mins(60 * 12) }).some((x) => /12 hours/.test(x.message)));
    assert.deepEqual(validateDonationTiming({ ...ok, preparedAt: mins(-60), expiresAt: mins(60 * 11) }), []);
  });
  test('shelf life limits depend on category', () => {
    assert.equal(maxShelfLifeHours('Cooked meal'), 12);
    assert.equal(maxShelfLifeHours('Bakery'), 48);
    assert.equal(maxShelfLifeHours('Packaged food'), 24 * 7);
  });
  test('isExpired', () => { assert.equal(isExpired(mins(-1), now), true); assert.equal(isExpired(now, now), true); assert.equal(isExpired(mins(1), now), false); });
});

describe('donation status transitions', () => {
  const expiresAt = mins(120);
  const run = (from: DonationStatus, to: DonationStatus, actor: DonationActor, extra: object = {}) =>
    checkDonationTransition({ from, to, actor, now, expiresAt, pickupAt: mins(60), ...extra });

  test('the happy path, each step by the right party', () => {
    assert.equal(run('NGO_REQUESTED', 'ACCEPTED', 'DONOR').ok, true);
    assert.equal(run('ACCEPTED', 'PICKUP_SCHEDULED', 'NGO').ok, true);
    assert.equal(run('PICKUP_SCHEDULED', 'COLLECTED', 'NGO').ok, true);
    assert.equal(run('COLLECTED', 'DISTRIBUTED', 'NGO').ok, true);
  });
  test('wrong party gets 403', () => {
    for (const [f, t, a] of [['NGO_REQUESTED', 'ACCEPTED', 'NGO'], ['ACCEPTED', 'PICKUP_SCHEDULED', 'DONOR'], ['PICKUP_SCHEDULED', 'COLLECTED', 'DONOR'], ['COLLECTED', 'DISTRIBUTED', 'DONOR']] as const) {
      const r: any = run(f, t, a); assert.equal(r.ok, false, `${a}: ${f}->${t}`); assert.equal(r.httpStatus, 403);
    }
  });
  test('skipping steps and going backwards are rejected', () => {
    for (const [f, t] of [['NGO_REQUESTED', 'COLLECTED'], ['ACCEPTED', 'COLLECTED'], ['ACCEPTED', 'DISTRIBUTED'], ['COLLECTED', 'ACCEPTED'], ['PICKUP_SCHEDULED', 'ACCEPTED']] as const)
      for (const a of ['DONOR', 'NGO'] as const) assert.equal(run(f, t, a).ok, false, `${a}: ${f}->${t}`);
  });
  test('NGOs cannot claim through the status endpoint', () => {
    const r: any = run('POSTED', 'NGO_REQUESTED', 'NGO'); assert.equal(r.ok, false); assert.match(r.message, /request endpoint/);
  });
  test('donor can reject a request; the NGO can withdraw until collection', () => {
    assert.equal(run('NGO_REQUESTED', 'POSTED', 'DONOR').ok, true);
    for (const f of ['NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'] as const) assert.equal(run(f, 'POSTED', 'NGO').ok, true, f);
    assert.equal(run('COLLECTED', 'POSTED', 'NGO').ok, false);
    assert.equal(run('ACCEPTED', 'POSTED', 'DONOR').ok, false); // donor cancels instead; cannot silently drop an accepted NGO
  });
  test('donor can cancel until the food is collected, never after', () => {
    for (const f of ['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'] as const) assert.equal(run(f, 'CANCELLED', 'DONOR').ok, true, f);
    assert.equal(run('COLLECTED', 'CANCELLED', 'DONOR').ok, false);
    assert.equal(run('POSTED', 'CANCELLED', 'NGO').ok, false);
  });
  test('final states are frozen for everyone', () => {
    const all: DonationStatus[] = ['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED', 'EXPIRED', 'FLAGGED', 'CANCELLED'];
    for (const f of ['DISTRIBUTED', 'EXPIRED', 'FLAGGED', 'CANCELLED'] as const)
      for (const t of all) for (const a of ['DONOR', 'NGO'] as const) assert.equal(run(f, t, a).ok, false, `${a}: ${f}->${t}`);
  });
  test('expired food cannot be accepted, scheduled or collected', () => {
    const past = { expiresAt: mins(-1) };
    assert.match((run('NGO_REQUESTED', 'ACCEPTED', 'DONOR', past) as any).message, /expired/);
    assert.equal(run('ACCEPTED', 'PICKUP_SCHEDULED', 'NGO', past).ok, false);
    assert.equal(run('PICKUP_SCHEDULED', 'COLLECTED', 'NGO', past).ok, false);
  });
  test('but expiry never blocks cancelling, withdrawing or recording distribution', () => {
    const past = { expiresAt: mins(-1) };
    assert.equal(run('POSTED', 'CANCELLED', 'DONOR', past).ok, true);
    assert.equal(run('ACCEPTED', 'POSTED', 'NGO', past).ok, true);
    assert.equal(run('COLLECTED', 'DISTRIBUTED', 'NGO', past).ok, true);
  });
  test('pickup time is required, in the future, and before expiry', () => {
    assert.equal((run('ACCEPTED', 'PICKUP_SCHEDULED', 'NGO', { pickupAt: undefined }) as any).httpStatus, 400);
    assert.equal((run('ACCEPTED', 'PICKUP_SCHEDULED', 'NGO', { pickupAt: mins(-5) }) as any).httpStatus, 400);
    assert.equal((run('ACCEPTED', 'PICKUP_SCHEDULED', 'NGO', { pickupAt: mins(120) }) as any).httpStatus, 400);
    assert.equal(run('ACCEPTED', 'PICKUP_SCHEDULED', 'NGO', { pickupAt: mins(119) }).ok, true);
  });
});

describe('food assistance status transitions', () => {
  test('NGO takes, releases, fulfils; requester can close', () => {
    assert.equal(checkAssistanceTransition('OPEN', 'ASSIGNED', 'NGO').ok, true);
    assert.equal(checkAssistanceTransition('ASSIGNED', 'OPEN', 'NGO').ok, true);
    assert.equal(checkAssistanceTransition('ASSIGNED', 'FULFILLED', 'NGO').ok, true);
    assert.equal(checkAssistanceTransition('OPEN', 'CLOSED', 'REQUESTER').ok, true);
    assert.equal(checkAssistanceTransition('ASSIGNED', 'CLOSED', 'REQUESTER').ok, true);
  });
  test('requesters cannot assign or fulfil; NGOs cannot close an unassigned request', () => {
    assert.equal((checkAssistanceTransition('OPEN', 'ASSIGNED', 'REQUESTER') as any).httpStatus, 403);
    assert.equal((checkAssistanceTransition('ASSIGNED', 'FULFILLED', 'REQUESTER') as any).httpStatus, 403);
    assert.equal((checkAssistanceTransition('OPEN', 'CLOSED', 'NGO') as any).httpStatus, 403);
  });
  test('cannot skip OPEN -> FULFILLED, and finished requests are frozen', () => {
    assert.equal(checkAssistanceTransition('OPEN', 'FULFILLED', 'NGO').ok, false);
    for (const f of ['FULFILLED', 'CLOSED'] as const) for (const t of ['OPEN', 'ASSIGNED', 'FULFILLED', 'CLOSED'] as const)
      for (const a of ['NGO', 'REQUESTER'] as const) assert.equal(checkAssistanceTransition(f, t, a).ok, false);
  });
});

describe('what each viewer may see', () => {
  const d: DonationLike = {
    id: 'd1', donorId: 'u1', restaurantId: null, donorName: 'Asha Verma', donorType: 'INDIVIDUAL', foodName: 'Dal rice', category: 'Cooked meal',
    quantity: '10 boxes', servings: 10, foodType: 'VEG', preparedAt: mins(-30), expiresAt: mins(200), pickupAddress: '12 Secret Lane, Jodhpur',
    city: 'Jodhpur', latitude: 26.2, longitude: 73.0, contactPhone: '9876543210', imageUrl: null, instructions: 'Ring bell twice',
    status: 'POSTED', pickupScheduledAt: null, statusHistory: [{ status: 'POSTED' }], claimedByNgoId: null, createdAt: now, updatedAt: now,
  };
  const json = (x: unknown) => JSON.stringify(x);

  test('the public sees no address, no phone, and an individual stays anonymous', () => {
    const v = toDonationView(d, 'PUBLIC', now);
    assert.equal(json(v).includes('Secret Lane'), false);
    assert.equal(json(v).includes('9876543210'), false);
    assert.equal(json(v).includes('Asha'), false);
    assert.equal(v.donorName, 'Individual donor');
    assert.equal(v.city, 'Jodhpur');
  });
  test('a restaurant donor is named publicly', () => {
    assert.equal(toDonationView({ ...d, donorType: 'RESTAURANT', donorName: 'Rajputana Rasoi' }, 'PUBLIC', now).donorName, 'Rajputana Rasoi');
  });
  test('a browsing NGO sees the address but never the phone', () => {
    const v = toDonationView(d, 'NGO', now);
    assert.equal(json(v).includes('Secret Lane'), true);
    assert.equal(json(v).includes('9876543210'), false);
  });
  test('the claiming NGO gets the phone only once the donor has accepted', () => {
    assert.equal(json(toDonationView({ ...d, status: 'NGO_REQUESTED' }, 'CLAIMANT', now)).includes('9876543210'), false);
    for (const s of ['ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED'])
      assert.equal(json(toDonationView({ ...d, status: s }, 'CLAIMANT', now)).includes('9876543210'), true, s);
  });
  test('donor and admin see everything; expiry flag is computed', () => {
    for (const who of ['DONOR', 'ADMIN'] as const) assert.equal(json(toDonationView(d, who, now)).includes('9876543210'), true);
    assert.equal(toDonationView({ ...d, expiresAt: mins(-1) }, 'PUBLIC', now).isExpired, true);
    assert.equal(toDonationView(d, 'PUBLIC', now).isExpired, false);
  });

  const a: AssistanceLike = {
    id: 'a1', userId: 'u9', name: 'Ramesh K', phone: '9123456780', people: 6, requirement: 'Cooked meal, Drinking water', foodType: 'VEG',
    location: 'Near Clock Tower', city: 'Jodhpur', notes: 'Family of six', status: 'OPEN', assignedNgoId: null,
    statusHistory: [{ status: 'OPEN', at: '2026-11-01T12:00:00Z', by: 'REQUESTER', note: 'private note' }], createdAt: now, updatedAt: now,
  };
  test('anyone tracking by id learns the status but not who asked', () => {
    const v = toAssistanceView(a, 'TRACKER');
    for (const secret of ['Ramesh', '9123456780', 'Clock Tower', 'u9', 'private note']) assert.equal(json(v).includes(secret), false, secret);
    assert.equal(v.status, 'OPEN');
    assert.deepEqual(v.requirements, ['Cooked meal', 'Drinking water']);
  });
  test('an NGO browsing open requests sees the need and location but not the name or phone', () => {
    const v = toAssistanceView(a, 'NGO_BROWSE');
    assert.equal(json(v).includes('Ramesh'), false);
    assert.equal(json(v).includes('9123456780'), false);
    assert.equal(json(v).includes('Clock Tower'), true);
  });
  test('the requester, the assigned NGO and admins see full details', () => {
    for (const who of ['OWNER', 'ASSIGNED_NGO', 'ADMIN'] as const) assert.equal(json(toAssistanceView(a, who)).includes('9123456780'), true, who);
  });
});
