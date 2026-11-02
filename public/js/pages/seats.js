// @ts-check
// O'rindiq tanlash (SEATED seans): 3D zal (Three.js) yoki 2D sxema.
// Ma'lumot: GET /events/:id (sarlavha, afisha), GET /sessions/:id/seats (holatlar).
// Buyurtma: POST /orders { sessionId, seatIds } — joylar Redis'da band qilinadi.

import { api, ApiError } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { mountBackBar } from '../shell.js';
import { icon } from '../icons.js';
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
/** @typedef {import('../hall3d.js').Hall3D} Hall3D */
/** @typedef {{ seatId: string, sector: string, sectorIndex: number, row: number, num: number, price: number }} Selected */

const VIEW_KEY = 'chipta:seatview';
const PALETTE = {
  dark: ['#f5b84a', '#ff6b5a', '#8b73ff', '#2ec5ff', '#3ddc97', '#ff4d93'],
  light: ['#e59a1c', '#ff5640', '#6c4dff', '#0ea5e9', '#10a36a', '#ff2e7e'],
};

const sessionId = param('session') ?? '';
const eventId = param('event') ?? '';
const content = $('content');
const sub = $('sub');
const titleEl = $('title');
const viewSeg = $('viewseg');
const back = mountBackBar(
  $('topnav'),
  eventId ? routes.event(eventId) : routes.home(),
  'Tadbirga qaytish',
  'wrap-lg',
);
for (const el of document.querySelectorAll('[data-icon]')) {
  el.append(icon(/** @type {HTMLElement} */ (el).dataset.icon ?? '', 16));
}

/** @type {Map<string, Selected>} */
const selected = new Map();
/** @type {Map<string, { button: HTMLButtonElement, status: SeatStatus, info: Selected }>} */
const seats = new Map();

/** @type {Hall3D | null} */
let hall3d = null;
/** @type {'3d' | '2d'} */
let view = '3d';
let posterUrl = '';
let eventTitle = '';

let panelList = h('div');
let totalEl = h('span');
let countEl = h('span');
let warnEl = h('div');
let orderButton = h('button');
let errorEl = h('p');
let stage3d = h('div');
let plan2d = h('div');
let seatBar = h('div');

void load();

async function load() {
  if (!sessionId || !eventId) {
    showEmpty(content, "Seans ko'rsatilmagan", {
      label: 'Bosh sahifaga',
      href: routes.home(),
    });
    return;
  }
  showLoading(content, 'Zal yuklanmoqda…');
  try {
    const [{ event, session }, map] = await Promise.all([
      loadSessionContext(eventId, sessionId),
      api.sessions.seats(sessionId),
    ]);
    back.textContent = sessionTitle(event, session);
    posterUrl = event.posterUrl;
    eventTitle = event.title;
    titleEl.textContent = event.title;
    sub.textContent = `${fmt.weekday(session.startTime)}, ${fmt.dateTime(session.startTime)} · ${session.venue.name} · maksimal ${MAX_TICKETS} ta chipta`;
    document.title = `Joy tanlash · ${event.title} — Chipta`;
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

const themeName = () =>
  document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';
/** @param {number} i */
const sectorColor = (i) => PALETTE[themeName()][i % 6];

// ---------- Sahifa ----------

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

  stage3d = h(
    'div',
    { class: 'stage3d', 'data-mode': 'hall' },
    h('div', { class: 'hall3d' }),
    h(
      'div',
      { class: 'hint3d' },
      icon('rotate', 15),
      h('span', { text: "Aylantiring, yaqinlashtiring va o'rindiqni bosing" }),
    ),
    h(
      'div',
      { class: 'tools3d' },
      toolButton('rotate', "Umumiy ko'rinish", () => hall3d?.overview()),
      toolButton('grid', 'Yuqoridan', () => hall3d?.topView()),
      toolButton('expand', "To'liq ekran", toggleFullscreen),
    ),
    legend(map),
    (seatBar = h('div', { class: 'seatbar', hidden: true })),
  );
  plan2d = planView(map);

  panelList = h('div', { class: 'plist' });
  totalEl = h('span');
  countEl = h('span', { class: 'pcount' });
  warnEl = h('div', {
    class: 'warnbox',
    role: 'status',
    hidden: true,
    text: `Bitta buyurtmaga maksimal ${MAX_TICKETS} ta chipta olish mumkin`,
  });
  errorEl = h('p', { class: 'field-error', role: 'alert', hidden: true });
  orderButton = h(
    'button',
    {
      class: 'btn btn-grad btn-lg btn-block',
      type: 'button',
      on: { click: submit },
    },
    'Buyurtma berish',
    icon('arrow-right', 18),
  );
  const panel = h(
    'aside',
    { class: 'panel', 'aria-label': 'Tanlangan joylar' },
    h(
      'div',
      { class: 'phead' },
      h('h2', { text: 'Tanlangan joylar' }),
      countEl,
    ),
    warnEl,
    h('div', { class: 'plive', 'aria-live': 'polite' }, panelList),
    h('div', { class: 'total' }, h('span', { text: 'Jami' }), totalEl),
    errorEl,
    orderButton,
    h(
      'p',
      { class: 'pnote' },
      icon('shield', 14),
      "Joylar to'lov uchun 15 daqiqa siz uchun saqlanadi",
    ),
  );

  content.replaceChildren(
    h(
      'div',
      { class: 'layout' },
      h('div', { class: 'stagecol' }, stage3d, plan2d),
      panel,
    ),
  );
  renderPanel();
  setupViewToggle();
}

/** @param {string} ic @param {string} label @param {() => void} onClick */
function toolButton(ic, label, onClick) {
  return h(
    'button',
    {
      class: 'tool',
      type: 'button',
      'aria-label': label,
      title: label,
      on: { click: onClick },
    },
    icon(ic, 17),
  );
}

/** @param {SeatMap} map */
function legend(map) {
  const items = map.sectors.map((s, i) =>
    h(
      'span',
      { class: 'lg' },
      h('i', { style: `--c:${sectorColor(i)}`, 'data-sector': String(i) }),
      h('b', { text: s.sectorName }),
      h('small', { text: fmt.price(s.price) }),
    ),
  );
  return h(
    'div',
    { class: 'legend3d' },
    h('div', { class: 'lgrow' }, items),
    h(
      'div',
      { class: 'lgrow muted' },
      h('span', { class: 'lg' }, h('i', { class: 'st-sel' }), 'Tanlangan'),
      h('span', { class: 'lg' }, h('i', { class: 'st-held' }), 'Band'),
      h('span', { class: 'lg' }, h('i', { class: 'st-sold' }), 'Sotilgan'),
    ),
  );
}

// ---------- Ko'rinish almashtirish ----------

function setupViewToggle() {
  let saved = null;
  try {
    saved = localStorage.getItem(VIEW_KEY);
  } catch {
    saved = null;
  }
  const webgl = supportsWebGL();
  viewSeg.hidden = !webgl;
  for (const btn of viewSeg.querySelectorAll('button')) {
    btn.addEventListener('click', () =>
      setView(/** @type {'3d' | '2d'} */ (btn.dataset.view)),
    );
  }
  setView(webgl && saved !== '2d' ? '3d' : '2d', false);
}

/** @param {'3d' | '2d'} next @param {boolean} [remember] */
function setView(next, remember = true) {
  view = next;
  for (const btn of viewSeg.querySelectorAll('button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.view === next));
  }
  stage3d.hidden = next !== '3d';
  plan2d.hidden = next !== '2d';
  if (remember) {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // e'tiborsiz
    }
  }
  if (next === '3d') void ensure3d();
  renderPanel();
}

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** @type {Promise<void> | null} */
let loading3d = null;
/** @type {SeatMap | null} */
let lastMap = null;

async function ensure3d() {
  if (hall3d || loading3d) return loading3d ?? undefined;
  const box = /** @type {HTMLElement} */ (stage3d.querySelector('.hall3d'));
  const spinner = h(
    'div',
    { class: 'load3d' },
    h('div', { class: 'spinner' }),
    h('span', { text: '3D zal tayyorlanmoqda…' }),
  );
  box.append(spinner);
  loading3d = (async () => {
    try {
      const [{ createHall3D }, map] = await Promise.all([
        import('../hall3d.js'),
        lastMap ? Promise.resolve(lastMap) : api.sessions.seats(sessionId),
      ]);
      hall3d = createHall3D({
        container: box,
        map: withCurrentStatuses(map),
        posterUrl,
        title: eventTitle,
        onToggle: toggle,
        onModeChange: (mode, seat) => {
          stage3d.dataset.mode = mode;
          renderSeatBar(mode === 'seat' ? (seat?.id ?? null) : null);
        },
      });
      if (!hall3d) throw new Error('WebGL');
      hall3d.setSelected(new Set(selected.keys()));
    } catch (error) {
      console.error('3D zal ishga tushmadi:', error);
      toast("3D ko'rinish bu qurilmada ishlamadi — sxema ko'rsatildi");
      viewSeg.hidden = true;
      setView('2d', false);
    } finally {
      spinner.remove();
      loading3d = null;
    }
  })();
  return loading3d;
}

/** 3D ochilganda 2D dagi eng so'nggi holatlar ishlatiladi @param {SeatMap} map */
function withCurrentStatuses(map) {
  return {
    ...map,
    sectors: map.sectors.map((s) => ({
      ...s,
      rows: s.rows.map((r) => ({
        ...r,
        seats: r.seats.map((seat) => ({
          ...seat,
          status: seats.get(seat.seatId)?.status ?? seat.status,
        })),
      })),
    })),
  };
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void stage3d.requestFullscreen?.().catch(() => {});
}

/** @param {string} seatId */
function viewFrom(seatId) {
  if (view !== '3d') {
    setView('3d');
  }
  void ensure3d().then(() => {
    stage3d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    hall3d?.viewFromSeat(seatId);
  });
}

/** @param {string | null} seatId */
function renderSeatBar(seatId) {
  seatBar.hidden = !seatId;
  if (!seatId) return;
  const seat = seats.get(seatId);
  if (!seat) return;
  const isSel = selected.has(seatId);
  const free = seat.status === 'FREE';
  seatBar.replaceChildren(
    h(
      'div',
      { class: 'sb-info' },
      icon('eye', 18),
      h(
        'div',
        null,
        h('b', { text: `${seat.info.row}-qator, ${seat.info.num}-o'rin` }),
        h('span', {
          text: `${seat.info.sector} · ${fmt.price(seat.info.price)} · sahna shunday ko'rinadi`,
        }),
      ),
    ),
    h(
      'div',
      { class: 'sb-actions' },
      h(
        'button',
        {
          class: 'btn btn-secondary btn-sm',
          type: 'button',
          on: { click: () => hall3d?.overview() },
        },
        icon('arrow-left', 15),
        'Zalga qaytish',
      ),
      free || isSel
        ? h('button', {
            class: `btn btn-sm ${isSel ? 'btn-secondary' : 'btn-primary'}`,
            type: 'button',
            text: isSel ? 'Tanlovdan olish' : 'Shu joyni tanlash',
            on: {
              click: () => {
                toggle(seatId);
                renderSeatBar(seatId);
              },
            },
          })
        : null,
    ),
  );
}

// ---------- 2D sxema ----------

/** @param {SeatMap} map */
function planView(map) {
  lastMap = map;
  return h(
    'div',
    { class: 'hallcard' },
    h('div', { class: 'stage', text: 'Sahna' }),
    h(
      'div',
      { class: 'planscroll' },
      map.sectors.map((sector, si) =>
        h(
          'section',
          {
            class: 'sector',
            'aria-label': `${sector.sectorName} sektori`,
            style: `--c:${sectorColor(si)}`,
          },
          h(
            'h3',
            null,
            h('i', { 'aria-hidden': 'true' }),
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
                    sectorIndex: si,
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
              h('div', {
                class: 'rowlabel',
                text: row.number,
                'aria-hidden': 'true',
              }),
            ),
          ),
        ),
      ),
    ),
  );
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
  seat.button.textContent = isSelected ? String(seat.info.num) : '';
  seat.button.title = `${seat.info.row}-qator, ${seat.info.num}-o'rin`;
  seat.button.setAttribute(
    'aria-label',
    `${seat.info.sector}, ${seat.info.row}-qator, ${seat.info.num}-o'rin, ${fmt.price(seat.info.price)}, ${statusLabel}`,
  );
  seat.button.setAttribute('aria-pressed', String(isSelected));
  if (seat.status !== 'FREE') seat.button.setAttribute('aria-disabled', 'true');
  else seat.button.removeAttribute('aria-disabled');
}

// ---------- Tanlov ----------

/** @param {string} seatId */
function toggle(seatId) {
  const seat = seats.get(seatId);
  if (!seat) return;
  errorEl.hidden = true;
  if (seat.status !== 'FREE' && !selected.has(seatId)) {
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
    toast(`Maksimal ${MAX_TICKETS} ta joy tanlash mumkin`);
    return;
  } else {
    selected.set(seatId, seat.info);
  }
  paintSeat(seatId);
  hall3d?.setSelected(new Set(selected.keys()));
  renderPanel();
}

function renderPanel() {
  const list = [...selected.values()];
  countEl.textContent = `${list.length} / ${MAX_TICKETS}`;
  panelList.replaceChildren(
    ...(list.length
      ? list.map((s) =>
          h(
            'div',
            { class: 'pline' },
            h('i', {
              class: 'pdot',
              style: `--c:${sectorColor(s.sectorIndex)}`,
              'aria-hidden': 'true',
            }),
            h(
              'div',
              { class: 'pinfo' },
              h('b', { text: `${s.row}-qator, ${s.num}-o'rin` }),
              h('small', { text: `${s.sector} · ${fmt.price(s.price)}` }),
            ),
            supportsView()
              ? h(
                  'button',
                  {
                    class: 'picon',
                    type: 'button',
                    title: "Shu joydan ko'rinish",
                    'aria-label': `${s.row}-qator ${s.num}-o'rindan sahna ko'rinishi`,
                    on: { click: () => viewFrom(s.seatId) },
                  },
                  icon('eye', 17),
                )
              : null,
            h(
              'button',
              {
                class: 'picon',
                type: 'button',
                title: 'Olib tashlash',
                'aria-label': `${s.row}-qator ${s.num}-o'rinni olib tashlash`,
                on: { click: () => toggle(s.seatId) },
              },
              icon('close', 16),
            ),
          ),
        )
      : [
          h(
            'div',
            { class: 'empty-sel' },
            h('span', { class: 'empty-ic' }, icon('ticket', 22)),
            h('p', {
              text:
                view === '3d'
                  ? "Zaldagi bo'sh o'rindiqni bosing. Tanlagach, «ko'z» tugmasi bilan joyingizdan sahna qanday ko'rinishini ko'ring."
                  : "Sxemadagi bo'sh o'rindiqni bosing.",
            }),
          ),
        ]),
  );
  totalEl.textContent = fmt.price(list.reduce((sum, s) => sum + s.price, 0));
  orderButton.disabled = list.length === 0;
}

const supportsView = () => !viewSeg.hidden;

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
  ).then(renderPanel);
}

/** 409 dan keyin holatlar yangilanadi; endi bo'sh bo'lmagan joylar tanlovdan chiqariladi */
async function refreshStatuses() {
  try {
    const map = await api.sessions.seats(sessionId);
    lastMap = map;
    /** @type {Map<string, SeatStatus>} */
    const statuses = new Map();
    for (const sector of map.sectors) {
      for (const row of sector.rows) {
        for (const s of row.seats) {
          statuses.set(s.seatId, s.status);
          const seat = seats.get(s.seatId);
          if (!seat) continue;
          seat.status = s.status;
          if (s.status !== 'FREE') selected.delete(s.seatId);
          paintSeat(s.seatId);
        }
      }
    }
    hall3d?.setStatuses(statuses);
    hall3d?.setSelected(new Set(selected.keys()));
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

// Mavzu almashganda 2D rang belgilari ham yangilanadi
new MutationObserver(() => {
  for (const el of document.querySelectorAll('[data-sector]')) {
    /** @type {HTMLElement} */ (el).style.setProperty(
      '--c',
      sectorColor(Number(/** @type {HTMLElement} */ (el).dataset.sector)),
    );
  }
  for (const [i, el] of [...document.querySelectorAll('.sector')].entries()) {
    /** @type {HTMLElement} */ (el).style.setProperty('--c', sectorColor(i));
  }
  renderPanel();
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
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
  hall3d?.setSelected(new Set(selected.keys()));
  renderPanel();
}
