import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../../public/js/validate.js';

test('ism', () => {
  assert.equal(v.fullName('Az'), "Ism kamida 3 harfdan iborat bo'lishi kerak");
  assert.equal(v.fullName('  '), 'Ismni kiriting');
  assert.equal(v.fullName('Aziz Karimov'), null);
});

test('email', () => {
  assert.equal(v.email('aziz.karimov@'), "Email formati noto'g'ri");
  assert.equal(v.email('aziz@mail.uz'), null);
});

test('kuchli parol backend IsStrongPassword qoidasiga mos', () => {
  assert.equal(v.strongPassword('Ab1!'), "Parol kamida 8 belgi bo'lishi kerak");
  assert.match(
    /** @type {string} */ (v.strongPassword('abcdefgh')),
    /katta harf, raqam, maxsus belgi/,
  );
  assert.equal(v.strongPassword('User123!'), null);
});

test("O'zbekiston telefon raqami", () => {
  assert.equal(v.uzPhone('+998 90 123 45 67'), null);
  assert.equal(v.normalizePhone('+998 90 123 45 67'), '+998901234567');
  assert.notEqual(v.uzPhone('+998 90 123'), null);
  assert.notEqual(v.uzPhone('+7 900 123 45 67'), null);
});

test('karta maydonlari', () => {
  assert.equal(v.cardNumber('8600 1234 5678 9012'), null);
  assert.notEqual(v.cardNumber('8600 1234'), null);
  const now = new Date(2026, 8, 24);
  assert.equal(v.cardExpiry('09/26', now), null);
  assert.equal(v.cardExpiry('08/26', now), "Karta muddati o'tgan");
  assert.equal(v.cardExpiry('13/28', now), 'OO/YY formatida kiriting');
  assert.equal(v.cvv('123'), null);
  assert.notEqual(v.cvv('12'), null);
});

test('OTP va QR kod', () => {
  assert.equal(v.otpCode('492815'), null);
  assert.notEqual(v.otpCode('4928'), null);
  assert.equal(v.uuid('c18f0c98-d6f8-4eb0-8b1d-8e636c82977d'), null);
  assert.notEqual(v.uuid('TCK-284917'), null);
});
