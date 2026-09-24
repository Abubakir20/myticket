// @ts-check
// Mening buyurtmalarim. GET /orders/me (backend so'rov paytida muddati o'tganlarini EXPIRED qiladi),
// PATCH /orders/:id/cancel. Kutilayotgan buyurtmalar uchun jonli taymer.

import { api, ApiError, serverNow } from '../api.js';
import * as fmt from '../format.js';
import { routes } from '../routes.js';
import { requireUser } from '../session.js';
import { mountNav } from '../shell.js';
import {
  $,
  h,
  showLoading,
  showError,
  showEmpty,
  toast,
  withBusy,
  errorMessage,
  every,
} from '../ui.js';

/** @typedef {import('../types.js').OrderListItem} OrderListItem */
/** @typedef {import('../types.js').OrderStatus} OrderStatus */

const content = $('content');
void mountNav($('topnav'), 'orders');

/** @type {Record<OrderStatus, [string, string]>} */
const BADGES = {
  PENDING: ['KUTILMOQDA', 'b-pending'],
  PAID: ["TO'LANGAN", 'b-ok'],
  EXPIRED: ['MUDDATI TUGAGAN', 'b-err'],
  CANCELLED: ['BEKOR QILINGAN', 'b-neutral'],
};

/** Kutilayotgan buyurtmalar taymerlari: badge elementi va muddati */
/** @type {{ badge: HTMLElement, actions: HTMLElement, expiresAt: number }[]} */
let pending = [];

void load();

async function load() {
  await requireUser(['CUSTOMER']);
  showLoading(content);
  let orders;
  try {
    orders = await api.orders.mine();
  } catch (error) {
    showError(content, error, load);
    return;
  }
  if (!orders.length) {
    showEmpty(content, "Sizda hali buyurtmalar yo'q", {
      label: "Tadbirlarni ko'rish",
      href: routes.home(),
    });
    return;
  }
  pending = [];
  content.replaceChildren(...orders.map(orderCard));
}

/** @param {OrderListItem} order */
function orderCard(order) {
  const [label, cls] = BADGES[order.status];
  const badge = h('span', { class: `badge ${cls}`, text: label });
  const actions = h('div', { class: 'oactions' });

  if (order.status === 'PENDING') {
    actions.append(
      h('a', {
        class: 'btn btn-primary',
        href: routes.checkout(order.id),
        text: "To'lash",
      }),
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Bekor qilish',
        on: {
          click: (/** @type {MouseEvent} */ e) =>
            cancel(
              order,
              /** @type {HTMLButtonElement} */ (e.currentTarget),
              card,
            ),
        },
      }),
    );
    pending.push({ badge, actions, expiresAt: Date.parse(order.expiresAt) });
  }

  const card = h(
    'article',
    { class: 'ocard', 'aria-label': `Buyurtma ${fmt.orderNo(order.id)}` },
    h(
      'div',
      { class: 'oinfo' },
      h(
        'div',
        { class: 't' },
        `${fmt.orderNo(order.id)} · `,
        h('a', {
          href: routes.event(order.session.event.id),
          text: order.session.event.title,
        }),
      ),
      h('div', {
        class: 'v',
        text: `${fmt.relativeDateTime(order.createdAt)} · ${order.ticketsCount} ta chipta`,
      }),
    ),
    badge,
    h('div', { class: 'oprice', text: fmt.price(order.totalPrice) }),
    actions.childElementCount ? actions : null,
  );
  return card;
}

/**
 * @param {OrderListItem} order
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} card
 */
function cancel(order, button, card) {
  if (
    !confirm("Buyurtmani bekor qilasizmi? Band qilingan joylar bo'shatiladi.")
  )
    return;
  void withBusy(button, async () => {
    try {
      await api.orders.cancel(order.id);
      card.replaceWith(orderCard({ ...order, status: 'CANCELLED' }));
      toast('Buyurtma bekor qilindi');
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        card.replaceWith(orderCard({ ...order, status: 'EXPIRED' }));
        toast('Buyurtma muddati allaqachon tugagan');
        return;
      }
      toast(errorMessage(error));
    }
  });
}

// Bitta umumiy taymer barcha kutilayotgan buyurtmalar uchun
every(() => {
  const now = serverNow();
  for (const item of pending) {
    if (!item.badge.isConnected) continue;
    const left = Math.ceil((item.expiresAt - now) / 1000);
    if (left > 0) {
      item.badge.textContent = `KUTILMOQDA · ${fmt.countdown(left)}`;
    } else {
      item.badge.textContent = BADGES.EXPIRED[0];
      item.badge.className = `badge ${BADGES.EXPIRED[1]}`;
      item.actions.remove();
    }
  }
});
