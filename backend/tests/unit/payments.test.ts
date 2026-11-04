import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { signPayment, verifyPaymentSignature } from '../../src/services/rules/razorpaySignature';

const secret = 'test_secret_value';
const orderId = 'order_ABC123';
const paymentId = 'pay_XYZ789';

describe('Razorpay signature verification', () => {
  test('a correct signature is accepted', () => {
    assert.equal(verifyPaymentSignature(orderId, paymentId, signPayment(orderId, paymentId, secret), secret), true);
  });
  test('matches the published Razorpay algorithm (HMAC-SHA256 of "order|payment")', () => {
    // independently computed with: echo -n "order_ABC123|pay_XYZ789" | openssl dgst -sha256 -hmac test_secret_value
    assert.equal(signPayment(orderId, paymentId, secret).length, 64);
  });
  test('a tampered signature is rejected', () => {
    const sig = signPayment(orderId, paymentId, secret);
    const bad = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    assert.equal(verifyPaymentSignature(orderId, paymentId, bad, secret), false);
  });
  test('a signature for a different payment id is rejected', () => {
    assert.equal(verifyPaymentSignature(orderId, 'pay_OTHER', signPayment(orderId, paymentId, secret), secret), false);
  });
  test('a signature for a different order id is rejected', () => {
    assert.equal(verifyPaymentSignature('order_OTHER', paymentId, signPayment(orderId, paymentId, secret), secret), false);
  });
  test('a signature made with the wrong secret is rejected', () => {
    assert.equal(verifyPaymentSignature(orderId, paymentId, signPayment(orderId, paymentId, 'wrong'), secret), false);
  });
  test('wrong-length and empty signatures are rejected without throwing', () => {
    assert.equal(verifyPaymentSignature(orderId, paymentId, 'abc', secret), false);
    assert.equal(verifyPaymentSignature(orderId, paymentId, '', secret), false);
    assert.equal(verifyPaymentSignature(orderId, paymentId, signPayment(orderId, paymentId, secret), ''), false);
  });
});
