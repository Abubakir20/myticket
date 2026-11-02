// @ts-check
// Barcha sahifa manzillari bir joyda. Har bir sahifa public/<yo'l>/index.html.

const q = encodeURIComponent;

export const routes = {
  home: (page = 1) => (page > 1 ? `/?page=${page}` : '/'),
  login: (next = '') => (next ? `/login/?next=${q(next)}` : '/login/'),
  register: (next = '') => (next ? `/register/?next=${q(next)}` : '/register/'),
  verify: () => '/verify/',
  event: (/** @type {string} */ id) => `/events/?id=${q(id)}`,
  seats: (/** @type {string} */ sessionId, /** @type {string} */ eventId) =>
    `/seats/?session=${q(sessionId)}&event=${q(eventId)}`,
  categories: (
    /** @type {string} */ sessionId,
    /** @type {string} */ eventId,
  ) => `/categories/?session=${q(sessionId)}&event=${q(eventId)}`,
  checkout: (/** @type {string} */ orderId) =>
    `/checkout/?orderId=${q(orderId)}`,
  orders: () => '/orders/',
  tickets: () => '/tickets/',
  ticket: (/** @type {string} */ id) => `/tickets/view/?id=${q(id)}`,
  profile: () => '/profile/',
  controller: () => '/controller/',
  admin: () => '/admin/',
  scan: (/** @type {string} */ eventId) =>
    `/controller/scan/?event=${q(eventId)}`,
};

/** Joriy sahifa manzili (login'dan keyin qaytish uchun) */
export const currentPath = () => location.pathname + location.search;

/**
 * `next` parametri faqat shu saytdagi yo'l bo'lishi mumkin (open redirect'dan himoya)
 * @param {string | null} next
 */
export function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

/** @param {string} name */
export const param = (name) => new URLSearchParams(location.search).get(name);
