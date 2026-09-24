// @ts-check
// Forma tekshiruvlari backend DTO qoidalariga mos (class-validator).
// Har bir funksiya xato matnini yoki null qaytaradi.

/** @param {string} value */
export function fullName(value) {
  const v = value.trim();
  if (!v) return 'Ismni kiriting';
  return v.length < 3 ? "Ism kamida 3 harfdan iborat bo'lishi kerak" : null;
}

/** @param {string} value */
export function email(value) {
  const v = value.trim();
  if (!v) return 'Emailni kiriting';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    ? null
    : "Email formati noto'g'ri";
}

/** IsStrongPassword standart qoidasi: 8+ belgi, katta va kichik harf, raqam, maxsus belgi @param {string} value */
export function strongPassword(value) {
  if (!value) return 'Parolni kiriting';
  if (value.length < 8) return "Parol kamida 8 belgi bo'lishi kerak";
  const missing = [];
  if (!/[a-z]/.test(value)) missing.push('kichik harf');
  if (!/[A-Z]/.test(value)) missing.push('katta harf');
  if (!/\d/.test(value)) missing.push('raqam');
  if (!/[^A-Za-z0-9]/.test(value)) missing.push('maxsus belgi');
  return missing.length ? `Parolda ${missing.join(', ')} bo'lishi kerak` : null;
}

/** @param {string} value */
export function required(value) {
  return value.trim() ? null : "Maydonni to'ldiring";
}

/** O'zbekiston raqami: +998 va 9 ta raqam (IsPhoneNumber('UZ')) @param {string} value */
export function uzPhone(value) {
  const digits = value.replace(/\D/g, '');
  return /^998\d{9}$/.test(digits)
    ? null
    : "Telefon raqam +998 XX XXX XX XX ko'rinishida bo'lsin";
}

/** "+998 90 123 45 67" → "+998901234567" @param {string} value */
export function normalizePhone(value) {
  return `+${value.replace(/\D/g, '')}`;
}

/** @param {string} value */
export function otpCode(value) {
  return /^\d{6}$/.test(value) ? null : '6 xonali kodni kiriting';
}

/** @param {string} value */
export function cardNumber(value) {
  return /^\d{16}$/.test(value.replace(/\s/g, ''))
    ? null
    : "Karta raqami 16 ta raqamdan iborat bo'lsin";
}

/** "OO/YY", o'tib ketmagan oy @param {string} value @param {Date} [now] */
export function cardExpiry(value, now = new Date()) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return 'OO/YY formatida kiriting';
  const endOfMonth = new Date(
    2000 + Number(match[2]),
    Number(match[1]),
    0,
    23,
    59,
    59,
  );
  return endOfMonth >= now ? null : "Karta muddati o'tgan";
}

/** @param {string} value */
export function cvv(value) {
  return /^\d{3}$/.test(value) ? null : '3 ta raqam';
}

/** UUID (check-in qrCode) @param {string} value */
export function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
    ? null
    : "Kod noto'g'ri formatda";
}
