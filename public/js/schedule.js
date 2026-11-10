// @ts-check
// Seans ro'yxatidan "hozirgi yoki eng yaqin" seansni tanlash (kontroller sahifalari).

/** Boshlangandan keyin shuncha vaqt davomida seans hali "joriy" hisoblanadi (kirish davom etadi) */
const RUNNING_WINDOW_MS = 6 * 3600_000;

/**
 * @template {{ startTime: string }} T
 * @param {T[]} sessions  startTime bo'yicha o'sish tartibida
 * @param {number} [now]
 * @returns {T | null}
 */
export function currentOrNextSession(sessions, now = Date.now()) {
  return (
    sessions.find((s) => Date.parse(s.startTime) > now - RUNNING_WINDOW_MS) ??
    sessions.at(-1) ??
    null
  );
}
