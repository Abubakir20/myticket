// @ts-check
// O'rindiq va toifa sahifalari uchun umumiy: seans kontekstini yuklash, tanlovni saqlash
// (login'ga ketib qaytganda yo'qolmasligi uchun) va buyurtma berish.

import { api, ApiError } from './api.js';
import * as fmt from './format.js';
import { routes, currentPath } from './routes.js';
import { getUser } from './session.js';

/** @typedef {import('./types.js').EventDetail} EventDetail */
/** @typedef {import('./types.js').EventSession} EventSession */

export const MAX_TICKETS = 5;

/**
 * Seans tadbir javobidan olinadi (alohida GET /sessions/:id endpoint yo'q).
 * @param {string} eventId
 * @param {string} sessionId
 * @returns {Promise<{ event: EventDetail, session: EventSession }>}
 */
export async function loadSessionContext(eventId, sessionId) {
  const event = await api.events.get(eventId);
  const session = event.sessions.find((s) => s.id === sessionId);
  if (!session) throw new ApiError(404, 'Seans topilmadi yoki bekor qilingan');
  return { event, session };
}

/** "Shoxrux · 1-noyabr, 19:00" @param {EventDetail} event @param {EventSession} session */
export const sessionTitle = (event, session) =>
  `${event.title} · ${fmt.dateTime(session.startTime)}`;

// ---------- Tanlov qoralamasi ----------

/** @param {string} sessionId */
const draftKey = (sessionId) => `chipta:draft:${sessionId}`;

/** @template T @param {string} sessionId @returns {T | null} */
export function readDraft(sessionId) {
  try {
    const raw = sessionStorage.getItem(draftKey(sessionId));
    return raw ? /** @type {T} */ (JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** @param {string} sessionId @param {unknown} value */
export function saveDraft(sessionId, value) {
  try {
    sessionStorage.setItem(draftKey(sessionId), JSON.stringify(value));
  } catch {
    // Saqlanmasa foydalanuvchi qayta tanlaydi
  }
}

/** @param {string} sessionId */
export function clearDraft(sessionId) {
  try {
    sessionStorage.removeItem(draftKey(sessionId));
  } catch {
    // e'tiborsiz
  }
}

// ---------- Buyurtma ----------

/**
 * Buyurtma yaratadi va to'lov sahifasiga o'tadi. Kirmagan foydalanuvchi tanlovi saqlanib login'ga yuboriladi.
 * Xatoni chaqiruvchi ko'rsatadi (409 — joy band, 400 — qoida buzilgan va h.k.).
 * @param {{ sessionId: string, seatIds?: string[], items?: { ticketCategoryId: string, quantity: number }[] }} dto
 * @param {unknown} draft
 */
export async function placeOrder(dto, draft) {
  const user = await getUser();
  if (!user) {
    saveDraft(dto.sessionId, draft);
    location.assign(routes.login(currentPath()));
    return;
  }
  if (user.role !== 'CUSTOMER') {
    throw new ApiError(403, 'Chipta faqat mijoz akkaunti orqali sotib olinadi');
  }
  try {
    const order = await api.orders.create(dto);
    clearDraft(dto.sessionId);
    location.assign(routes.checkout(order.orderId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      saveDraft(dto.sessionId, draft);
      location.assign(routes.login(currentPath()));
      return;
    }
    throw error;
  }
}
