// @ts-check
// Joriy foydalanuvchi. Token httpOnly cookie'da, shuning uchun "kim kirgan" savoliga
// GET /users/me javob beradi (kerak bo'lsa api.js avtomatik refresh qiladi).

import { api, ApiError } from './api.js';
import { routes, currentPath, safeNext } from './routes.js';

/** @typedef {import('./types.js').User} User */
/** @typedef {import('./types.js').Role} Role */

/** @type {Promise<User | null> | null} */
let current = null;

/**
 * Kirgan foydalanuvchi yoki null. Bitta sahifada bir marta so'raladi.
 * @returns {Promise<User | null>}
 */
export function getUser() {
  current ??= api.users.me().then(
    // Backend javobida ortiqcha maydonlar bor — faqat keraklilarini olamiz
    ({ id, fullName, email, role, status, imageUrl }) => ({
      id,
      fullName,
      email,
      role,
      status,
      imageUrl,
    }),
    (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 404)
      )
        return null;
      throw error;
    },
  );
  return current;
}

/**
 * Himoyalangan sahifa: kirmagan bo'lsa login'ga (qaytish manzili bilan) yuboradi,
 * roli mos kelmasa o'z bosh sahifasiga.
 * @param {Role[]} [roles]
 * @returns {Promise<User>}
 */
export async function requireUser(roles) {
  const user = await getUser();
  if (!user) {
    location.replace(routes.login(currentPath()));
    return new Promise(() => {}); // sahifa almashguncha kutadi
  }
  if (roles && !roles.includes(user.role) && user.role !== 'SUPERADMIN') {
    location.replace(homeFor(user));
    return new Promise(() => {});
  }
  return user;
}

/** Rolga mos bosh sahifa @param {User} user */
export function homeFor(user) {
  return user.role === 'CONTROLLER' ? routes.controller() : routes.home();
}

/** Login'dan keyingi yo'nalish @param {User} user */
export function afterLogin(user) {
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  if (user.role === 'CONTROLLER') return routes.controller();
  return next ?? routes.home();
}

export async function logout() {
  try {
    await api.auth.signOut();
  } catch {
    // Refresh cookie allaqachon eskirgan bo'lsa ham foydalanuvchi chiqib ketadi
  }
  current = Promise.resolve(null);
  location.assign(routes.home());
}

// ---------- OTP bosqichi ----------
// Login ikki bosqichli: /auth/signin kod yuboradi, /auth/confirm cookie o'rnatadi.
// Bosqichlar orasidagi holat sessionStorage'da (parol saqlanmaydi).

const PENDING_KEY = 'chipta:pending-login';

/**
 * @typedef {object} PendingLogin
 * @property {string} email
 * @property {number | null} expiresAt   kod amal qilish muddati (ms); noma'lum bo'lsa null
 * @property {number} resendAt    qayta yuborish mumkin bo'lgan vaqt (ms)
 * @property {number | null} [ttl]  kodning umumiy amal qilish muddati (sekund)
 * @property {string | null} fullName  ro'yxatdan o'tishda kiritilgan ism — tasdiqlangach profilga yoziladi
 * @property {string | null} next
 */

/** @param {PendingLogin} value */
export function savePendingLogin(value) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {
    // Saqlab bo'lmasa ham verify sahifasi email so'rab oladi
  }
}

/** @returns {PendingLogin | null} */
export function readPendingLogin() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? /** @type {PendingLogin} */ (JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearPendingLogin() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // e'tiborsiz
  }
}
