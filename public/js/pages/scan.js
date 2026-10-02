// @ts-check
// QR skaner (dizayn 4b–4g). POST /check-in { qrCode }.
// Kamera: brauzerning BarcodeDetector API'si (Chrome/Android, Safari 17+). Qo'llab-quvvatlanmasa —
// faqat qo'lda kiritish. Natija kodlari: 200 ruxsat, 409 ishlatilgan, 400 bekor qilingan, 404 topilmadi, 403 biriktirilmagan.

import { api, ApiError } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { currentOrNextSession } from '../schedule.js';
import { requireUser } from '../session.js';
import * as v from '../validate.js';
import { $, setFieldError, toast, withBusy, errorMessage } from '../ui.js';

/** @typedef {import('../types.js').CheckInResult} CheckInResult */

/**
 * Shape Detection API (TypeScript DOM kutubxonasida hali yo'q)
 * @typedef {{ detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }} BarcodeDetector
 * @typedef {{
 *   new (options: { formats: string[] }): BarcodeDetector,
 *   getSupportedFormats(): Promise<string[]>,
 * }} BarcodeDetectorConstructor
 */

const eventId = param('event');
const video = /** @type {HTMLVideoElement} */ ($('video'));
const hint = $('scanhint');
const form = /** @type {HTMLFormElement} */ ($('manual'));
const codeInput = /** @type {HTMLInputElement} */ ($('code'));
const checkButton = /** @type {HTMLButtonElement} */ ($('check'));
const result = $('result');
const resultNext = /** @type {HTMLButtonElement} */ ($('result-next'));

let busy = false;
/** @type {MediaStream | null} */
let stream = null;
let lastCode = '';
/** Natija tugmasi: keyingi chipta yoki (403 da) tadbirlar ro'yxatiga qaytish */
let leaveOnClose = false;

void init();

async function init() {
  await requireUser(['CONTROLLER']);
  void loadEventHeader();
  await startCamera();
}

async function loadEventHeader() {
  if (!eventId) return;
  try {
    const events = await api.checkIn.events();
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    $('event-title').textContent = event.title;
    document.title = `Skanerlash · ${event.title} — Chipta`;
    const session = currentOrNextSession(event.sessions);
    if (session)
      $('event-date').textContent =
        `${fmt.dateTime(session.startTime)} · ${session.venue.name}`;
  } catch {
    // Sarlavhasiz ham skaner ishlaydi
  }
}

// ---------- Kamera ----------

async function startCamera() {
  const Detector =
    /** @type {{ BarcodeDetector?: BarcodeDetectorConstructor }} */ (
      /** @type {unknown} */ (window)
    ).BarcodeDetector;
  if (!Detector || !navigator.mediaDevices?.getUserMedia) {
    hint.textContent =
      "Bu brauzerda kamera orqali skanerlash yo'q — kodni pastda qo'lda kiriting";
    return;
  }
  try {
    const formats = await Detector.getSupportedFormats();
    if (!formats.includes('qr_code')) throw new Error("qr_code yo'q");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
  } catch {
    hint.textContent =
      "Kameraga ruxsat berilmadi — kodni pastda qo'lda kiriting";
    return;
  }
  video.srcObject = stream;
  video.hidden = false;
  await video.play().catch(() => {});
  const detector = new Detector({ formats: ['qr_code'] });

  const loop = async () => {
    if (!stream) return;
    if (!busy && result.hidden && video.readyState >= 2) {
      try {
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue?.trim();
        // Bir kodni ketma-ket qayta yubormaslik uchun
        if (value && value !== lastCode) {
          lastCode = value;
          await check(value);
        }
      } catch {
        // Kadr o'qilmadi — keyingisini kutamiz
      }
    }
    setTimeout(() => void loop(), 250);
  };
  void loop();
}

window.addEventListener('pagehide', () => {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
});

// ---------- Tekshirish ----------

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const message = v.uuid(codeInput.value);
  setFieldError(codeInput, message);
  if (message) {
    codeInput.focus();
    return;
  }
  void withBusy(
    checkButton,
    () => check(codeInput.value.trim()),
    'Tekshirilmoqda…',
  );
});
codeInput.addEventListener('input', () => setFieldError(codeInput, null));

/** @param {string} qrCode */
async function check(qrCode) {
  if (busy) return;
  busy = true;
  try {
    const data = await api.checkIn.scan(qrCode);
    showResult(
      'ok',
      '✓',
      'Kirish ruxsat etildi',
      successMeta(data),
      'Keyingi chiptani skanerlash',
    );
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.isNetwork ||
      error.status >= 500
    ) {
      toast(errorMessage(error));
      lastCode = '';
      return;
    }
    switch (error.status) {
      case 409:
        showResult(
          'warn',
          '!',
          'Chipta allaqachon ishlatilgan',
          'Bu chipta bilan kirish qayd etilgan',
          'Keyingi chiptani skanerlash',
        );
        break;
      case 400:
        if (/uuid/i.test(error.message)) {
          showResult(
            'err',
            '?',
            'Chipta topilmadi',
            "Kod noto'g'ri formatda.\nKodni tekshirib qayta urinib ko'ring.",
            'Keyingi chiptani skanerlash',
          );
        } else {
          showResult(
            'err',
            '✕',
            'Chipta bekor qilingan',
            'Buyurtma yoki seans bekor qilingan',
            'Keyingi chiptani skanerlash',
          );
        }
        break;
      case 404:
        showResult(
          'err',
          '?',
          'Chipta topilmadi',
          "Kiritilgan kod bo'yicha chipta topilmadi.\nKodni tekshirib qayta urinib ko'ring.",
          'Keyingi chiptani skanerlash',
        );
        break;
      case 403:
        showResult(
          'err',
          '⊘',
          "Ruxsat yo'q",
          'Siz bu tadbirga kontroller\nsifatida biriktirilmagansiz',
          'Orqaga',
        );
        leaveOnClose = true;
        break;
      default:
        toast(error.message);
        lastCode = '';
    }
  } finally {
    busy = false;
  }
}

/** @param {CheckInResult} data */
function successMeta(data) {
  return [
    data.event.title,
    fmt.dateTime(data.startTime),
    fmt.seatLabel(data.category, data.seat),
  ].join('\n');
}

/**
 * @param {'ok' | 'warn' | 'err'} tone
 * @param {string} icon
 * @param {string} title
 * @param {string} meta
 * @param {string} action
 */
function showResult(tone, icon, title, meta, action) {
  leaveOnClose = false;
  result.className = `result ${tone}`;
  $('result-icon').textContent = icon;
  $('result-title').textContent = title;
  $('result-meta').textContent = meta;
  resultNext.textContent = action;
  result.hidden = false;
  // Tebranish faqat foydalanuvchi sahifa bilan ishlagandan keyin ruxsat etiladi
  if (navigator.userActivation?.hasBeenActive) {
    navigator.vibrate?.(tone === 'ok' ? 80 : [60, 60, 60]);
  }
  resultNext.focus();
}

function closeResult() {
  if (leaveOnClose) {
    location.assign(routes.controller());
    return;
  }
  result.hidden = true;
  codeInput.value = '';
  lastCode = '';
  codeInput.focus();
}
resultNext.addEventListener('click', closeResult);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !result.hidden) closeResult();
});
