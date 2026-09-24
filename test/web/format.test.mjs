import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fmt from '../../public/js/format.js';
import { safeNext } from '../../public/js/routes.js';
import { currentOrNextSession } from '../../public/js/schedule.js';

const NBSP = ' ';

test("narx: minglik ajratkich va so'm", () => {
  assert.equal(fmt.price('1000000'), `1${NBSP}000${NBSP}000${NBSP}so'm`);
  assert.equal(fmt.price(500000), `500${NBSP}000${NBSP}so'm`);
  assert.equal(fmt.price('150000.00'), `150${NBSP}000${NBSP}so'm`);
  assert.equal(fmt.price(0), `0${NBSP}so'm`);
});

test("sana va vaqt o'zbekcha", () => {
  const d = new Date(2026, 10, 1, 19, 0);
  assert.equal(fmt.dateTime(d), '1-noyabr, 19:00');
  assert.deepEqual(fmt.dayMonth(d.toISOString()), { d: '01', m: 'Noyabr' });
  assert.equal(
    fmt.relativeDateTime(
      new Date(2026, 8, 24, 14, 2).toISOString(),
      new Date(2026, 8, 24, 18, 0),
    ),
    'Bugun, 14:02',
  );
  assert.equal(
    fmt.relativeDateTime(
      new Date(2026, 8, 18, 10, 20).toISOString(),
      new Date(2026, 8, 24),
    ),
    '18-sentabr, 10:20',
  );
});

test('taymer formati', () => {
  assert.equal(fmt.countdown(582), '09:42');
  assert.equal(fmt.countdown(47), '00:47');
  assert.equal(fmt.countdown(-5), '00:00');
});

test("o'rin yorlig'i va buyurtma raqami", () => {
  const seat = { number: 5, row: { number: 1, sector: { name: 'A' } } };
  assert.equal(fmt.seatLabel('VIP', seat), "VIP, 1-qator, 5-o'rin");
  assert.equal(fmt.seatLabel('Fan zone', null), 'Fan zone');
  assert.equal(
    fmt.orderNo('3b9b1003-2137-46f9-bacf-79fa49fa042f'),
    '#3B9B1003',
  );
});

test('eng arzon narx', () => {
  assert.equal(
    fmt.minPrice([{ price: '500000' }, { price: '150000' }]),
    150000,
  );
  assert.equal(fmt.minPrice([]), null);
});

test("login'dan keyin faqat ichki manzilga qaytiladi", () => {
  assert.equal(safeNext('/checkout/?orderId=1'), '/checkout/?orderId=1');
  assert.equal(safeNext('//evil.com'), null);
  assert.equal(safeNext('https://evil.com'), null);
  assert.equal(safeNext(null), null);
});

test('kontroller uchun joriy/keyingi seans', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const sessions = [
    { startTime: '2026-10-01T10:00:00Z' },
    { startTime: '2026-11-01T09:00:00Z' },
    { startTime: '2026-11-02T10:00:00Z' },
  ];
  assert.equal(currentOrNextSession(sessions, now), sessions[1]);
  assert.equal(currentOrNextSession(sessions.slice(0, 1), now), sessions[0]);
  assert.equal(currentOrNextSession([], now), null);
});
