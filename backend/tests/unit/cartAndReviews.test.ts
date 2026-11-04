import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLineKey, resolveSelections } from '../../src/services/rules/cartLines';
import { isWithinOpeningHours } from '../../src/services/rules/openingHours';
import { checkReviewEligibility } from '../../src/services/rules/reviewRules';

const pizzaOptions = [
  { name: 'Size', options: [{ label: 'Regular', extraPrice: 0 }, { label: 'Large', extraPrice: 120 }] },
  { name: 'Extra', options: [{ label: 'Cheese', extraPrice: 30.5 }] },
];

describe('cart line customizations', () => {
  test('no selections, no definition: fine and free', () => {
    assert.deepEqual(resolveSelections(null, []), { ok: true, normalized: [], extraPricePaise: 0 });
  });
  test('extra price comes from the stored definition', () => {
    const r: any = resolveSelections(pizzaOptions, [{ group: 'Size', option: 'Large' }, { group: 'Extra', option: 'Cheese' }]);
    assert.equal(r.ok, true);
    assert.equal(r.extraPricePaise, 12000 + 3050);
  });
  test('unknown group, unknown option and no-definition selections are rejected', () => {
    assert.equal(resolveSelections(pizzaOptions, [{ group: 'Crust', option: 'Thin' }]).ok, false);
    assert.equal(resolveSelections(pizzaOptions, [{ group: 'Size', option: 'Huge' }]).ok, false);
    assert.equal(resolveSelections(null, [{ group: 'Size', option: 'Large' }]).ok, false);
  });
  test('two options from the same group are rejected', () => {
    assert.equal(resolveSelections(pizzaOptions, [{ group: 'Size', option: 'Regular' }, { group: 'Size', option: 'Large' }]).ok, false);
  });
  test('identical lines share a key regardless of selection order; different ones do not', () => {
    const a: any = resolveSelections(pizzaOptions, [{ group: 'Size', option: 'Large' }, { group: 'Extra', option: 'Cheese' }]);
    const b: any = resolveSelections(pizzaOptions, [{ group: 'Extra', option: 'Cheese' }, { group: 'Size', option: 'Large' }]);
    assert.equal(makeLineKey('f1', a.normalized, ' no onion '), makeLineKey('f1', b.normalized, 'no onion'));
    assert.notEqual(makeLineKey('f1', a.normalized, null), makeLineKey('f2', a.normalized, null));
    assert.notEqual(makeLineKey('f1', a.normalized, null), makeLineKey('f1', [], null));
    assert.notEqual(makeLineKey('f1', [], 'a'), makeLineKey('f1', [], 'b'));
  });
});

describe('opening hours (India time)', () => {
  // 2026-10-30T05:00:00Z = 10:30 IST
  const at = (iso: string) => new Date(iso);
  test('inside a normal window', () => assert.equal(isWithinOpeningHours('10:00', '23:00', at('2026-10-30T05:00:00Z')), true));
  test('before opening', () => assert.equal(isWithinOpeningHours('11:00', '23:00', at('2026-10-30T05:00:00Z')), false));
  test('closing time itself is closed', () => assert.equal(isWithinOpeningHours('10:00', '10:30', at('2026-10-30T05:00:00Z')), false));
  test('overnight window, late evening (22:30 IST)', () => assert.equal(isWithinOpeningHours('18:00', '02:00', at('2026-10-30T17:00:00Z')), true));
  test('overnight window, early morning (01:00 IST)', () => assert.equal(isWithinOpeningHours('18:00', '02:00', at('2026-10-29T19:30:00Z')), true));
  test('overnight window, afternoon is closed', () => assert.equal(isWithinOpeningHours('18:00', '02:00', at('2026-10-30T08:30:00Z')), false));
  test('same open/close means 24 hours', () => assert.equal(isWithinOpeningHours('00:00', '00:00', at('2026-10-30T20:00:00Z')), true));
});

describe('review eligibility', () => {
  test('own delivered order is eligible', () =>
    assert.deepEqual(checkReviewEligibility({ orderStatus: 'DELIVERED', orderUserId: 'u1', userId: 'u1' }), { ok: true }));
  for (const status of ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'CANCELLED'])
    test(`${status} order cannot be reviewed`, () => {
      const r: any = checkReviewEligibility({ orderStatus: status, orderUserId: 'u1', userId: 'u1' });
      assert.equal(r.ok, false);
      assert.equal(r.httpStatus, 409);
    });
  test("someone else's order looks like it does not exist", () => {
    const r: any = checkReviewEligibility({ orderStatus: 'DELIVERED', orderUserId: 'u1', userId: 'u2' });
    assert.equal(r.ok, false);
    assert.equal(r.httpStatus, 404);
  });
});
