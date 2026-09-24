// O'rindiq vaqtincha band qilinganda Redis'ga yoziladigan kalit.
// Qiymati — orderId. GET /sessions/:id/seats ham shu kalit orqali HELD holatini aniqlaydi.
export function seatHoldKey(sessionId: string, seatId: string) {
  return `seat-hold:${sessionId}:${seatId}`;
}
