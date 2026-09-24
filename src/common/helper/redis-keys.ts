// O'rindiq vaqtincha band qilinganda Redis'ga yoziladigan kalit.
// Qiymati — orderId. GET /sessions/:id/seats ham shu kalit orqali HELD holatini aniqlaydi.
export function seatHoldKey(sessionId: string, seatId: string) {
  return `seat-hold:${sessionId}:${seatId}`;
}

// Tadbirlar keshi (TZ 5-bo'lim). TTL — 60 soniya.
export const EVENT_CACHE_TTL = 60;
export const EVENT_CACHE_PATTERN = 'cache:events:*';

export function eventListCacheKey(page: number, limit: number) {
  return `cache:events:list:${page}:${limit}`;
}

export function eventCacheKey(eventId: string) {
  return `cache:events:${eventId}`;
}
