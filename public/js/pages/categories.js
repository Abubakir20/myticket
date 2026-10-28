// @ts-check
// Toifa tanlash (GENERAL seans). Ma'lumot: GET /sessions/:id/categories (qolgan soni bilan).
// Buyurtma: POST /orders { sessionId, items: [{ ticketCategoryId, quantity }] }.

import { api, ApiError } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { mountBackBar } from '../shell.js';
import {
  MAX_TICKETS,
  loadSessionContext,
  sessionTitle,
  placeOrder,
  readDraft,
} from '../booking.js';
import {
  $,
  h,
  showLoading,
  showError,
  showEmpty,
  withBusy,
  errorMessage,
} from '../ui.js';

/** @typedef {import('../types.js').GeneralCategory} GeneralCategory */

const sessionId = param('session') ?? '';
const eventId = param('event') ?? '';
const content = $('content');
const sub = $('sub');
const back = mountBackBar(
  $('topnav'),
  eventId ? routes.event(eventId) : routes.home(),
  'Tadbirga qaytish',
  'wrap-sm',
);

/** @type {GeneralCategory[]} */
let categories = [];
/** @type {Map<string, number>} */
const qty = new Map();

const warnEl = h('div', {
  class: 'warnbox',
  role: 'status',
  hidden: true,
  text: `Bitta buyurtmaga maksimal ${MAX_TICKETS} ta chipta olish mumkin`,
});
const listEl = h('div');
const totalEl = h('span');
const errorEl = h('p', { class: 'field-error', role: 'alert', hidden: true });
const orderButton = h('button', {
  class: 'btn btn-primary btn-block',
  type: 'button',
  text: 'Buyurtma berish',
  on: { click: submit },
});

void load();

async function load() {
  if (!sessionId || !eventId) {
    showEmpty(content, "Seans ko'rsatilmagan", {
      label: 'Bosh sahifaga',
      href: routes.home(),
    });
    return;
  }
  showLoading(content);
  try {
    const { event, session } = await loadSessionContext(eventId, sessionId);
    if (session.seatingType === 'SEATED') {
      location.replace(routes.seats(sessionId, eventId));
      return;
    }
    back.textContent = `← ${sessionTitle(event, session)}`;
    sub.textContent = `${session.venue.name} · Umumiy o'tirish · Maksimal ${MAX_TICKETS} ta chipta`;
    document.title = `Toifani tanlang · ${event.title} — Chipta`;
    if (Date.parse(session.startTime) <= Date.now()) {
      showEmpty(content, 'Bu seans allaqachon boshlangan', {
        label: 'Tadbirga qaytish',
        href: routes.event(eventId),
      });
      return;
    }
    categories = availableFirst(await api.sessions.categories(sessionId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      showEmpty(content, error.message, {
        label: 'Tadbirga qaytish',
        href: routes.event(eventId),
      });
      return;
    }
    showError(content, error, load);
    return;
  }
  if (!categories.length) {
    showEmpty(content, "Bu seansda sotuvdagi chiptalar yo'q", {
      label: 'Tadbirga qaytish',
      href: routes.event(eventId),
    });
    return;
  }
  restoreDraft();
  content.replaceChildren(
    warnEl,
    listEl,
    h(
      'div',
      { class: 'catpanel' },
      h('div', { class: 'total' }, h('span', { text: 'Jami' }), totalEl),
      errorEl,
      orderButton,
    ),
  );
  render();
}

/** Tugagan toifalar oxirida (dizayndagidek), qolganlari backend tartibida @param {GeneralCategory[]} list */
function availableFirst(list) {
  return [...list].sort(
    (a, b) => Number(a.remaining <= 0) - Number(b.remaining <= 0),
  );
}

const totalQty = () => [...qty.values()].reduce((a, n) => a + n, 0);

function render() {
  const total = totalQty();
  listEl.replaceChildren(
    ...categories.map((c) => {
      const soldOut = c.remaining <= 0;
      const n = qty.get(c.id) ?? 0;
      return h(
        'div',
        { class: soldOut ? 'catrow out' : 'catrow' },
        h(
          'div',
          { class: 'cname' },
          h('div', { class: 't', text: c.name }),
          h('div', {
            class: 'left',
            text: soldOut ? 'Chiptalar tugadi' : `${c.remaining} ta qoldi`,
          }),
        ),
        h('div', { class: 'cprice', text: fmt.price(c.price) }),
        soldOut
          ? h('span', { class: 'soldout', text: 'Tugadi' })
          : h(
              'div',
              {
                class: 'stepper',
                role: 'group',
                'aria-label': `${c.name} soni`,
              },
              h('button', {
                class: 'stepbtn',
                type: 'button',
                text: '–',
                'aria-label': `${c.name}: kamaytirish`,
                disabled: n === 0,
                on: { click: () => change(c, -1) },
              }),
              h('span', { class: 'qty', text: n, 'aria-live': 'polite' }),
              h('button', {
                class: 'stepbtn',
                type: 'button',
                text: '+',
                'aria-label': `${c.name}: ko'paytirish`,
                disabled: n >= c.remaining,
                'aria-disabled': total >= MAX_TICKETS ? 'true' : null,
                on: { click: () => change(c, 1) },
              }),
            ),
      );
    }),
  );
  totalEl.textContent = fmt.price(
    categories.reduce(
      (sum, c) => sum + (qty.get(c.id) ?? 0) * Number(c.price),
      0,
    ),
  );
  orderButton.disabled = total === 0;
}

/** @param {GeneralCategory} category @param {number} delta */
function change(category, delta) {
  errorEl.hidden = true;
  if (delta > 0 && totalQty() >= MAX_TICKETS) {
    warnEl.hidden = false;
    return;
  }
  warnEl.hidden = true;
  const next = Math.min(
    Math.max(0, (qty.get(category.id) ?? 0) + delta),
    category.remaining,
  );
  if (next) qty.set(category.id, next);
  else qty.delete(category.id);
  render();
}

function submit() {
  const items = [...qty.entries()].map(([ticketCategoryId, quantity]) => ({
    ticketCategoryId,
    quantity,
  }));
  if (!items.length) return;
  void withBusy(
    orderButton,
    async () => {
      try {
        await placeOrder({ sessionId, items }, items);
      } catch (error) {
        errorEl.textContent = errorMessage(error);
        errorEl.hidden = false;
        if (error instanceof ApiError && error.status === 409) {
          // Qolgan sonlar o'zgargan — yangilab, tanlovni cheklaymiz
          categories = availableFirst(
            await api.sessions.categories(sessionId).catch(() => categories),
          );
          for (const c of categories) {
            const n = qty.get(c.id) ?? 0;
            if (n > c.remaining) {
              if (c.remaining > 0) qty.set(c.id, c.remaining);
              else qty.delete(c.id);
            }
          }
          render();
        }
      }
    },
    'Band qilinmoqda…',
    // withBusy tugmani qayta yoqadi — tanlov bo'shab qolgan bo'lsa holatini qayta hisoblaymiz
  ).then(render);
}

function restoreDraft() {
  const draft =
    /** @type {{ ticketCategoryId: string, quantity: number }[] | null} */ (
      readDraft(sessionId)
    );
  if (!Array.isArray(draft)) return;
  let total = 0;
  for (const item of draft) {
    const category = categories.find((c) => c.id === item.ticketCategoryId);
    if (!category) continue;
    const n = Math.min(item.quantity, category.remaining, MAX_TICKETS - total);
    if (n > 0) {
      qty.set(category.id, n);
      total += n;
    }
  }
}
