// @ts-check
// Ro'yxatdan o'tish (dizayn 1a, 1b). Backend oqimi: /auth/signup (email, parol) → /auth/signin (OTP yuboradi)
// → /verify/. Signup fullName qabul qilmaydi, shuning uchun ism kod tasdiqlangach PATCH /users/me bilan yoziladi.

import { api, ApiError } from '../api.js';
import { routes, param, safeNext } from '../routes.js';
import { getUser, afterLogin, savePendingLogin } from '../session.js';
import { themeButton } from '../shell.js';
import * as v from '../validate.js';
import {
  $,
  h,
  setBanner,
  setFieldError,
  validateFields,
  clearErrorsOnInput,
  withBusy,
  errorMessage,
} from '../ui.js';

const form = /** @type {HTMLFormElement} */ ($('form'));
const nameInput = /** @type {HTMLInputElement} */ ($('fullName'));
const emailInput = /** @type {HTMLInputElement} */ ($('email'));
const passwordInput = /** @type {HTMLInputElement} */ ($('password'));
const submit = /** @type {HTMLButtonElement} */ ($('submit'));
const banner = $('banner');
const next = safeNext(param('next'));

$('theme').append(themeButton());
/** @type {HTMLAnchorElement} */ ($('login-link')).href = routes.login(
  next ?? '',
);
clearErrorsOnInput(form);

void getUser().then(
  (user) => {
    if (user) location.replace(afterLogin(user));
  },
  () => {},
);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  setBanner(banner, null);
  const ok = validateFields([
    [nameInput, v.fullName],
    [emailInput, v.email],
    [passwordInput, v.strongPassword],
  ]);
  if (!ok) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  void withBusy(
    submit,
    async () => {
      try {
        await api.auth.signUp({ email, password });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setFieldError(emailInput, 'Bu email bilan akkaunt allaqachon mavjud');
          banner.hidden = false;
          banner.replaceChildren(
            h('span', { text: 'Akkauntingiz bormi?' }),
            h('a', {
              href: `${routes.login(next ?? '')}${next ? '&' : '?'}email=${encodeURIComponent(email)}`,
              text: 'Kirish →',
            }),
          );
          emailInput.focus();
          return;
        }
        setBanner(banner, errorMessage(error));
        return;
      }

      try {
        const sent = await api.auth.signIn({ email, password });
        const now = Date.now();
        savePendingLogin({
          email,
          expiresAt: now + sent.expiresIn * 1000,
          resendAt: now + sent.resendAfter * 1000,
          ttl: sent.expiresIn,
          fullName: nameInput.value.trim(),
          next,
        });
        location.assign(routes.verify());
      } catch (error) {
        // Akkaunt yaratildi, faqat kod yuborilmadi — login orqali davom etish mumkin
        setBanner(
          banner,
          `Akkaunt yaratildi, lekin tasdiqlash kodi yuborilmadi (${errorMessage(error)}). Kirish sahifasidan qayta urinib ko'ring.`,
        );
      }
    },
    'Yuborilmoqda…',
  );
});
