// @ts-check
// Admin panel: statistika, tadbirlarni moderatsiya qilish va tashkilotchi arizalari.
// GET /admin/stats, GET /admin/events, GET /admin/organizerapplications, PATCH .../approve|reject|cancel

import { api } from '../api.js';
import * as fmt from '../format.js';
import { routes } from '../routes.js';
import { requireUser } from '../session.js';
import { mountNav, mountFooter } from '../shell.js';
import {
  $,
  h,
  showLoading,
  showError,
  showEmpty,
  toast,
  errorMessage,
  setBanner,
  setFieldError,
  withBusy,
  openModal,
  fallbackClass,
  posterImage,
} from '../ui.js';

/** @typedef {import('../types.js').AdminStats} AdminStats */
/** @typedef {import('../types.js').AdminEvent} AdminEvent */
/** @typedef {import('../types.js').AdminApplication} AdminApplication */

const EVENT_STATUS = {
  PENDING: { label: 'Kutilmoqda', badge: 'b-pending' },
  APPROVED: { label: 'Tasdiqlangan', badge: 'b-ok' },
  REJECTED: { label: 'Rad etilgan', badge: 'b-err' },
  CANCELLED: { label: 'Bekor qilingan', badge: 'b-neutral' },
};
const APP_STATUS = {
  PENDING: { label: 'Kutilmoqda', badge: 'b-pending' },
  APPROVED: { label: 'Tasdiqlangan', badge: 'b-ok' },
  REJECTED: { label: 'Rad etilgan', badge: 'b-err' },
};

const statsEl = $('stats');
const eventList = $('event-list');
const appList = $('app-list');

const state = {
  eventStatus: 'PENDING',
  eventPage: 1,
  appStatus: 'PENDING',
  /** @type {AdminStats | null} */
  stats: null,
};

void mountNav($('topnav'), 'admin');
mountFooter($('footer'));
void init();

async function init() {
  const user = await requireUser(['ADMIN']);
  const name = user.fullName?.trim();
  if (name) $('admin-title').textContent = `Salom, ${name.split(' ')[0]}!`;
  setupTabs();
  renderStatsSkeleton();
  await loadStats();
  renderEventFilters();
  renderAppFilters();
  void loadEvents();
  void loadApps();
}

// ---------- Statistika ----------

/** 125940000 → "125,9 mln so'm" (kartochkaga sig'ishi uchun) @param {number} value */
function compactPrice(value) {
  const units = /** @type {[number, string][]} */ ([
    [1e9, 'mlrd'],
    [1e6, 'mln'],
  ]);
  for (const [size, label] of units) {
    if (value >= size) {
      const n = (value / size).toFixed(1).replace(/\.0$/, '').replace('.', ',');
      return `${n}\u00a0${label}\u00a0so'm`;
    }
  }
  return fmt.price(value);
}

/** @param {number} part @param {number} total */
function percent(part, total) {
  const p = (part / total) * 100;
  if (p > 0 && p < 1) return '<1%';
  return `${Math.round(p)}%`;
}

function renderStatsSkeleton() {
  statsEl.replaceChildren(
    ...Array.from({ length: 4 }, () =>
      h('div', { class: 'stat skeleton skeleton-tile', 'aria-hidden': 'true' }),
    ),
  );
}

/** @param {Record<string, number> | undefined} map @param {...string} keys */
const sum = (map, ...keys) =>
  keys.length
    ? keys.reduce((acc, key) => acc + (map?.[key] ?? 0), 0)
    : Object.values(map ?? {}).reduce((acc, n) => acc + n, 0);

async function loadStats() {
  try {
    state.stats = await api.admin.stats();
  } catch (error) {
    statsEl.replaceChildren(
      h(
        'div',
        { class: 'stat', role: 'alert' },
        h('div', { class: 's', text: errorMessage(error) }),
      ),
    );
    return;
  }
  renderStats(state.stats);
}

/** @param {AdminStats} s */
function renderStats(s) {
  const sold = sum(s.tickets, 'ACTIVE', 'USED');
  const used = sum(s.tickets, 'USED');
  const pendingEvents = sum(s.events, 'PENDING');
  const pendingApps = sum(s.applications, 'PENDING');

  /** @param {string} k @param {string} v @param {string} sub @param {string} [cls] @param {string} [title] */
  const tile = (k, v, sub, cls = '', title = v) =>
    h(
      'div',
      { class: `stat ${cls}` },
      h('div', { class: 'k', text: k }),
      h('div', { class: 'v', text: v, title }),
      h('div', { class: 's', text: sub }),
    );

  statsEl.replaceChildren(
    tile(
      'Umumiy tushum',
      compactPrice(s.revenue),
      `${sum(s.orders, 'PAID')} ta to'langan buyurtma`,
      'lead',
      fmt.price(s.revenue),
    ),
    tile(
      'Sotilgan chiptalar',
      String(sold),
      sold
        ? `${used} tasi skanerlangan (${percent(used, sold)})`
        : "Hali sotuv yo'q",
    ),
    tile(
      'Tadbirlar',
      String(sum(s.events, 'APPROVED')),
      pendingEvents
        ? `faol · ${pendingEvents} tasi tasdiq kutmoqda`
        : "faol · hammasi ko'rib chiqilgan",
    ),
    tile(
      'Foydalanuvchilar',
      String(sum(s.users)),
      `${sum(s.users, 'ORGANIZER')} tashkilotchi · ${sum(s.users, 'CONTROLLER')} kontroller`,
    ),
  );

  $('count-events').textContent = pendingEvents ? String(pendingEvents) : '';
  $('count-apps').textContent = pendingApps ? String(pendingApps) : '';

  const sub = $('admin-sub');
  const todo = [
    pendingEvents && `${pendingEvents} ta tadbir`,
    pendingApps && `${pendingApps} ta ariza`,
  ].filter(Boolean);
  sub.replaceChildren(
    todo.length
      ? h(
          'span',
          null,
          "Ko'rib chiqilishini kutayotganlar: ",
          h('strong', { text: todo.join(' va ') }),
          '.',
        )
      : "Hamma narsa ko'rib chiqilgan — yangi tadbir yoki ariza kelganda shu yerda ko'rinadi.",
  );
}

// ---------- Tablar ----------

function setupTabs() {
  const tabs = /** @type {HTMLButtonElement[]} */ ([
    $('tab-events'),
    $('tab-apps'),
  ]);
  /** @param {HTMLButtonElement} tab */
  const select = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(/** @type {string} */ (t.getAttribute('aria-controls'))).hidden = !on;
    }
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next =
        tabs[
          (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
        ];
      select(next);
      next.focus();
    });
  });
  if (location.hash === '#arizalar') select(tabs[1]);
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, { label: string }>} statuses
 * @param {Record<string, number> | undefined} counts
 * @param {string} current
 * @param {(status: string) => void} onPick
 */
function renderChips(mount, statuses, counts, current, onPick) {
  /** @type {[string, string][]} */
  const options = [
    ...Object.entries(statuses).map(
      ([key, v]) => /** @type {[string, string]} */ ([key, v.label]),
    ),
    ['', 'Hammasi'],
  ];
  mount.replaceChildren(
    ...options.map(([key, label]) => {
      const n = key ? (counts?.[key] ?? 0) : sum(counts);
      return h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(key === current),
          on: { click: () => onPick(key) },
        },
        label,
        h('span', { class: 'n', text: String(n) }),
      );
    }),
  );
}

// ---------- Tadbirlar ----------

function renderEventFilters() {
  renderChips(
    $('event-filters'),
    EVENT_STATUS,
    state.stats?.events,
    state.eventStatus,
    (status) => {
      state.eventStatus = status;
      state.eventPage = 1;
      renderEventFilters();
      void loadEvents();
    },
  );
}

/** @param {boolean} [append] */
async function loadEvents(append = false) {
  if (!append) showLoading(eventList);
  const status = state.eventStatus;
  let page;
  try {
    page = await api.admin.events(status, state.eventPage);
  } catch (error) {
    showError(eventList, error, () => loadEvents(append));
    return;
  }
  if (status !== state.eventStatus) return; // filtr almashib ulgurdi
  eventList.querySelector('.more')?.remove();
  if (!append) eventList.replaceChildren();

  if (!page.items.length && !append) {
    showEmpty(
      eventList,
      status === 'PENDING'
        ? "Tasdiq kutayotgan tadbir yo'q. Tashkilotchilar yangi tadbir qo'shganda shu yerda chiqadi."
        : 'Bu holatda tadbir topilmadi.',
    );
    return;
  }
  eventList.append(...page.items.map(eventCard));
  if (page.meta.page < page.meta.totalPages) {
    const more = h('button', {
      class: 'btn btn-secondary',
      type: 'button',
      text: "Yana ko'rsatish",
    });
    more.addEventListener(
      'click',
      () =>
        void withBusy(
          more,
          async () => {
            state.eventPage += 1;
            await loadEvents(true);
          },
          'Yuklanmoqda…',
        ),
    );
    eventList.append(h('div', { class: 'more' }, more));
  }
}

/** @param {AdminEvent} event */
function eventCard(event) {
  const status = EVENT_STATUS[event.status] ?? EVENT_STATUS.PENDING;
  const organizer = event.organizer.fullName?.trim() || 'Ismsiz tashkilotchi';
  const meta = [
    `Yuborilgan: ${fmt.dateTime(event.createdAt)}`,
    `${event._count.sessions} ta seans`,
    fmt.duration(event.duration),
    event.ageLimit !== null ? `${event.ageLimit}+` : null,
  ].filter(Boolean);

  const actions = h('div', { class: 'aactions' });
  if (event.status === 'PENDING') {
    const approve = h('button', {
      class: 'btn btn-primary',
      type: 'button',
      text: 'Tasdiqlash',
    });
    approve.addEventListener(
      'click',
      () =>
        void withBusy(
          approve,
          async () => {
            try {
              await api.admin.approveEvent(event.id);
              toast(`"${event.title}" tasdiqlandi va saytda chiqdi`);
              await refreshEvents();
            } catch (error) {
              toast(errorMessage(error));
            }
          },
          'Tasdiqlanmoqda…',
        ),
    );
    const reject = h('button', {
      class: 'btn btn-secondary btn-danger',
      type: 'button',
      text: 'Rad etish',
    });
    reject.addEventListener('click', () =>
      askAction({
        title: 'Tadbirni rad etish',
        sub: `"${event.title}" — tashkilotchi sababni ko'radi va tuzatib qayta yuborishi mumkin.`,
        reason: {
          label: 'Rad etish sababi',
          required: true,
          placeholder: 'Masalan: afisha sifati past, qayta yuklang',
        },
        submit: 'Rad etish',
        danger: true,
        run: async (text) => {
          await api.admin.rejectEvent(event.id, text);
          toast(`"${event.title}" rad etildi`);
          await refreshEvents();
        },
      }),
    );
    actions.append(approve, reject);
  } else if (event.status === 'APPROVED') {
    actions.append(
      h('a', {
        class: 'btn btn-secondary',
        href: routes.event(event.id),
        text: "Saytda ko'rish",
      }),
    );
    const cancel = h('button', {
      class: 'btn btn-ghost btn-danger',
      type: 'button',
      text: 'Bekor qilish',
    });
    cancel.addEventListener('click', () =>
      askAction({
        title: 'Tadbirni bekor qilish',
        sub: `"${event.title}" ning barcha seanslari to'xtatiladi, sotilgan chiptalar bekor bo'ladi. Bu amalni ortga qaytarib bo'lmaydi.`,
        submit: 'Ha, bekor qilish',
        danger: true,
        run: async () => {
          await api.admin.cancelEvent(event.id);
          toast(`"${event.title}" bekor qilindi`);
          await refreshEvents();
        },
      }),
    );
    actions.append(cancel);
  }

  return h(
    'article',
    { class: 'acard' },
    h(
      'div',
      { class: `aposter ${fallbackClass(event.id)}` },
      posterImage(event.posterUrl, ''),
    ),
    h(
      'div',
      { class: 'ainfo' },
      h(
        'div',
        { class: 'top' },
        h('span', {
          class: `badge ${status.badge}`,
          text: status.label.toUpperCase(),
        }),
      ),
      h('div', { class: 't', text: event.title }),
      h(
        'div',
        { class: 'v' },
        `Tashkilotchi: ${organizer} · `,
        h('a', {
          href: `mailto:${event.organizer.email}`,
          text: event.organizer.email,
        }),
      ),
      h('div', { class: 'v', text: meta.join(' · ') }),
      event.rejectReason
        ? h(
            'div',
            { class: 'reason' },
            h('b', { text: 'Rad etish sababi: ' }),
            event.rejectReason,
          )
        : null,
      event.description
        ? h(
            'details',
            null,
            h('summary', { text: 'Tavsif' }),
            h('p', { class: 'desc', text: event.description }),
          )
        : null,
    ),
    actions.childElementCount ? actions : null,
  );
}

async function refreshEvents() {
  state.eventPage = 1;
  await loadStats();
  renderEventFilters();
  await loadEvents();
}

// ---------- Arizalar ----------

function renderAppFilters() {
  renderChips(
    $('app-filters'),
    APP_STATUS,
    state.stats?.applications,
    state.appStatus,
    (status) => {
      state.appStatus = status;
      renderAppFilters();
      void loadApps();
    },
  );
}

async function loadApps() {
  showLoading(appList);
  const status = state.appStatus;
  let apps;
  try {
    apps = await api.admin.applications(status);
  } catch (error) {
    showError(appList, error, loadApps);
    return;
  }
  if (status !== state.appStatus) return;
  if (!apps.length) {
    showEmpty(
      appList,
      status === 'PENDING'
        ? 'Yangi ariza yo\'q. Foydalanuvchi profilidan "Organizer bo\'lish" arizasini yuborganda shu yerda chiqadi.'
        : 'Bu holatda ariza topilmadi.',
    );
    return;
  }
  appList.replaceChildren(...apps.map(appCard));
}

/** @param {AdminApplication} app */
function appCard(app) {
  const status = APP_STATUS[app.status] ?? APP_STATUS.PENDING;
  const person = app.user.fullName?.trim() || 'Ismsiz foydalanuvchi';
  const initial = (app.companyName.trim()[0] ?? '?').toUpperCase();

  const actions = h('div', { class: 'aactions' });
  if (app.status === 'PENDING') {
    const approve = h('button', {
      class: 'btn btn-primary',
      type: 'button',
      text: 'Tasdiqlash',
    });
    approve.addEventListener(
      'click',
      () =>
        void withBusy(
          approve,
          async () => {
            try {
              await api.admin.approveApplication(app.id);
              toast(`${app.companyName} endi tashkilotchi`);
              await refreshApps();
            } catch (error) {
              toast(errorMessage(error));
            }
          },
          'Tasdiqlanmoqda…',
        ),
    );
    const reject = h('button', {
      class: 'btn btn-secondary btn-danger',
      type: 'button',
      text: 'Rad etish',
    });
    reject.addEventListener('click', () =>
      askAction({
        title: 'Arizani rad etish',
        sub: `${app.companyName} (${app.user.email}) — foydalanuvchi keyinroq qayta ariza yuborishi mumkin.`,
        reason: {
          label: 'Sabab (ixtiyoriy)',
          required: false,
          placeholder: "Masalan: kompaniya ma'lumotlari to'liq emas",
        },
        submit: 'Rad etish',
        danger: true,
        run: async (text) => {
          await api.admin.rejectApplication(app.id, text);
          toast(`${app.companyName} arizasi rad etildi`);
          await refreshApps();
        },
      }),
    );
    actions.append(approve, reject);
  }

  const reviewed = app.reviewedAt
    ? ` · Ko'rib chiqilgan: ${fmt.dateTime(app.reviewedAt)}`
    : '';
  return h(
    'article',
    { class: 'acard app' },
    h('div', { class: 'avatar', 'aria-hidden': 'true', text: initial }),
    h(
      'div',
      { class: 'ainfo' },
      h(
        'div',
        { class: 'top' },
        h('span', {
          class: `badge ${status.badge}`,
          text: status.label.toUpperCase(),
        }),
      ),
      h('div', { class: 't', text: app.companyName }),
      h(
        'div',
        { class: 'v' },
        `${person} · `,
        h('a', { href: `mailto:${app.user.email}`, text: app.user.email }),
      ),
      h(
        'div',
        { class: 'v' },
        'Telefon: ',
        h('a', {
          href: `tel:${app.phone.replace(/\s/g, '')}`,
          text: app.phone,
        }),
      ),
      h('div', {
        class: 'v',
        text: `Yuborilgan: ${fmt.dateTime(app.createdAt)}${reviewed}`,
      }),
      app.rejectReason
        ? h(
            'div',
            { class: 'reason' },
            h('b', { text: 'Rad etish sababi: ' }),
            app.rejectReason,
          )
        : null,
      app.description
        ? h(
            'details',
            null,
            h('summary', { text: 'Kompaniya haqida' }),
            h('p', { class: 'desc', text: app.description }),
          )
        : null,
    ),
    actions.childElementCount ? actions : null,
  );
}

async function refreshApps() {
  await loadStats();
  renderAppFilters();
  await loadApps();
}

// ---------- Tasdiqlash oynasi ----------

const modal = $('action-modal');
const form = /** @type {HTMLFormElement} */ ($('action-form'));
const reasonField = $('action-field');
const reasonInput = /** @type {HTMLTextAreaElement} */ ($('action-reason'));
const banner = $('action-banner');
const submitButton = /** @type {HTMLButtonElement} */ ($('action-submit'));
/** @type {(() => void) | null} */
let closeModal = null;
/** @type {((reason: string) => Promise<void>) | null} */
let pending = null;
let reasonRequired = false;

$('action-cancel').addEventListener('click', () => closeModal?.());
reasonInput.addEventListener('input', () => setFieldError(reasonInput, null));

/**
 * @param {{
 *   title: string, sub: string, submit: string, danger?: boolean,
 *   reason?: { label: string, required: boolean, placeholder: string },
 *   run: (reason: string) => Promise<void>,
 * }} options
 */
function askAction(options) {
  $('action-title').textContent = options.title;
  $('action-sub').textContent = options.sub;
  submitButton.textContent = options.submit;
  form.classList.toggle('danger', Boolean(options.danger));
  reasonField.hidden = !options.reason;
  reasonRequired = Boolean(options.reason?.required);
  $('action-label').textContent = options.reason?.label ?? '';
  reasonInput.placeholder = options.reason?.placeholder ?? '';
  reasonInput.value = '';
  setFieldError(reasonInput, null);
  setBanner(banner, null);
  pending = options.run;
  closeModal = openModal(modal, () => {
    pending = null;
  });
  if (options.reason) reasonInput.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const run = pending;
  if (!run) return;
  const text = reasonInput.value.trim();
  if (!reasonField.hidden && reasonRequired && !text) {
    setFieldError(reasonInput, "Sababni yozing — tashkilotchi uni ko'radi");
    reasonInput.focus();
    return;
  }
  setBanner(banner, null);
  void withBusy(
    submitButton,
    async () => {
      try {
        await run(text);
        closeModal?.();
      } catch (error) {
        setBanner(banner, errorMessage(error));
      }
    },
    'Bajarilmoqda…',
  );
});
