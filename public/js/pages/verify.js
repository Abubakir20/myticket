// @ts-check
// OTP tasdiqlash (dizayn 1c–1e, 1k). /auth/confirm muvaffaqiyatli bo'lsa backend cookie o'rnatadi.

import { api, ApiError } from '../api.js';
import * as fmt from '../format.js';
import { routes, safeNext } from '../routes.js';
import {
  readPendingLogin,
  savePendingLogin,
  clearPendingLogin,
  getUser,
} from '../session.js';
import { themeButton } from '../shell.js';
import * as v from '../validate.js';
import { $, h, setBanner, withBusy, errorMessage, every } from '../ui.js';

/** @typedef {import('../session.js').PendingLogin} PendingLogin */

const pendingOrNull = readPendingLogin();
if (!pendingOrNull) location.replace(routes.login());
const pending = /** @type {PendingLogin} */ (
  pendingOrNull ?? {
    email: '',
    expiresAt: null,
    resendAt: 0,
    fullName: null,
    next: null,
  }
);

const form = /** @type {HTMLFormElement} */ ($('form'));
const input = /** @type {HTMLInputElement} */ ($('code'));
const otp = $('otp');
const cells = [...otp.querySelectorAll('.cell')];
const codeError = $('code-error');
const hint = $('hint');
const banner = $('banner');
const sub = $('sub');
const submit = /** @type {HTMLButtonElement} */ ($('submit'));
const resendRow = $('resend-row');
const resendTimer = $('resend-timer');
const resendInline = /** @type {HTMLButtonElement} */ ($('resend'));
const resendPrimary = /** @type {HTMLButtonElement} */ ($('resend-primary'));

$('theme').append(themeButton());
$('email').textContent = pending.email;
/** @type {HTMLAnchorElement} */ ($('change-link')).href = pending.fullName
  ? routes.register(pending.next ?? '')
  : routes.login(pending.next ?? '');

/** @typedef {'input' | 'error' | 'expired'} OtpState */
/** @type {OtpState} */
let state = 'input';

// ---------- Kataklar ----------

function renderCells() {
  const value = input.value;
  cells.forEach((cell, i) => {
    cell.replaceChildren(
      value[i] ??
        (i === value.length && state === 'input'
          ? h('div', { class: 'dot9' })
          : ''),
    );
    cell.classList.toggle(
      'current',
      i === Math.min(value.length, 5) && state === 'input',
    );
  });
}

input.addEventListener('input', () => {
  input.value = input.value.replace(/\D/g, '').slice(0, 6);
  if (state === 'error') setState('input');
  renderCells();
  if (input.value.length === 6) form.requestSubmit();
});
input.addEventListener('focus', renderCells);

/** @param {OtpState} next @param {string | null} [message] */
function setState(next, message = null) {
  state = next;
  otp.dataset.state = next;
  codeError.hidden = next !== 'error';
  codeError.textContent = message ?? '';
  const expired = next === 'expired';
  setBanner(banner, expired ? message : null);
  sub.hidden = expired;
  hint.hidden = expired;
  resendRow.hidden = expired;
  resendPrimary.hidden = !expired;
  submit.className = expired
    ? 'btn btn-secondary btn-block'
    : 'btn btn-primary btn-block';
  if (expired) input.value = '';
  renderCells();
}

// ---------- Taymerlar ----------

every(() => {
  const now = Date.now();
  if (pending.expiresAt !== null) {
    const left = Math.ceil((pending.expiresAt - now) / 1000);
    if (left <= 0 && state !== 'expired') {
      setState(
        'expired',
        `Kod muddati tugadi. Yangi kod so'rang — har bir kod ${ttlLabel()} amal qiladi.`,
      );
    }
    hint.textContent =
      left > 0 ? `Kod ${fmt.countdown(left)} davomida amal qiladi.` : '';
  } else {
    hint.textContent = 'Emailingizga yuborilgan oxirgi kodni kiriting.';
  }
  const wait = Math.ceil((pending.resendAt - now) / 1000);
  resendTimer.hidden = wait <= 0;
  resendInline.hidden = wait > 0;
  resendTimer.textContent = fmt.countdown(wait);
  resendPrimary.disabled = wait > 0;
  resendPrimary.textContent =
    wait > 0 ? `Qayta yuborish · ${fmt.countdown(wait)}` : 'Qayta yuborish';
});

/** Kodning umumiy amal qilish muddati (dizayndagi "5 daqiqa" o'rniga backend qiymati) */
function ttlLabel() {
  const seconds = pending.ttl ?? 180;
  return seconds % 60 === 0 ? `${seconds / 60} daqiqa` : `${seconds} soniya`;
}

// ---------- Tasdiqlash ----------

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (state === 'expired') return;
  const message = v.otpCode(input.value);
  if (message) {
    setState('error', message);
    input.focus();
    return;
  }
  void withBusy(
    submit,
    async () => {
      try {
        await api.auth.confirm({ email: pending.email, code: input.value });
      } catch (error) {
        handleConfirmError(error);
        return;
      }
      await finishLogin();
    },
    'Tekshirilmoqda…',
  );
});

/** @param {unknown} error */
function handleConfirmError(error) {
  if (
    error instanceof ApiError &&
    error.status === 400 &&
    /muddati/i.test(error.message)
  ) {
    setState(
      'expired',
      `Kod muddati tugadi. Yangi kod so'rang — har bir kod ${ttlLabel()} amal qiladi.`,
    );
  } else if (error instanceof ApiError && error.status === 400) {
    setState('error', "Kod noto'g'ri. Qayta kiriting.");
    input.value = '';
    renderCells();
    input.focus();
  } else if (error instanceof ApiError && error.status === 429) {
    setState('expired', "Urinishlar soni tugadi. Yangi kod so'rang.");
  } else {
    setBanner(banner, errorMessage(error));
  }
}

async function finishLogin() {
  // Ro'yxatdan o'tishda kiritilgan ism — signup uni qabul qilmagani uchun shu yerda saqlanadi
  if (pending.fullName) {
    await api.users.updateMe({ fullName: pending.fullName }).catch(() => {});
  }
  clearPendingLogin();
  const user = await getUser().catch(() => null);
  const target =
    user?.role === 'CONTROLLER'
      ? routes.controller()
      : (safeNext(pending.next) ?? routes.home());
  location.replace(target);
}

// ---------- Qayta yuborish ----------

async function resend() {
  setBanner(banner, null);
  try {
    const sent = await api.otp.resend(pending.email);
    const now = Date.now();
    pending.expiresAt = now + sent.expiresIn * 1000;
    pending.resendAt = now + sent.resendAfter * 1000;
    pending.ttl = sent.expiresIn;
    savePendingLogin(pending);
    setState('input');
    sub.hidden = false;
    input.focus();
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      pending.resendAt =
        Date.now() + (Number(error.body.retryAfter) || 60) * 1000;
      savePendingLogin(pending);
      return;
    }
    setBanner(banner, errorMessage(error));
  }
}
resendInline.addEventListener(
  'click',
  () => void withBusy(resendInline, resend),
);
resendPrimary.addEventListener(
  'click',
  () => void withBusy(resendPrimary, resend, 'Yuborilmoqda…'),
);

setState('input');
input.focus();
