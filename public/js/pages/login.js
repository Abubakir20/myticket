// @ts-check
// Kirish (dizayn 1f–1i). /auth/signin email+parolni tekshiradi va emailga OTP yuboradi,
// keyin /verify/ sahifasida kod tasdiqlanadi.

import { api, ApiError } from '../api.js';
import { routes, param, safeNext } from '../routes.js';
import { getUser, afterLogin, savePendingLogin } from '../session.js';
import { themeButton } from '../shell.js';
import * as v from '../validate.js';
import {
  $,
  setBanner,
  setFieldError,
  validateFields,
  clearErrorsOnInput,
  withBusy,
  errorMessage,
  passwordToggle,
} from '../ui.js';

const form = /** @type {HTMLFormElement} */ ($('form'));
const emailInput = /** @type {HTMLInputElement} */ ($('email'));
const passwordInput = /** @type {HTMLInputElement} */ ($('password'));
const submit = /** @type {HTMLButtonElement} */ ($('submit'));
const banner = $('banner');
const next = safeNext(param('next'));

$('theme').append(themeButton());
/** @type {HTMLAnchorElement} */ ($('register-link')).href = routes.register(
  next ?? '',
);
emailInput.value = param('email') ?? '';
clearErrorsOnInput(form);
passwordToggle(passwordInput);

// Allaqachon kirgan bo'lsa login sahifasi kerak emas
void getUser().then(
  (user) => {
    if (user) location.replace(afterLogin(user));
  },
  () => {},
);

const INVALID = "Email yoki parol noto'g'ri";

form.addEventListener('submit', (event) => {
  event.preventDefault();
  setBanner(banner, null);
  const ok = validateFields([
    [emailInput, v.email],
    [passwordInput, (value) => (value ? null : 'Parolni kiriting')],
  ]);
  if (!ok) return;

  const email = emailInput.value.trim().toLowerCase();
  // Backend kuchsiz parolni qabul qilmaydi — so'rov yubormasdan umumiy xatoni ko'rsatamiz
  if (v.strongPassword(passwordInput.value)) {
    showInvalid();
    return;
  }

  void withBusy(
    submit,
    async () => {
      try {
        const sent = await api.auth.signIn({
          email,
          password: passwordInput.value,
        });
        goVerify(email, sent.expiresIn, sent.resendAfter, sent.demoCode);
      } catch (error) {
        if (error instanceof ApiError && error.status === 400)
          return showInvalid();
        if (error instanceof ApiError && error.status === 429) {
          // Kod yaqinda yuborilgan — o'sha kodni kiritish mumkin
          const retryAfter = Number(error.body.retryAfter) || 60;
          return goVerify(email, null, retryAfter);
        }
        setBanner(banner, errorMessage(error));
      }
    },
    'Tekshirilmoqda…',
  );
});

function showInvalid() {
  setBanner(banner, INVALID);
  setFieldError(passwordInput, null);
  passwordInput.setAttribute('aria-invalid', 'true');
  passwordInput.focus();
  passwordInput.select();
}

/**
 * @param {string} email
 * @param {number | null} expiresIn
 * @param {number} resendAfter
 * @param {string} [demoCode]  demo rejimda kodning o'zi
 */
function goVerify(email, expiresIn, resendAfter, demoCode) {
  const now = Date.now();
  savePendingLogin({
    email,
    expiresAt: expiresIn === null ? null : now + expiresIn * 1000,
    resendAt: now + resendAfter * 1000,
    ttl: expiresIn,
    fullName: null,
    next,
    demoCode: demoCode ?? null,
  });
  location.assign(routes.verify());
}
