// @ts-check
// Ko'rinish formatlari (o'zbekcha). Toza funksiyalar — test/web/format.test.mjs.

/** @typedef {import('./types.js').Money} Money */
/** @typedef {import('./types.js').SeatRef} SeatRef */

export const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');

/** 1000000 → "1 000 000 so'm" (bo'shliqlar — ajralmas) @param {Money} value */
export function price(value) {
  const amount = Math.round(Number(value));
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0so'm`;
}

/** "1-noyabr" @param {string | Date} iso */
export function day(iso) {
  const d = new Date(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
}

/** "19:00" @param {string | Date} iso */
export function time(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "1-noyabr, 19:00" @param {string | Date} iso */
export function dateTime(iso) {
  return `${day(iso)}, ${time(iso)}`;
}

/** Bugungi sana uchun "Bugun, 14:02", aks holda "18-sentabr, 10:20" @param {string} iso @param {Date} [now] */
export function relativeDateTime(iso, now = new Date()) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `Bugun, ${time(d)}` : dateTime(d);
}

/** Seans kartasi uchun: { d: "01", m: "Noyabr" } @param {string} iso */
export function dayMonth(iso) {
  const d = new Date(iso);
  const month = MONTHS[d.getMonth()];
  return {
    d: pad(d.getDate()),
    m: month.charAt(0).toUpperCase() + month.slice(1),
  };
}

/** Sekund → "09:42" @param {number} seconds */
export function countdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** "VIP, 1-qator, 5-o'rin" yoki faqat kategoriya (GENERAL) @param {string} category @param {SeatRef | null} seat */
export function seatLabel(category, seat) {
  return seat
    ? `${category}, ${seat.row.number}-qator, ${seat.number}-o'rin`
    : category;
}

/** Buyurtma raqami: UUID'ning birinchi bo'lagi — "#3B9B1003" @param {string} id */
export function orderNo(id) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/** @param {number} minutes */
export function duration(minutes) {
  return `${minutes} daqiqa`;
}

/** @param {number | null} age */
export function ageLabel(age) {
  return `${age ?? 0}+`;
}

/** Eng arzon narx yoki null @param {{ price: Money }[]} categories */
export function minPrice(categories) {
  if (!categories.length) return null;
  return Math.min(...categories.map((c) => Number(c.price)));
}
