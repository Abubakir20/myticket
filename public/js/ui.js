// @ts-check
// DOM yordamchilari va umumiy UI bo'laklari (holatlar, toast, forma xatolari, modal, afisha).

import { ApiError } from './api.js';

/** @typedef {Node | string | number | null | undefined | false} Child */

/**
 * Kichik element quruvchi. Matn doim textContent orqali qo'yiladi (XSS'dan himoya).
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, unknown> | null} [attrs]  class, text, on:{click}, dataset:{}, style, boshqa atributlar
 * @param {...(Child | Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'on') {
      const handlers = /** @type {Record<string, EventListener>} */ (value);
      for (const [ev, fn] of Object.entries(handlers))
        el.addEventListener(ev, fn);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, /** @type {Record<string, string>} */ (value));
    } else if (key === 'text') el.textContent = attrText(value);
    else if (key === 'class') el.className = /** @type {string} */ (value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, attrText(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'number' ? String(child) : child);
  }
  return el;
}

/** Atribut/matn qiymati: faqat satr va son qabul qilinadi @param {unknown} value */
function attrText(value) {
  if (typeof value === 'string') return value;
  return typeof value === 'number' ? String(value) : '';
}

/** Bir nechta tugun (null'lar tashlab yuboriladi) @param {...(Child | Child[])} children */
export function frag(...children) {
  const fragment = document.createDocumentFragment();
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    fragment.append(typeof child === 'number' ? String(child) : child);
  }
  return fragment;
}

/** @param {string} id @returns {HTMLElement} */
export function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} topilmadi`);
  return el;
}

/** @template {HTMLElement} T @param {string} id @returns {T} */
export const $ = (id) => /** @type {T} */ (byId(id));

// ---------- Sahifa holatlari ----------

/** @param {HTMLElement} target @param {string} [label] */
export function showLoading(target, label = 'Yuklanmoqda…') {
  target.replaceChildren(
    h(
      'div',
      { class: 'state', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'spinner', 'aria-hidden': 'true' }),
      h('p', { text: label }),
    ),
  );
}

/**
 * @param {HTMLElement} target
 * @param {string} message
 * @param {{ label: string, href?: string, onClick?: () => void } | null} [action]
 */
export function showEmpty(target, message, action = null) {
  target.replaceChildren(
    h('div', { class: 'state' }, h('p', { text: message }), actionNode(action)),
  );
}

/**
 * API xatosini foydalanuvchiga tushunarli ko'rinishda chiqaradi.
 * @param {HTMLElement} target
 * @param {unknown} error
 * @param {() => unknown} [retry]  async bo'lishi mumkin — natijasi kutilmaydi
 */
export function showError(target, error, retry) {
  target.replaceChildren(
    h(
      'div',
      { class: 'state', role: 'alert' },
      h('p', { text: errorMessage(error) }),
      retry
        ? actionNode({
            label: "Qayta urinib ko'rish",
            onClick: () => void retry(),
          })
        : null,
    ),
  );
}

/** @param {{ label: string, href?: string, onClick?: () => void } | null} action */
function actionNode(action) {
  if (!action) return null;
  return action.href
    ? h('a', {
        class: 'btn btn-secondary',
        href: action.href,
        text: action.label,
      })
    : h('button', {
        class: 'btn btn-secondary',
        type: 'button',
        text: action.label,
        on: { click: action.onClick },
      });
}

/** @param {unknown} error */
export function errorMessage(error) {
  if (error instanceof ApiError) {
    if (error.isNetwork) return error.message;
    if (error.status === 403) return "Bu sahifaga kirish huquqingiz yo'q";
    if (error.status >= 500)
      return "Serverda xatolik. Birozdan so'ng qayta urinib ko'ring.";
    return error.message;
  }
  return 'Kutilmagan xatolik yuz berdi';
}

// ---------- Toast ----------

/** @type {HTMLElement | null} */
let toastEl = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let toastTimer;

/** @param {string} message */
export function toast(message) {
  if (!toastEl) {
    toastEl = h('div', {
      class: 'toast',
      role: 'status',
      'aria-live': 'polite',
    });
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl?.classList.remove('show'), 2600);
}

// ---------- Formalar ----------

/**
 * Maydon ostiga xato chiqaradi (yoki tozalaydi). Xato matni aria-describedby bilan bog'lanadi.
 * @param {HTMLInputElement | HTMLTextAreaElement} input
 * @param {string | null} message
 */
export function setFieldError(input, message) {
  const id = `${input.id}-error`;
  let node = document.getElementById(id);
  if (message) {
    if (!node) {
      node = h('p', { class: 'field-error', id });
      input.insertAdjacentElement('afterend', node);
    }
    node.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', id);
  } else {
    node?.remove();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

/**
 * Maydonlarni tekshiradi, xatolarni chiqaradi va birinchi xatoli maydonga fokus beradi.
 * @param {[HTMLInputElement | HTMLTextAreaElement, (value: string) => string | null][]} rules
 * @returns {boolean} hammasi to'g'ri bo'lsa true
 */
export function validateFields(rules) {
  /** @type {HTMLInputElement | HTMLTextAreaElement | null} */
  let firstInvalid = null;
  for (const [input, rule] of rules) {
    const message = rule(input.value);
    setFieldError(input, message);
    if (message && !firstInvalid) firstInvalid = input;
  }
  firstInvalid?.focus();
  return !firstInvalid;
}

/** Xato bo'lgan maydon tahrirlanganda xatoni olib tashlaydi @param {HTMLFormElement} form */
export function clearErrorsOnInput(form) {
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (
      (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement) &&
      target.getAttribute('aria-invalid') === 'true'
    ) {
      setFieldError(target, null);
    }
  });
}

/**
 * Formadagi umumiy xato banneri
 * @param {HTMLElement} banner
 * @param {string | null} message
 */
export function setBanner(banner, message) {
  banner.hidden = !message;
  banner.textContent = message ?? '';
}

/**
 * Tugmani so'rov davomida bloklaydi — ikki marta yuborishdan himoya.
 * @template T
 * @param {HTMLButtonElement} button
 * @param {() => Promise<T>} task
 * @param {string} [busyLabel]
 * @returns {Promise<T>}
 */
export async function withBusy(button, task, busyLabel) {
  const label = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  if (busyLabel) button.textContent = busyLabel;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = label;
  }
}

// ---------- Modal ----------

/**
 * Modalni ochadi: fokus ichkarida aylanadi, Escape va fon bosilganda yopiladi,
 * yopilganda fokus avvalgi elementga qaytadi.
 * @param {HTMLElement} backdrop  .modalbg
 * @param {() => void} [onClose]
 * @returns {() => void} yopish funksiyasi
 */
export function openModal(backdrop, onClose) {
  const previous = document.activeElement;
  backdrop.hidden = false;
  const focusables = () =>
    /** @type {HTMLElement[]} */ ([
      ...backdrop.querySelectorAll('button, input, textarea, select, a[href]'),
    ]).filter((el) => !el.hasAttribute('disabled'));
  focusables()[0]?.focus();

  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab') return;
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  /** @param {MouseEvent} e */
  const onClick = (e) => {
    if (e.target === backdrop) close();
  };

  function close() {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    document.removeEventListener('keydown', onKey);
    backdrop.removeEventListener('click', onClick);
    if (previous instanceof HTMLElement) previous.focus();
    onClose?.();
  }
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', onClick);
  return close;
}

// ---------- Afisha ----------

/** Bir xil tadbir doim bir xil zaxira gradient oladi @param {string} id */
export function fallbackClass(id) {
  let sum = 0;
  for (const ch of id) sum = (sum + ch.charCodeAt(0)) % 997;
  return `poster-fallback-${sum % 5}`;
}

/**
 * Afisha rasmi; yuklanmasa gradient ko'rinib qoladi.
 * @param {string} url
 * @param {string} alt
 */
export function posterImage(url, alt) {
  const img = h('img', {
    class: 'poster-img',
    src: url,
    alt,
    loading: 'lazy',
    decoding: 'async',
  });
  img.addEventListener('error', () => img.remove(), { once: true });
  return img;
}

/**
 * Har soniyada chaqiriladigan taymer; sahifa yashirin bo'lsa ham to'g'ri vaqtni ko'rsatadi
 * (hisob server vaqtidan olinadi, interval soniga emas).
 * @param {() => boolean | void} tick  true qaytarsa taymer to'xtaydi
 * @returns {() => void} to'xtatish
 */
export function every(tick) {
  if (tick()) return () => {};
  const handle = setInterval(() => {
    if (tick()) clearInterval(handle);
  }, 1000);
  return () => clearInterval(handle);
}
