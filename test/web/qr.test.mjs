import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeQr } from '../../public/js/qr.js';

/**
 * @typedef {{
 *   segno: { text: string, version: number, mask: number, rows: string[] }[],
 *   zxing: { text: string, rows: string[] }[],
 * }} Fixtures
 */
/** @type {unknown} */
const raw = JSON.parse(
  readFileSync(new URL('./qr-fixtures.json', import.meta.url), 'utf8'),
);
const fixtures = /** @type {Fixtures} */ (raw);
/** @param {boolean[][]} matrix */
const toRows = (matrix) =>
  matrix.map((row) => row.map((dark) => (dark ? 1 : 0)).join(''));

test('mustaqil generator (segno) bilan bir xil matritsa', () => {
  for (const { text, version, mask, rows } of fixtures.segno) {
    assert.deepEqual(
      toRows(encodeQr(text, { version, mask })),
      rows,
      `${text} v${version} mask ${mask}`,
    );
  }
});

test('chipta kodi (UUID) zxing bilan dekodlangan matritsaga mos keladi', () => {
  for (const { text, rows } of fixtures.zxing) {
    assert.deepEqual(toRows(encodeQr(text)), rows);
  }
});

test("UUID 3-versiyaga (29×29) sig'adi va finder naqshlari joyida", () => {
  const m = encodeQr('c18f0c98-d6f8-4eb0-8b1d-8e636c82977d');
  assert.equal(m.length, 29);
  const finder = [
    '1111111',
    '1000001',
    '1011101',
    '1011101',
    '1011101',
    '1000001',
    '1111111',
  ];
  /** @param {number} x0 @param {number} y0 */
  const at = (x0, y0) =>
    finder.map((_, y) =>
      m[y0 + y]
        .slice(x0, x0 + 7)
        .map((d) => (d ? 1 : 0))
        .join(''),
    );
  assert.deepEqual(at(0, 0), finder);
  assert.deepEqual(at(22, 0), finder);
  assert.deepEqual(at(0, 22), finder);
  assert.equal(m[21][8], true, 'qora modul (8, size-8)');
});

test('versiya matn uzunligiga qarab tanlanadi', () => {
  assert.equal(encodeQr('x').length, 21);
  assert.equal(encodeQr('x'.repeat(110)).length, 7 * 4 + 17);
  assert.throws(() => encodeQr('x'.repeat(300)), /juda uzun/);
});
