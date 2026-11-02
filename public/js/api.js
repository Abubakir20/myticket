// @ts-check
// Backend bilan yagona aloqa qatlami. Auth — httpOnly cookie (accessToken 15 daqiqa, refreshToken 7 kun),
// shuning uchun token JS'da saqlanmaydi: 401 kelsa bir marta /auth/refresh chaqirilib, so'rov qaytariladi.

/** @typedef {import('./types.js').User} User */
/** @typedef {import('./types.js').OtpSent} OtpSent */
/** @typedef {import('./types.js').EventPage} EventPage */
/** @typedef {import('./types.js').EventDetail} EventDetail */
/** @typedef {import('./types.js').SeatMap} SeatMap */
/** @typedef {import('./types.js').GeneralCategory} GeneralCategory */
/** @typedef {import('./types.js').CreatedOrder} CreatedOrder */
/** @typedef {import('./types.js').OrderDetail} OrderDetail */
/** @typedef {import('./types.js').OrderListItem} OrderListItem */
/** @typedef {import('./types.js').PaymentResult} PaymentResult */
/** @typedef {import('./types.js').Ticket} Ticket */
/** @typedef {import('./types.js').OrganizerApplication} OrganizerApplication */
/** @typedef {import('./types.js').ControllerEvent} ControllerEvent */
/** @typedef {import('./types.js').CheckInResult} CheckInResult */
/** @typedef {import('./types.js').AdminStats} AdminStats */
/** @typedef {import('./types.js').AdminEventPage} AdminEventPage */
/** @typedef {import('./types.js').AdminApplication} AdminApplication */

const BASE = '/api/v1';

export class ApiError extends Error {
  /**
   * @param {number} status  0 — tarmoq xatosi
   * @param {string} message backend xabari (AllExceptionsFilter: { statusCode, code, message })
   * @param {Record<string, unknown>} [body]
   */
  constructor(status, message, body = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get isNetwork() {
    return this.status === 0;
  }
}

/** Server soati bilan farq (ms) — buyurtma taymerlari uchun */
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;

/** Bir vaqtda bir nechta 401 kelsa ham refresh bitta bo'ladi */
/** @type {Promise<boolean> | null} */
let refreshing = null;

function refreshSession() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * @template T
 * @param {'GET' | 'POST' | 'PATCH' | 'DELETE'} method
 * @param {string} path
 * @param {{ body?: unknown, auth?: boolean }} [options] auth: false — 401 da refresh qilinmaydi (login, refresh)
 * @returns {Promise<T>}
 */
async function request(method, path, { body, auth = true } = {}) {
  /** @returns {Promise<Response>} */
  const send = () =>
    fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res;
  try {
    res = await send();
    if (res.status === 401 && auth && (await refreshSession())) {
      res = await send();
    }
  } catch {
    throw new ApiError(0, "Serverga ulanib bo'lmadi. Internetni tekshiring.");
  }

  const serverDate = Date.parse(res.headers.get('date') ?? '');
  if (!Number.isNaN(serverDate)) clockOffset = serverDate - Date.now();

  /** @type {unknown} */
  const parsed = await res.json().catch(() => ({}));
  const json =
    parsed && typeof parsed === 'object'
      ? /** @type {Record<string, unknown>} */ (parsed)
      : {};
  if (!res.ok) {
    const message =
      typeof json.message === 'string' ? json.message : 'Xatolik yuz berdi';
    throw new ApiError(res.status, message, json);
  }
  // Ko'p endpointlar { statusCode, data } qaytaradi; OTP servisi esa to'g'ridan-to'g'ri obyekt
  return /** @type {T} */ ('data' in json ? json.data : json);
}

const q = encodeURIComponent;

export const api = {
  auth: {
    /** @param {{ email: string, password: string }} dto */
    signUp: (dto) =>
      request('POST', '/auth/signup', { body: dto, auth: false }),
    /** @param {{ email: string, password: string }} dto @returns {Promise<OtpSent>} */
    signIn: (dto) =>
      request('POST', '/auth/signin', { body: dto, auth: false }),
    /** @param {{ email: string, code: string }} dto */
    confirm: (dto) =>
      request('POST', '/auth/confirm', { body: dto, auth: false }),
    signOut: () => request('POST', '/auth/signout', { auth: false }),
  },
  otp: {
    /** @param {string} email @returns {Promise<OtpSent>} */
    resend: (email) =>
      request('POST', '/otp/send', { body: { email }, auth: false }),
  },
  users: {
    /** @returns {Promise<User>} */
    me: () => request('GET', '/users/me'),
    /** fullName backend'da majburiy (UpdateUsersDto) @param {{ fullName: string, password?: string }} dto */
    updateMe: (dto) => request('PATCH', '/users/me', { body: dto }),
    /** @returns {Promise<OrganizerApplication[]>} */
    myApplications: () => request('GET', '/users/organizer-applications/me'),
    /** @param {{ companyName: string, phone: string, description: string }} dto @returns {Promise<OrganizerApplication>} */
    apply: (dto) =>
      request('POST', '/users/organizer-applications', { body: dto }),
  },
  events: {
    /** @param {number} page @param {number} limit @returns {Promise<EventPage>} */
    list: (page, limit) =>
      request('GET', `/events?page=${page}&limit=${limit}`, { auth: false }),
    /** @param {string} id @returns {Promise<EventDetail>} */
    get: (id) => request('GET', `/events/${q(id)}`, { auth: false }),
  },
  sessions: {
    /** @param {string} id @returns {Promise<SeatMap>} */
    seats: (id) => request('GET', `/sessions/${q(id)}/seats`, { auth: false }),
    /** @param {string} id @returns {Promise<GeneralCategory[]>} */
    categories: (id) =>
      request('GET', `/sessions/${q(id)}/categories`, { auth: false }),
  },
  orders: {
    /**
     * @param {{ sessionId: string, seatIds?: string[], items?: { ticketCategoryId: string, quantity: number }[] }} dto
     * @returns {Promise<CreatedOrder>}
     */
    create: (dto) => request('POST', '/orders', { body: dto }),
    /** @returns {Promise<OrderListItem[]>} */
    mine: () => request('GET', '/orders/me'),
    /** @param {string} id @returns {Promise<OrderDetail>} */
    get: (id) => request('GET', `/orders/${q(id)}`),
    /** @param {string} id */
    cancel: (id) => request('PATCH', `/orders/${q(id)}/cancel`),
  },
  payments: {
    /** Mock to'lov: natijani `success` belgilaydi @param {string} orderId @param {boolean} success @returns {Promise<PaymentResult>} */
    pay: (orderId, success) =>
      request('POST', `/payments/${q(orderId)}/pay`, { body: { success } }),
  },
  tickets: {
    /** @returns {Promise<Ticket[]>} */
    mine: () => request('GET', '/tickets/me'),
    /** @param {string} id @returns {Promise<Ticket>} */
    get: (id) => request('GET', `/tickets/${q(id)}`),
  },
  checkIn: {
    /** @returns {Promise<ControllerEvent[]>} */
    events: () => request('GET', '/check-in/events'),
    /** @param {string} qrCode @returns {Promise<CheckInResult>} */
    scan: (qrCode) => request('POST', '/check-in', { body: { qrCode } }),
  },
  admin: {
    /** @returns {Promise<AdminStats>} */
    stats: () => request('GET', '/admin/stats'),
    /** @param {string} status bo'sh — hammasi @param {number} page @returns {Promise<AdminEventPage>} */
    events: (status, page) =>
      request(
        'GET',
        `/admin/events?page=${page}&limit=20${status ? `&status=${q(status)}` : ''}`,
      ),
    /** @param {string} id */
    approveEvent: (id) => request('PATCH', `/events/${q(id)}/approve`),
    /** @param {string} id @param {string} rejectReason */
    rejectEvent: (id, rejectReason) =>
      request('PATCH', `/events/${q(id)}/reject`, { body: { rejectReason } }),
    /** @param {string} id */
    cancelEvent: (id) => request('PATCH', `/events/${q(id)}/cancel`),
    /** @param {string} status bo'sh — hammasi @returns {Promise<AdminApplication[]>} */
    applications: (status) =>
      request(
        'GET',
        `/admin/organizerapplications${status ? `?status=${q(status)}` : ''}`,
      ),
    /** @param {string} id */
    approveApplication: (id) => request('PATCH', `/admin/${q(id)}/approve`),
    /** @param {string} id @param {string} rejectReason */
    rejectApplication: (id, rejectReason) =>
      request('PATCH', `/admin/${q(id)}/reject`, {
        body: rejectReason ? { rejectReason } : {},
      }),
  },
};
