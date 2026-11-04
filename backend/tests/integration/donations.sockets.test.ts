import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect, Socket } from 'socket.io-client';
import { Ctx, INTEGRATION_ENABLED, setup } from './fixtures';

// NOT executed in the authoring sandbox (no database, no socket.io-client installed). See README.
describe('Phase 3 live donation updates (Socket.IO)', { skip: !INTEGRATION_ENABLED && 'set TEST_DATABASE_URL to run integration tests' }, () => {
  let c: Ctx; const open: Socket[] = [];
  const client = (token: string) => { const s = connect(c.base, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true }); open.push(s); return s; };
  const ready = async (...sockets: Socket[]) => {
    await Promise.all(sockets.map((s) => new Promise<void>((res, rej) => { s.once('connect', () => res()); s.once('connect_error', rej); })));
    await new Promise((r) => setTimeout(r, 400)); // room membership for NGOs is decided by a database lookup right after connect
  };
  const next = (s: Socket, ev: string, ms = 1500) => new Promise<any>((res, rej) => { const t = setTimeout(() => rej(new Error(`no ${ev}`)), ms); s.once(ev, (p) => { clearTimeout(t); res(p); }); });
  const silent = (s: Socket, ev: string, ms = 700) => new Promise<boolean>((res) => { let got = false; s.once(ev, () => { got = true; }); setTimeout(() => res(!got), ms); });

  before(async () => { c = await setup(); });
  after(async () => { open.forEach((s) => s.close()); await c?.cleanup(); });

  test('verified NGOs hear about a new donation; unverified NGOs and customers do not', async () => {
    const [ngoA, ngoB, ngoC, cust] = [c.tokens.ngoA, c.tokens.ngoB, c.tokens.ngoC, c.tokens.custB].map(client);
    await ready(ngoA, ngoB, ngoC, cust);
    const heard = [next(ngoA, 'donation:posted'), next(ngoB, 'donation:posted')];
    const quiet = [silent(ngoC, 'donation:posted'), silent(cust, 'donation:posted')];
    const r = await c.api('POST', '/donations', c.tokens.custA, c.donationBody());
    assert.equal(r.status, 201);
    for (const p of await Promise.all(heard)) {
      assert.equal(p.donationId, r.json.data.id);
      assert.equal(JSON.stringify(p).includes('Secret Lane'), false); // events never carry addresses or phones
      assert.equal(JSON.stringify(p).includes('9876543210'), false);
    }
    assert.deepEqual(await Promise.all(quiet), [true, true]);
  });

  test('a claim reaches the donor, the claiming NGO and admins, and tells other NGOs it is gone', async () => {
    const donation = (await c.api('POST', '/donations', c.tokens.custA, c.donationBody())).json.data.id;
    const [donor, ngoA, ngoB, admin, stranger] = [c.tokens.custA, c.tokens.ngoA, c.tokens.ngoB, c.tokens.admin, c.tokens.custB].map(client);
    await ready(donor, ngoA, ngoB, admin, stranger);

    const status = [next(donor, 'donation:status'), next(ngoA, 'donation:status'), next(admin, 'donation:status')];
    const gone = next(ngoB, 'donation:availability');
    const quiet = silent(stranger, 'donation:status');
    assert.equal((await c.api('POST', `/donations/${donation}/request`, c.tokens.ngoA, {})).status, 201);

    for (const p of await Promise.all(status)) { assert.equal(p.donationId, donation); assert.equal(p.status, 'NGO_REQUESTED'); }
    const availability = await gone;
    assert.equal(availability.available, false);
    assert.equal(await quiet, true);
  });

  test('donor acceptance is pushed to the NGO, and a released donation is announced to NGOs again', async () => {
    const donation = (await c.api('POST', '/donations', c.tokens.custA, c.donationBody())).json.data.id;
    await c.api('POST', `/donations/${donation}/request`, c.tokens.ngoA, {});
    const [ngoA, ngoB] = [c.tokens.ngoA, c.tokens.ngoB].map(client);
    await ready(ngoA, ngoB);
    const accepted = next(ngoA, 'donation:status');
    await c.api('PATCH', `/donations/${donation}/status`, c.tokens.custA, { status: 'ACCEPTED' });
    assert.equal((await accepted).status, 'ACCEPTED');

    const back = next(ngoB, 'donation:availability');
    await c.api('PATCH', `/donations/${donation}/status`, c.tokens.ngoA, { status: 'POSTED' });
    const p = await back;
    assert.equal(p.available, true);
  });

  test('assistance requests: new ones reach verified NGOs; progress reaches the requester', async () => {
    const [ngoA, ngoC, requester] = [c.tokens.ngoA, c.tokens.ngoC, c.tokens.custA].map(client);
    await ready(ngoA, ngoC, requester);
    const heard = next(ngoA, 'assistance:new'); const quiet = silent(ngoC, 'assistance:new');
    const r = await c.api('POST', '/assistance', c.tokens.custA, c.assistanceBody());
    assert.equal((await heard).requestId, r.json.data.id);
    assert.equal(JSON.stringify(await heard.catch(() => ({}))).includes('Ramesh'), false);
    assert.equal(await quiet, true);

    const progress = next(requester, 'assistance:status');
    await c.api('PATCH', `/assistance/${r.json.data.id}/status`, c.tokens.ngoA, { status: 'ASSIGNED' });
    assert.equal((await progress).status, 'ASSIGNED');
  });
});
