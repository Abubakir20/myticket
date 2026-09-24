// @ts-check
// To'lov sahifasi: /checkout/?orderId=<uuid>. GET /orders/:id, POST /payments/:orderId/pay (mock),
// PATCH /orders/:id/cancel. Muddati tugasa (taymer yoki 410) — "muddati tugadi" holati.

import { api, ApiError, serverNow } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { requireUser } from '../session.js';
import * as v from '../validate.js';
import {
  $,
  h,
  openModal,
  validateFields,
  clearErrorsOnInput,
  withBusy,
  errorMessage,
  every,
} from '../ui.js';

/** @typedef {import('../types.js').OrderDetail} OrderDetail */
/** @typedef {'loading' | 'summary' | 'success' | 'failed' | 'expired' | 'cancelled' | 'error'} View */

const WARN_SECONDS = 60;
const orderId = param('orderId');

/** @type {OrderDetail | null} */
let order = null;
let stopTimer = () => {};
/** @type {(() => void) | null} */
let closeModal = null;

const payForm = /** @type {HTMLFormElement} */ ($('pay-form'));
const cardNumber = /** @type {HTMLInputElement} */ ($('card-number'));
const cardExp = /** @type {HTMLInputElement} */ ($('card-exp'));
const cardCvv = /** @type {HTMLInputElement} */ ($('card-cvv'));
const payError = $('pay-error');
const summaryError = $('summary-error');

/** @param {View} view */
function show(view) {
  document.querySelectorAll('[data-view]').forEach((el) => {
    /** @type {HTMLElement} */ (el).hidden =
      /** @type {HTMLElement} */ (el).dataset.view !== view;
  });
  if (view !== 'summary') {
    stopTimer();
    closeModal?.();
  }
}

/** @param {string} message */
function showError(message) {
  $('error-text').textContent = message;
  show('error');
}

/** @param {unknown} error @param {HTMLElement} [inline] shu joyda ko'rsatiladi (sahifa almashmaydi) */
function handleError(error, inline) {
  if (error instanceof ApiError && error.status === 410) return show('expired');
  if (error instanceof ApiError && error.status === 404)
    return showError('Buyurtma topilmadi');
  if (inline) {
    inline.textContent = errorMessage(error);
    inline.hidden = false;
    return;
  }
  showError(errorMessage(error));
}

// ---------- Yuklash ----------

async function load() {
  if (!orderId) return showError("Buyurtma ko'rsatilmagan");
  show('loading');
  await requireUser(['CUSTOMER']);
  try {
    order = await api.orders.get(orderId);
  } catch (error) {
    return handleError(error);
  }
  const eventHref = routes.event(order.session.event.id);
  document.querySelectorAll('[data-event-link]').forEach((a) => {
    /** @type {HTMLAnchorElement} */ (a).href = eventHref;
  });

  switch (order.status) {
    case 'PAID':
      return show('success');
    case 'EXPIRED':
      return show('expired');
    case 'CANCELLED':
      return show('cancelled');
    default:
      if (secondsLeft() === 0) return show('expired');
      renderSummary(order);
  }
}

/** @param {OrderDetail} o */
function renderSummary(o) {
  const meta = `${fmt.dateTime(o.session.startTime)} · ${o.session.venue.name}`;
  $('order-lines').replaceChildren(
    ...o.items.map((item) =>
      h(
        'div',
        { class: 'oline' },
        h(
          'div',
          null,
          `${o.session.event.title} · ${fmt.seatLabel(item.ticketCategory.name, item.seat)}`,
          h('small', { text: meta }),
        ),
        h('div', { text: fmt.price(item.price) }),
      ),
    ),
  );
  $('order-total').textContent = fmt.price(o.totalPrice);
  $('pay-amount').textContent = fmt.price(o.totalPrice);
  summaryError.hidden = true;
  show('summary');
  startTimer();
}

// ---------- Taymer ----------

function secondsLeft() {
  if (!order) return 0;
  return Math.max(
    0,
    Math.ceil((Date.parse(order.expiresAt) - serverNow()) / 1000),
  );
}

function startTimer() {
  stopTimer();
  let warned = false;
  stopTimer = every(() => {
    const left = secondsLeft();
    $('timer-value').textContent = fmt.countdown(left);
    $('timer').classList.toggle('warn', left < WARN_SECONDS);
    if (left < WARN_SECONDS && left > 0 && !warned) {
      warned = true;
      $('timer-alert').textContent =
        'Band qilish muddati tugashiga 1 daqiqadan kam vaqt qoldi';
    }
    if (left === 0) {
      show('expired');
      return true;
    }
    return false;
  });
}

// ---------- To'lov ----------

$('pay-open').addEventListener('click', () => {
  payError.hidden = true;
  closeModal = openModal($('pay-modal'));
});
$('pay-close').addEventListener('click', () => closeModal?.());
clearErrorsOnInput(payForm);

payForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!order) return;
  payError.hidden = true;
  const ok = validateFields([
    [cardNumber, v.cardNumber],
    [cardExp, (value) => v.cardExpiry(value)],
    [cardCvv, v.cvv],
  ]);
  if (!ok) return;

  // Mock to'lov: natijani backend `success` maydonidan oladi
  const success = !cardNumber.value.replace(/\s/g, '').endsWith('0000');
  const current = order;
  void withBusy(
    /** @type {HTMLButtonElement} */ ($('pay-submit')),
    async () => {
      try {
        const result = await api.payments.pay(current.id, success);
        payForm.reset();
        show(result.paymentStatus === 'SUCCESS' ? 'success' : 'failed');
      } catch (error) {
        // 409 — allaqachon to'langan: holatni qayta o'qiymiz
        if (error instanceof ApiError && error.status === 409)
          return void load();
        handleError(error, payError);
      }
    },
    "To'lanmoqda…",
  );
});

// Muvaffaqiyatsiz to'lovdan keyin buyurtma PENDING qoladi — muddat ichida qayta urinish mumkin
$('retry').addEventListener('click', () => void load());
$('error-retry').addEventListener('click', () => void load());

// ---------- Bekor qilish ----------

$('order-cancel').addEventListener('click', (event) => {
  if (!order) return;
  if (
    !confirm("Buyurtmani bekor qilasizmi? Band qilingan joylar bo'shatiladi.")
  )
    return;
  const current = order;
  void withBusy(
    /** @type {HTMLButtonElement} */ (event.currentTarget),
    async () => {
      try {
        await api.orders.cancel(current.id);
        show('cancelled');
      } catch (error) {
        handleError(error, summaryError);
      }
    },
  );
});

// ---------- Karta maydonlari formati ----------

cardNumber.addEventListener('input', () => {
  const digits = cardNumber.value.replace(/\D/g, '').slice(0, 16);
  cardNumber.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
});
cardExp.addEventListener('input', () => {
  const digits = cardExp.value.replace(/\D/g, '').slice(0, 4);
  cardExp.value =
    digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
});
cardCvv.addEventListener('input', () => {
  cardCvv.value = cardCvv.value.replace(/\D/g, '').slice(0, 3);
});

void load();
