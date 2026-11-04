import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect, Socket } from 'socket.io-client';
import { Ctx, INTEGRATION_ENABLED, setup } from './fixtures';

// NOT executed in the authoring sandbox (no database, no socket.io-client installed). See README.
describe('Phase 4 live effects of admin actions (Socket.IO)', { skip: !INTEGRATION_ENABLED && 'set TEST_DATABASE_URL to run integration tests' }, () => {
  let c: Ctx; const open: Socket[] = [];
  const client = (token: string) => { const s = connect(c.base, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true }); open.push(s); return s; };
  const ready = async (...sockets: Socket[]) => {
    await Promise.all(sockets.map((s) => new Promise<void>((res, rej) => { s.once('connect', () => res()); s.once('connect_error', rej); })));
    await new Promise((r) => setTimeout(r, 400));
  };
  const next = (s: Socket, ev: string, ms = 1500) => new Promise<any>((res, rej) => { const t = setTimeout(() => rej(new Error(`no ${ev}`)), ms); s.once(ev, (p) => { clearTimeout(t); res(p); }); });
  const silent = (s: Socket, ev: string, ms = 700) => new Promise<boolean>((res) => { let got = false; s.once(ev, () => { got = true; }); setTimeout(() => res(!got), ms); });

  before(async () => { c = await setup(); });
  after(async () => { open.forEach((s) => s.close()); await c?.cleanup(); });

  test('blocking a user disconnects their live socket at once, and they cannot reconnect', async () => {
    const victim = await c.register('sockvictim');
    const s = client(victim.token); await ready(s);
    const dropped = new Promise<string>((res) => s.once('disconnect', (reason) => res(reason)));
    assert.equal((await c.api('PATCH', `/admin/users/${victim.id}/block`, c.tokens.admin, { blocked: true, reason: 'Abusive behaviour' })).status, 200);
    assert.equal(await Promise.race([dropped, new Promise((r) => setTimeout(() => r('still connected'), 2000))]), 'io server disconnect');
    const again = client(victim.token);
    await assert.rejects(new Promise<void>((res, rej) => { again.once('connect', () => res()); again.once('connect_error', rej); }));
  });

  test('changing a password disconnects the old sessions', async () => {
    const u = await c.register('sockpw');
    const s = client(u.token); await ready(s);
    const dropped = new Promise<string>((res) => s.once('disconnect', (reason) => res(reason)));
    assert.equal((await c.api('POST', '/auth/change-password', u.token, { currentPassword: 'Test@1234', newPassword: 'Fresh-pass1' })).status, 200);
    assert.equal(await Promise.race([dropped, new Promise((r) => setTimeout(() => r('still connected'), 2000))]), 'io server disconnect');
  });

  test('verifying an NGO starts live donation alerts on its open connection; un-verifying stops them', async () => {
    const ngo = client(c.tokens.ngoC); await ready(ngo);
    assert.equal(await silent(ngo, 'donation:posted'), true); // not verified: nothing yet, even before any donation
    const heardWhileUnverified = silent(ngo, 'donation:posted');
    await c.api('POST', '/donations', c.tokens.custA, c.donationBody());
    assert.equal(await heardWhileUnverified, true);

    await c.api('PATCH', `/admin/ngos/${c.ngos.C.id}/verification`, c.tokens.admin, { verified: true });
    const alert = next(ngo, 'donation:posted');
    await c.api('POST', '/donations', c.tokens.custA, c.donationBody());
    assert.ok((await alert).donationId); // received WITHOUT reconnecting

    await c.api('PATCH', `/admin/ngos/${c.ngos.C.id}/verification`, c.tokens.admin, { verified: false });
    const stopped = silent(ngo, 'donation:posted');
    await c.api('POST', '/donations', c.tokens.custA, c.donationBody());
    assert.equal(await stopped, true);
  });

  test('restaurant owners are told when their restaurant is approved; complainants when their complaint changes', async () => {
    const owner = client(c.tokens.owner1); const cust = client(c.tokens.custA); const stranger = client(c.tokens.custB);
    await ready(owner, cust, stranger);

    const created = await c.api('POST', '/restaurants', c.tokens.owner1, { name: `${c.tag} Pending`, description: 'Awaiting approval here', cuisines: ['Test'], imageUrl: 'https://example.com/p.png', address: '9 Test Lane', city: 'Jodhpur' });
    const approved = next(owner, 'restaurant:status');
    await c.api('PATCH', `/admin/restaurants/${created.json.data.id}/status`, c.tokens.admin, { status: 'APPROVED' });
    assert.equal((await approved).status, 'APPROVED');

    const complaint = (await c.api('POST', '/complaints', c.tokens.custA, { category: 'OTHER', subject: 'Something went wrong', details: 'It really did go wrong, please help.' })).json.data.id;
    const heard = next(cust, 'complaint:status'); const quiet = silent(stranger, 'complaint:status');
    await c.api('PATCH', `/admin/complaints/${complaint}`, c.tokens.admin, { status: 'IN_REVIEW' });
    assert.equal((await heard).status, 'IN_REVIEW');
    assert.equal(await quiet, true);
  });
});
