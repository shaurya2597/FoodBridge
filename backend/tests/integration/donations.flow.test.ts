import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, INTEGRATION_ENABLED, setup } from './fixtures';

// NOT executed in the authoring sandbox (no database there). Run with TEST_DATABASE_URL set; see README.
describe('Phase 3: donations, NGO claiming and food assistance', { skip: !INTEGRATION_ENABLED && 'set TEST_DATABASE_URL to run integration tests' }, () => {
  let c: Ctx;
  before(async () => { c = await setup(); });
  after(async () => { await c?.cleanup(); });

  const post = (token: string, extra: object = {}) => c.api('POST', '/donations', token, c.donationBody(extra));
  const id = (r: any) => r.json.data.id as string;
  const dbDonation = (donationId: string) => c.prisma.donation.findUniqueOrThrow({ where: { id: donationId } });
  const status = (token: string, donationId: string, body: object) => c.api('PATCH', `/donations/${donationId}/status`, token, body);
  const request = (token: string, donationId: string, body: object = {}) => c.api('POST', `/donations/${donationId}/request`, token, body);
  const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const mins = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

  describe('posting a donation and food-safety validation', () => {
    test('a customer donates as an individual', async () => {
      const r = await post(c.tokens.custA);
      assert.equal(r.status, 201);
      assert.equal(r.json.data.status, 'POSTED');
      assert.equal(r.json.data.donorType, 'INDIVIDUAL');
      assert.equal(r.json.data.contactPhone, '9876543210'); // the donor sees their own details
    });
    test('a restaurant owner donates on behalf of their own approved restaurant', async () => {
      const r = await post(c.tokens.owner1, { restaurantId: c.r1.id });
      assert.equal(r.status, 201);
      assert.equal(r.json.data.donorType, 'RESTAURANT');
      assert.equal(r.json.data.donorName, c.r1.name);
    });
    test("a restaurant owner cannot donate as someone else's restaurant, or without naming one", async () => {
      assert.equal((await post(c.tokens.owner2, { restaurantId: c.r1.id })).status, 403);
      assert.equal((await post(c.tokens.owner1)).status, 400);
      assert.equal((await post(c.tokens.custA, { restaurantId: c.r1.id })).status, 400);
    });
    test('the donor must confirm the food is safe', async () => {
      assert.equal((await post(c.tokens.custA, { safetyConfirmed: false })).status, 400);
      const body: any = c.donationBody(); delete body.safetyConfirmed;
      assert.equal((await c.api('POST', '/donations', c.tokens.custA, body)).status, 400);
    });
    test('expired food, too-short windows, future preparation and over-long shelf life are rejected', async () => {
      const expired = await post(c.tokens.custA, { expiresAt: mins(-5) });
      assert.equal(expired.status, 400);
      assert.match(JSON.stringify(expired.json), /expired/i);
      assert.equal((await post(c.tokens.custA, { expiresAt: mins(10) })).status, 400);
      assert.equal((await post(c.tokens.custA, { preparedAt: hours(2) })).status, 400);
      assert.equal((await post(c.tokens.custA, { preparedAt: mins(-30), expiresAt: hours(20) })).status, 400); // cooked meal > 12h
      assert.equal((await post(c.tokens.custA, { category: 'Packaged food', preparedAt: mins(-30), expiresAt: hours(20) })).status, 201); // allowed for packaged food
    });
    test('other invalid input is rejected', async () => {
      assert.equal((await post(c.tokens.custA, { contactPhone: '123' })).status, 400);
      assert.equal((await post(c.tokens.custA, { servings: 0 })).status, 400);
      assert.equal((await post(c.tokens.custA, { category: 'Poison' })).status, 400);
      assert.equal((await post(c.tokens.custA, { imageUrl: 'javascript:alert(1)' })).status, 400);
    });
    test('only customers and restaurant owners can donate, and only when logged in', async () => {
      assert.equal((await post(c.tokens.ngoA)).status, 403);
      assert.equal((await post(c.tokens.admin)).status, 403);
      assert.equal((await c.api('POST', '/donations', undefined, c.donationBody())).status, 401);
    });
  });

  describe('who can see what', () => {
    let donationId: string;
    before(async () => { donationId = id(await post(c.tokens.custB, { foodName: `Privacy test ${Date.now()}`, city: 'Jodhpur' })); });

    test('the public list shows open donations without address, phone or the individual donor name', async () => {
      const r = await c.api('GET', '/donations?limit=50');
      assert.equal(r.status, 200);
      const row = r.json.data.find((d: any) => d.id === donationId);
      assert.ok(row);
      assert.equal(row.donorName, 'Individual donor');
      const text = JSON.stringify(row);
      assert.equal(text.includes('Secret Lane'), false);
      assert.equal(text.includes('9876543210'), false);
    });
    test('a verified NGO sees the pickup address but not the phone; an unverified NGO sees only the public view', async () => {
      const verified = JSON.stringify((await c.api('GET', `/donations/${donationId}`, c.tokens.ngoA)).json.data);
      assert.equal(verified.includes('Secret Lane'), true);
      assert.equal(verified.includes('9876543210'), false);
      const unverified = JSON.stringify((await c.api('GET', `/donations/${donationId}`, c.tokens.ngoC)).json.data);
      assert.equal(unverified.includes('Secret Lane'), false);
    });
    test('the donor sees everything, including their phone', async () => {
      const d = (await c.api('GET', `/donations/${donationId}`, c.tokens.custB)).json.data;
      assert.equal(d.contactPhone, '9876543210');
      assert.ok(Array.isArray(d.requests));
    });
    test('filters and pagination are validated', async () => {
      assert.equal((await c.api('GET', '/donations?limit=51')).status, 400);
      assert.equal((await c.api('GET', '/donations?page=0')).status, 400);
      assert.equal((await c.api('GET', '/donations?status=NOPE', c.tokens.admin)).status, 400);
      const none = await c.api('GET', '/donations?city=Atlantis');
      assert.equal(none.json.data.length, 0);
      assert.ok((await c.api('GET', '/donations?city=jodhpur&foodType=VEG&limit=50')).json.data.length >= 1);
    });
    test('mine=true shows only the donor\'s own donations and needs login', async () => {
      assert.equal((await c.api('GET', '/donations?mine=true')).status, 401);
      const mine = (await c.api('GET', '/donations?mine=true&limit=50', c.tokens.custB)).json.data;
      assert.ok(mine.length >= 1 && mine.every((d: any) => d.contactPhone));
      assert.ok(!mine.some((d: any) => d.foodName.startsWith('Dal') && d.donorName !== c.users.custB.name));
    });
    test('an unknown id is a 404', async () => assert.equal((await c.api('GET', '/donations/nope')).status, 404));
  });

  describe('NGO claiming', () => {
    let donationId: string;
    before(async () => { donationId = id(await post(c.tokens.custA)); });

    test('only a verified NGO can request', async () => {
      assert.equal((await request(c.tokens.ngoC, donationId)).status, 403);
      assert.equal((await request(c.tokens.custB, donationId)).status, 403);
      assert.equal((await request(c.tokens.owner1, donationId)).status, 403);
      assert.equal((await c.api('POST', `/donations/${donationId}/request`, undefined, {})).status, 401);
    });
    test('a verified NGO claims it; it then leaves the public pool', async () => {
      const r = await request(c.tokens.ngoA, donationId, { message: 'We can collect within an hour' });
      assert.equal(r.status, 201);
      assert.equal(r.json.data.status, 'NGO_REQUESTED');
      assert.equal(JSON.stringify(r.json.data).includes('9876543210'), false); // phone only after the donor accepts
      assert.equal((await c.api('GET', `/donations/${donationId}`)).status, 404);
      assert.equal((await c.api('GET', `/donations/${donationId}`, c.tokens.ngoB)).status, 404);
    });
    test('a second NGO cannot request the same donation', async () => {
      const r = await request(c.tokens.ngoB, donationId);
      assert.equal(r.status, 409);
      assert.match(r.json.message, /another NGO|no longer available/i);
    });
    test('the donor sees which NGO asked', async () => {
      const d = (await c.api('GET', `/donations/${donationId}`, c.tokens.custA)).json.data;
      assert.equal(d.status, 'NGO_REQUESTED');
      assert.equal(d.requests.length, 1);
      assert.equal(d.requests[0].status, 'PENDING');
      assert.equal(d.claimedBy.id, c.ngos.A.id);
    });
    test('two NGOs requesting at the same instant: exactly one wins', async () => {
      for (let round = 0; round < 3; round++) {
        const fresh = id(await post(c.tokens.custB));
        const results = await Promise.all([request(c.tokens.ngoA, fresh), request(c.tokens.ngoB, fresh)]);
        const wins = results.filter((r) => r.status === 201);
        assert.equal(wins.length, 1, `round ${round}: ${results.map((r) => r.status)}`);
        assert.equal(results.find((r) => r.status !== 201)!.status, 409);
        const row = await dbDonation(fresh);
        assert.equal(row.status, 'NGO_REQUESTED');
        assert.ok([c.ngos.A.id, c.ngos.B.id].includes(row.claimedByNgoId!));
        assert.equal(await c.prisma.donationRequest.count({ where: { donationId: fresh, status: 'PENDING' } }), 1);
      }
    });
    test('requesting a nonexistent donation is 404', async () => assert.equal((await request(c.tokens.ngoA, 'nope')).status, 404));
  });

  describe('full lifecycle: posted -> requested -> accepted -> pickup -> collected -> distributed', () => {
    let donationId: string;
    before(async () => {
      donationId = id(await post(c.tokens.owner1, { restaurantId: c.r1.id, servings: 25 }));
      assert.equal((await request(c.tokens.ngoA, donationId)).status, 201);
    });
    test('only the donor can accept, and only the holding NGO can do the later steps', async () => {
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'ACCEPTED' })).status, 403);
      assert.equal((await status(c.tokens.ngoB, donationId, { status: 'ACCEPTED' })).status, 404);
      assert.equal((await status(c.tokens.custA, donationId, { status: 'ACCEPTED' })).status, 404); // a different customer
      assert.equal((await status(c.tokens.admin, donationId, { status: 'ACCEPTED' })).status, 404);
    });
    test('invalid jumps are rejected', async () => {
      assert.equal((await status(c.tokens.owner1, donationId, { status: 'COLLECTED' })).status, 409);
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'PICKUP_SCHEDULED', pickupAt: mins(30) })).status, 409);
    });
    test('donor accepts: the NGO now receives the donor phone number', async () => {
      const r = await status(c.tokens.owner1, donationId, { status: 'ACCEPTED' });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.status, 'ACCEPTED');
      const ngoView = (await c.api('GET', `/donations/${donationId}`, c.tokens.ngoA)).json.data;
      assert.equal(ngoView.contactPhone, '9876543210');
      assert.equal((await c.prisma.donationRequest.findFirstOrThrow({ where: { donationId } })).status, 'APPROVED');
    });
    test('pickup scheduling is validated', async () => {
      assert.equal((await status(c.tokens.owner1, donationId, { status: 'PICKUP_SCHEDULED', pickupAt: mins(30) })).status, 403);
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'PICKUP_SCHEDULED' })).status, 400);
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'PICKUP_SCHEDULED', pickupAt: mins(-10) })).status, 400);
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'PICKUP_SCHEDULED', pickupAt: hours(5) })).status, 400); // after expiry
    });
    test('the NGO schedules, collects and distributes', async () => {
      const when = mins(60);
      const s = await status(c.tokens.ngoA, donationId, { status: 'PICKUP_SCHEDULED', pickupAt: when });
      assert.equal(s.status, 200);
      assert.equal(new Date(s.json.data.pickupScheduledAt).getTime(), new Date(when).getTime());
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'COLLECTED' })).json.data.status, 'COLLECTED');
      assert.equal((await status(c.tokens.owner1, donationId, { status: 'CANCELLED' })).status, 409); // too late to cancel
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'DISTRIBUTED' })).json.data.status, 'DISTRIBUTED');
    });
    test('history is recorded for both parties, and a finished donation is frozen', async () => {
      const d = (await c.api('GET', `/donations/${donationId}`, c.tokens.owner1)).json.data;
      assert.deepEqual(d.statusHistory.map((h: any) => h.status), ['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED']);
      assert.equal((await status(c.tokens.ngoA, donationId, { status: 'COLLECTED' })).status, 409);
      const mineNgo = (await c.api('GET', '/donations?mine=true&status=DISTRIBUTED', c.tokens.ngoA)).json.data;
      assert.ok(mineNgo.some((x: any) => x.id === donationId));
      const summary = (await c.api('GET', '/ngo/summary', c.tokens.ngoA)).json.data;
      assert.equal(summary.donationsByStatus.DISTRIBUTED >= 1, true);
      assert.ok(summary.servingsCollected >= 25);
    });
  });

  describe('rejecting, withdrawing and cancelling', () => {
    test('the donor rejects a request: back in the pool, that NGO cannot re-request, another can', async () => {
      const d = id(await post(c.tokens.custA));
      await request(c.tokens.ngoA, d);
      const r = await status(c.tokens.custA, d, { status: 'POSTED' });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.status, 'POSTED');
      assert.equal((await dbDonation(d)).claimedByNgoId, null);
      assert.equal((await c.prisma.donationRequest.findFirstOrThrow({ where: { donationId: d, ngoId: c.ngos.A.id } })).status, 'REJECTED');
      assert.equal((await request(c.tokens.ngoA, d)).status, 409);
      assert.equal((await request(c.tokens.ngoB, d)).status, 201);
    });
    test('the NGO withdraws after acceptance: back in the pool and it may ask again', async () => {
      const d = id(await post(c.tokens.custA));
      await request(c.tokens.ngoA, d);
      await status(c.tokens.custA, d, { status: 'ACCEPTED' });
      const w = await status(c.tokens.ngoA, d, { status: 'POSTED', reason: 'Vehicle broke down' });
      assert.equal(w.status, 200);
      assert.equal((await dbDonation(d)).claimedByNgoId, null);
      assert.equal((await c.prisma.donationRequest.findFirstOrThrow({ where: { donationId: d } })).status, 'WITHDRAWN');
      assert.equal((await request(c.tokens.ngoA, d)).status, 201);
    });
    test('the donor cancels an accepted donation', async () => {
      const d = id(await post(c.tokens.custA));
      await request(c.tokens.ngoB, d);
      await status(c.tokens.custA, d, { status: 'ACCEPTED' });
      assert.equal((await status(c.tokens.custA, d, { status: 'CANCELLED', reason: 'Plans changed' })).json.data.status, 'CANCELLED');
      assert.equal((await status(c.tokens.ngoB, d, { status: 'COLLECTED' })).status, 409);
      assert.equal((await c.api('GET', `/donations/${d}`)).status, 404);
    });
    test('a donor can cancel while it is still only posted; a stranger cannot', async () => {
      const d = id(await post(c.tokens.custA));
      assert.equal((await status(c.tokens.custB, d, { status: 'CANCELLED' })).status, 404);
      assert.equal((await status(c.tokens.custA, d, { status: 'CANCELLED' })).status, 200);
    });
  });

  describe('expiry', () => {
    const makeExpired = async () => {
      const d = id(await post(c.tokens.custA));
      await c.prisma.donation.update({ where: { id: d }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      return d;
    };
    test('expired donations disappear from public views and cannot be requested', async () => {
      const d = await makeExpired();
      assert.equal((await c.api('GET', `/donations/${d}`)).status, 404);
      assert.equal((await c.api('GET', '/donations?limit=50')).json.data.some((x: any) => x.id === d), false);
      assert.equal((await request(c.tokens.ngoA, d)).status, 409);
    });
    test('the donor can still see an expired donation, flagged as expired', async () => {
      const d = await makeExpired();
      const view = (await c.api('GET', `/donations/${d}`, c.tokens.custA)).json.data;
      assert.equal(view.isExpired, true);
    });
    test('a donation that expires while waiting for acceptance cannot be accepted', async () => {
      const d = id(await post(c.tokens.custA));
      await request(c.tokens.ngoA, d);
      await c.prisma.donation.update({ where: { id: d }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const r = await status(c.tokens.custA, d, { status: 'ACCEPTED' });
      assert.equal(r.status, 409);
      assert.match(r.json.message, /expired/i);
    });
    test('the sweep marks stale donations EXPIRED and releases the NGO request', async () => {
      const { expireStaleDonations } = require('../../src/services/donationService') as typeof import('../../src/services/donationService');
      const d = id(await post(c.tokens.custA));
      await request(c.tokens.ngoA, d);
      await c.prisma.donation.update({ where: { id: d }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.ok((await expireStaleDonations()) >= 1);
      assert.equal((await dbDonation(d)).status, 'EXPIRED');
      assert.equal((await c.prisma.donationRequest.findFirstOrThrow({ where: { donationId: d } })).status, 'REJECTED');
      assert.equal(await expireStaleDonations(), 0); // idempotent
    });
  });

  describe('NGO profile', () => {
    test('an NGO reads and updates its profile but cannot verify itself', async () => {
      assert.equal((await c.api('GET', '/ngo/profile', c.tokens.ngoC)).json.data.isVerified, false);
      const r = await c.api('PUT', '/ngo/profile', c.tokens.ngoC, { orgName: `${c.tag} Renamed`, isVerified: true, registrationNo: 'HACK-1', serviceArea: 'Old City' });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.orgName, `${c.tag} Renamed`);
      const row = await c.prisma.nGOProfile.findUniqueOrThrow({ where: { id: c.ngos.C.id } });
      assert.equal(row.isVerified, false);
      assert.equal(row.registrationNo, null);
    });
    test('validation and role checks', async () => {
      assert.equal((await c.api('PUT', '/ngo/profile', c.tokens.ngoC, {})).status, 400);
      assert.equal((await c.api('PUT', '/ngo/profile', c.tokens.ngoC, { contactPhone: '1' })).status, 400);
      assert.equal((await c.api('GET', '/ngo/profile', c.tokens.custA)).status, 403);
      assert.equal((await c.api('GET', '/ngo/profile')).status, 401);
    });
  });

  describe('food assistance requests', () => {
    let anonId: string; let memberId: string;
    const ask = (token: string | undefined, extra: object = {}) => c.api('POST', '/assistance', token, c.assistanceBody(extra));
    /** Creates a request and returns its id, failing with the real status and body if creation did not succeed. */
    const askOk = async (token: string | undefined, extra: object = {}) => {
      const r = await ask(token, extra);
      assert.equal(r.status, 201, `POST /assistance expected 201 but got ${r.status}: ${JSON.stringify(r.json)}`);
      return r.json.data.id as string;
    };

    test('anyone can ask for food without an account; bad input is rejected', async () => {
      const r = await ask(undefined);
      assert.equal(r.status, 201, `POST /assistance expected 201 but got ${r.status}: ${JSON.stringify(r.json)}`);
      anonId = r.json.data.id;
      assert.equal(r.json.data.status, 'OPEN');
      assert.equal((await ask(undefined, { people: 0 })).status, 400);
      assert.equal((await ask(undefined, { phone: '12345' })).status, 400);
      assert.equal((await ask(undefined, { requirements: [] })).status, 400);
      assert.equal((await ask(undefined, { requirements: ['Caviar'] })).status, 400);
    });
    test('an anonymous tracker sees the status but not who asked', async () => {
      const r = await c.api('GET', `/assistance/${anonId}`);
      assert.equal(r.status, 200);
      const text = JSON.stringify(r.json.data);
      for (const secret of ['Ramesh', 'Clock Tower']) assert.equal(text.includes(secret), false, secret);
      assert.equal(r.json.data.status, 'OPEN');
      assert.equal((await c.api('GET', '/assistance/nope')).status, 404);
    });
    test('a limit of open requests per phone number stops spam', async () => {
      const phone = c.phone();
      for (let i = 0; i < 3; i++) await askOk(undefined, { phone });
      assert.equal((await ask(undefined, { phone })).status, 429);
      await c.prisma.foodAssistanceRequest.deleteMany({ where: { phone } });
    });
    test('a logged-in person sees only their own requests', async () => {
      memberId = await askOk(c.tokens.custA);
      assert.ok((await c.api('GET', '/assistance', c.tokens.custA)).json.data.some((x: any) => x.id === memberId));
      assert.equal((await c.api('GET', '/assistance', c.tokens.custB)).json.data.length, 0);
      assert.equal((await c.api('GET', '/assistance')).status, 401);
    });
    test('verified NGOs browse open requests without personal details; unverified NGOs are refused', async () => {
      const list = await c.api('GET', '/assistance?limit=50', c.tokens.ngoA);
      assert.equal(list.status, 200);
      const row = list.json.data.find((x: any) => x.id === memberId);
      assert.ok(row);
      assert.equal(JSON.stringify(row).includes('Ramesh'), false);
      assert.equal(JSON.stringify(row).includes('Clock Tower'), true);
      assert.equal((await c.api('GET', '/assistance', c.tokens.ngoC)).status, 403);
    });
    test('two NGOs taking the same request at once: exactly one succeeds', async () => {
      const rid = await askOk(c.tokens.custA);
      const results = await Promise.all([
        c.api('PATCH', `/assistance/${rid}/status`, c.tokens.ngoA, { status: 'ASSIGNED' }),
        c.api('PATCH', `/assistance/${rid}/status`, c.tokens.ngoB, { status: 'ASSIGNED' }),
      ]);
      assert.equal(results.filter((x) => x.status === 200).length, 1, results.map((x) => x.status).join());
      assert.ok(results.some((x) => x.status === 404 || x.status === 409));
      const row = await c.prisma.foodAssistanceRequest.findUniqueOrThrow({ where: { id: rid } });
      assert.equal(row.status, 'ASSIGNED');
      assert.ok(row.assignedNgoId && [c.ngos.A.id, c.ngos.B.id].includes(row.assignedNgoId), 'exactly one of the two NGOs must hold the request');
      // results[0] is NGO A's response, results[1] is NGO B's: the stored owner must be whoever got the 200.
      const winnerNgo = results[0].status === 200 ? c.ngos.A.id : c.ngos.B.id;
      assert.equal(row.assignedNgoId, winnerNgo, 'assignedNgoId must belong to the NGO that received 200');
    });
    test('the assigned NGO gets contact details and can fulfil; others cannot interfere', async () => {
      assert.equal((await c.api('PATCH', `/assistance/${memberId}/status`, c.tokens.ngoA, { status: 'ASSIGNED' })).status, 200);
      assert.equal((await c.api('GET', `/assistance/${memberId}`, c.tokens.ngoA)).json.data.phone, c.assistanceBody().phone);
      assert.equal((await c.api('PATCH', `/assistance/${memberId}/status`, c.tokens.ngoB, { status: 'FULFILLED' })).status, 404);
      assert.equal((await c.api('PATCH', `/assistance/${memberId}/status`, c.tokens.custA, { status: 'FULFILLED' })).status, 403);
      assert.equal((await c.api('PATCH', `/assistance/${memberId}/status`, c.tokens.custB, { status: 'CLOSED' })).status, 404);
      assert.equal((await c.api('PATCH', `/assistance/${memberId}/status`, c.tokens.ngoA, { status: 'FULFILLED' })).json.data.status, 'FULFILLED');
      assert.equal((await c.api('PATCH', `/assistance/${memberId}/status`, c.tokens.ngoA, { status: 'OPEN' })).status, 409); // frozen
    });
    test('the requester can close their own open request', async () => {
      const rid = await askOk(c.tokens.custB);
      assert.equal((await c.api('PATCH', `/assistance/${rid}/status`, c.tokens.custB, { status: 'CLOSED' })).json.data.status, 'CLOSED');
    });
  });
});
