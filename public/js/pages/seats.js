// @ts-check
// O'rindiq tanlash (SEATED seans). Ma'lumot: GET /events/:id (sarlavha), GET /sessions/:id/seats (holatlar).
// Buyurtma: POST /orders { sessionId, seatIds } — joylar Redis'da band qilinadi.

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
  toast,
  withBusy,
  errorMessage,
} from '../ui.js';

/** @typedef {import('../types.js').SeatMap} SeatMap */
/** @typedef {import('../types.js').SeatStatus} SeatStatus */
/** @typedef {{ seatId: string, sector: string, row: number, num: number, price: number }} Selected */

const sessionId = param('session') ?? '';
const eventId = param('event') ?? '';
const content = $('content');
const sub = $('sub');
const back = mountBackBar(
  $('topnav'),
  eventId ? routes.event(eventId) : routes.home(),
  'Tadbirga qaytish',
  'wrap-lg',
);

/** @type {Map<string, Selected>} */
const selected = new Map();
/** @type {Map<string, { button: HTMLButtonElement, status: SeatStatus, info: Selected }>} */
const seats = new Map();

let panelList = h('div');
let totalEl = h('span');
let warnEl = h('div');
let orderButton = h('button');
let errorEl = h('p');

void load();

async function load() {
  if (!sessionId || !eventId) {
    showEmpty(content, "Seans ko'rsatilmagan", {
      label: 'Bosh sahifaga',
      href: routes.home(),
    });
    return;
  }
  showLoading(content, 'Zal sxemasi yuklanmoqda…');
  try {
    const [{ event, session }, map] = await Promise.all([
      loadSessionContext(eventId, sessionId),
      api.sessions.seats(sessionId),
    ]);
    back.textContent = `← ${sessionTitle(event, session)}`;
    sub.textContent = `${session.venue.name} · Maksimal ${MAX_TICKETS} ta chipta bitta buyurtmaga`;
    document.title = `O'rindiqni tanlang · ${event.title} — Chipta`;
    if (Date.parse(session.startTime) <= Date.now()) {
      showEmpty(content, 'Bu seans allaqachon boshlangan', {
        label: 'Tadbirga qaytish',
        href: routes.event(eventId),
      });
      return;
    }
    render(map);
    restoreDraft();
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      showEmpty(content, error.message, {
        label: 'Tadbirga qaytish',
        href: routes.event(eventId),
      });
      return;
    }
    showError(content, error, load);
  }
}

// ---------- Zal ----------

/** @param {SeatMap} map */
function render(map) {
  seats.clear();
  if (!map.sectors.length) {
    showEmpty(content, "Bu seansda sotuvdagi o'rindiqlar yo'q", {
      label: 'Tadbirga qaytish',
      href: routes.event(eventId),
    });
    return;
  }

  const hall = h(
    'div',
    { class: 'hallcard' },
    h(
      'div',
      { class: 'legend', 'aria-hidden': 'true' },
      h('span', null, h('i', { class: 'free' }), "Bo'sh"),
      h('span', null, h('i', { class: 'held' }), 'Band qilingan'),
      h('span', null, h('i', { class: 'sold' }), 'Sotilgan'),
      h('span', null, h('i', { class: 'sel' }), 'Tanlangan'),
    ),
    h('div', { class: 'stage', text: 'Sahna' }),
    map.sectors.map((sector) =>
      h(
        'section',
        { class: 'sector', 'aria-label': `${sector.sectorName} sektori` },
        h(
          'h5',
          null,
          sector.sectorName,
          h('span', { text: fmt.price(sector.price) }),
        ),
        sector.rows.map((row) =>
          h(
            'div',
            { class: 'row' },
            h('div', {
              class: 'rowlabel',
              text: row.number,
              'aria-hidden': 'true',
            }),
            h(
              'div',
              {
                class: 'seats',
                role: 'group',
                'aria-label': `${row.number}-qator`,
              },
              row.seats.map((seat) => {
                const info = {
                  seatId: seat.seatId,
                  sector: sector.sectorName,
                  row: row.number,
                  num: seat.number,
                  price: Number(sector.price),
                };
                const button = h('button', {
                  class: 'seat',
                  type: 'button',
                  on: { click: () => toggle(seat.seatId) },
                });
                seats.set(seat.seatId, { button, status: seat.status, info });
                paintSeat(seat.seatId);
                return button;
              }),
            ),
          ),
        ),
      ),
    ),
  );

  panelList = h('div');
  totalEl = h('span');
  warnEl = h('div', {
    class: 'warnbox',
    role: 'status',
    hidden: true,
    text: `Bitta buyurtmaga maksimal ${MAX_TICKETS} ta chipta olish mumkin`,
  });
  errorEl = h('p', { class: 'field-error', role: 'alert', hidden: true });
  orderButton = h('button', {
    class: 'btn btn-primary btn-block',
    type: 'button',
    text: 'Buyurtma berish',
    on: { click: submit },
  });
  const panel = h(
    'aside',
    { class: 'panel', 'aria-label': 'Tanlangan joylar' },
    h('h4', { text: 'Tanlangan joylar' }),
    warnEl,
    h('div', { 'aria-live': 'polite' }, panelList),
    h('div', { class: 'total' }, h('span', { text: 'Jami' }), totalEl),
    errorEl,
    orderButton,
  );

  content.replaceChildren(h('div', { class: 'layout' }, hall, panel));
  renderPanel();
}

/** @param {string} seatId */
function paintSeat(seatId) {
  const seat = seats.get(seatId);
  if (!seat) return;
  const isSelected = selected.has(seatId);
  const cls = isSelected
    ? 'sel'
    : seat.status === 'FREE'
      ? 'free'
      : seat.status === 'HELD'
        ? 'held'
        : 'sold';
  const statusLabel = isSelected
    ? 'tanlangan'
    : { FREE: "bo'sh", HELD: 'band qilingan', SOLD: 'sotilgan' }[seat.status];
  seat.button.className = `seat ${cls}`;
  seat.button.setAttribute(
    'aria-label',
    `${fmt.seatLabel(seat.info.sector, { number: seat.info.num, row: { number: seat.info.row, sector: { name: seat.info.sector } } })}, ${fmt.price(seat.info.price)}, ${statusLabel}`,
  );
  seat.button.setAttribute('aria-pressed', String(isSelected));
  if (seat.status !== 'FREE') seat.button.setAttribute('aria-disabled', 'true');
  else seat.button.removeAttribute('aria-disabled');
}

/** @param {string} seatId */
function toggle(seatId) {
  const seat = seats.get(seatId);
  if (!seat) return;
  errorEl.hidden = true;
  if (seat.status !== 'FREE') {
    toast(
      seat.status === 'HELD'
        ? 'Bu joy boshqa foydalanuvchi tomonidan band qilindi'
        : 'Bu joy allaqachon sotilgan',
    );
    return;
  }
  if (selected.has(seatId)) {
    selected.delete(seatId);
    warnEl.hidden = true;
  } else if (selected.size >= MAX_TICKETS) {
    warnEl.hidden = false;
    return;
  } else {
    selected.set(seatId, seat.info);
  }
  paintSeat(seatId);
  renderPanel();
}

function renderPanel() {
  const list = [...selected.values()];
  panelList.replaceChildren(
    ...(list.length
      ? list.map((s) =>
          h(
            'div',
            { class: 'pline' },
            h(
              'div',
              null,
              `${s.sector}, ${s.row}-qator, ${s.num}-o'rin`,
              h('small', { text: fmt.price(s.price) }),
            ),
            h(
              'div',
              null,
              fmt.price(s.price),
              ' ',
              h('button', {
                type: 'button',
                text: '✕',
                'aria-label': `${s.row}-qator ${s.num}-o'rinni olib tashlash`,
                on: { click: () => toggle(s.seatId) },
              }),
            ),
          ),
        )
      : [h('p', { class: 'empty-sel', text: 'Hali joy tanlanmadi' })]),
  );
  totalEl.textContent = fmt.price(list.reduce((sum, s) => sum + s.price, 0));
  orderButton.disabled = list.length === 0;
}

// ---------- Buyurtma ----------

function submit() {
  if (!selected.size) return;
  const seatIds = [...selected.keys()];
  void withBusy(
    orderButton,
    async () => {
      try {
        await placeOrder({ sessionId, seatIds }, seatIds);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          toast(error.message);
          await refreshStatuses();
          return;
        }
        errorEl.textContent = errorMessage(error);
        errorEl.hidden = false;
      }
    },
    'Band qilinmoqda…',
    // withBusy tugmani qayta yoqadi — tanlov bo'shab qolgan bo'lsa holatini qayta hisoblaymiz
  ).then(renderPanel);
}

/** 409 dan keyin holatlar yangilanadi; endi bo'sh bo'lmagan joylar tanlovdan chiqariladi */
async function refreshStatuses() {
  try {
    const map = await api.sessions.seats(sessionId);
    for (const sector of map.sectors) {
      for (const row of sector.rows) {
        for (const s of row.seats) {
          const seat = seats.get(s.seatId);
          if (!seat) continue;
          seat.status = s.status;
          if (s.status !== 'FREE') selected.delete(s.seatId);
          paintSeat(s.seatId);
        }
      }
    }
    renderPanel();
  } catch {
    // Keyingi urinishda qayta tekshiriladi
  }
}

// Boshqa oynadan qaytganda holatlar eskirgan bo'lishi mumkin
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && seats.size)
    void refreshStatuses();
});

/** Login'dan qaytganda avvalgi tanlov tiklanadi */
function restoreDraft() {
  const draft = /** @type {string[] | null} */ (readDraft(sessionId));
  if (!Array.isArray(draft)) return;
  for (const seatId of draft.slice(0, MAX_TICKETS)) {
    const seat = seats.get(seatId);
    if (seat && seat.status === 'FREE') {
      selected.set(seatId, seat.info);
      paintSeat(seatId);
    }
  }
  renderPanel();
}
