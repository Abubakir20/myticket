// @ts-check
// Tashkilotchi paneli: tadbirlar (sotuv bilan), tadbir yaratish/tahrirlash, seans qo'shish, kontrollerlar.
// GET /events/my, POST|PATCH /events, POST /events/:id/sessions, GET /venues, /organizer/*, /controller-events

import { api, ApiError } from '../api.js';
import * as fmt from '../format.js';
import { routes } from '../routes.js';
import { requireUser } from '../session.js';
import { mountNav, mountFooter } from '../shell.js';
import { icon } from '../icons.js';
import * as v from '../validate.js';
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
  passwordToggle,
} from '../ui.js';

/** @typedef {import('../types.js').OrganizerEvent} OrganizerEvent */
/** @typedef {import('../types.js').OrganizerSession} OrganizerSession */
/** @typedef {import('../types.js').OrganizerController} OrganizerController */
/** @typedef {import('../types.js').VenueBrief} VenueBrief */

const STATUS = {
  PENDING: { label: 'Tasdiq kutilmoqda', badge: 'b-pending' },
  APPROVED: { label: 'Afishada', badge: 'b-ok' },
  REJECTED: { label: 'Rad etilgan', badge: 'b-err' },
  CANCELLED: { label: 'Bekor qilingan', badge: 'b-neutral' },
};
const MAX_POSTER = 5 * 1024 * 1024;

/** @type {OrganizerEvent[]} */
let events = [];
/** @type {OrganizerController[]} */
let controllers = [];
/** @type {VenueBrief[]} */
let venues = [];
/** @type {OrganizerEvent | null} tahrirlanayotgan tadbir */
let editing = null;

const eventList = $('event-list');
const ctrlList = $('ctrl-list');

for (const el of document.querySelectorAll('[data-icon]')) {
  el.append(icon(/** @type {HTMLElement} */ (el).dataset.icon ?? '', 18));
}
$('sd-close').append(icon('close', 18));

void mountNav($('topnav'), 'organizer');
mountFooter($('footer'));
void init();

async function init() {
  const user = await requireUser(['ORGANIZER']);
  const first = user.fullName?.trim().split(' ')[0];
  if (first) $('org-title').textContent = `Salom, ${first}!`;
  setupTabs();
  setupForm();
  setupSessionForm();
  setupControllerForm();
  await Promise.all([loadEvents(), loadControllers()]);
}

// ---------- Tablar ----------

/** @type {(name: 'events' | 'form' | 'ctrl') => void} */
let selectTab = () => {};

function setupTabs() {
  const tabs = /** @type {HTMLButtonElement[]} */ ([
    $('tab-events'),
    $('tab-form'),
    $('tab-ctrl'),
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
  selectTab = (name) =>
    select({ events: tabs[0], form: tabs[1], ctrl: tabs[2] }[name]);
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      if (tab === tabs[1] && editing) resetForm();
      select(tab);
    });
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
  $('new-event').addEventListener('click', () => {
    resetForm();
    selectTab('form');
    $('ev-title').focus();
  });
  if (location.hash === '#yangi') selectTab('form');
  if (location.hash === '#kontrollerlar') selectTab('ctrl');
}

// ---------- Statistika ----------

function renderStats() {
  const sessions = events.flatMap((e) =>
    e.sessions.filter((s) => s.status === 'ACTIVE'),
  );
  const sold = sessions.reduce((a, s) => a + s.sold, 0);
  const revenue = sessions.reduce((a, s) => a + s.revenue, 0);
  const approved = events.filter((e) => e.status === 'APPROVED').length;
  const pending = events.filter((e) => e.status === 'PENDING').length;
  const now = Date.now();
  const next = sessions
    .filter((s) => Date.parse(s.startTime) > now)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0];
  const nextEvent = next ? events.find((e) => e.sessions.includes(next)) : null;

  /** @param {string} k @param {string} val @param {string} sub @param {string} [cls] */
  const tile = (k, val, sub, cls = '') =>
    h(
      'div',
      { class: `stat ${cls}` },
      h('div', { class: 'k', text: k }),
      h('div', { class: 'v', text: val, title: val }),
      h('div', { class: 's', text: sub }),
    );
  $('stats').replaceChildren(
    tile('Tushum', compactPrice(revenue), `${sold} ta chipta sotildi`, 'lead'),
    tile(
      'Tadbirlar',
      String(events.length),
      `${approved} tasi afishada · ${pending} tasi tasdiq kutmoqda`,
    ),
    tile(
      'Faol seanslar',
      String(sessions.length),
      next
        ? `eng yaqini: ${fmt.dateTime(next.startTime)}`
        : "kelgusi seans yo'q",
    ),
    tile(
      'Kontrollerlar',
      String(controllers.length),
      nextEvent ? `keyingi tadbir: ${nextEvent.title}` : 'QR skanerlash uchun',
    ),
  );
  $('count-events').textContent = events.length ? String(events.length) : '';
  $('count-ctrl').textContent = controllers.length
    ? String(controllers.length)
    : '';
}

/** @param {number} value */
function compactPrice(value) {
  if (value >= 1e6)
    return `${(value / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',')} mln so'm`;
  return fmt.price(value);
}

// ---------- Tadbirlar ro'yxati ----------

async function loadEvents() {
  showLoading(eventList);
  try {
    events = await api.organizer.events();
  } catch (error) {
    showError(eventList, error, loadEvents);
    return;
  }
  renderStats();
  renderEvents();
}

function renderEvents() {
  if (!events.length) {
    eventList.replaceChildren(
      h(
        'div',
        { class: 'orgempty' },
        h('span', { class: 'orgempty-ic' }, icon('sparkle', 28)),
        h('h3', { text: "Hali tadbir yo'q" }),
        h('p', {
          text: 'Birinchi tadbiringizni yarating: afisha, tavsif, keyin seans va narxlar. Admin tasdiqlagach u afishada chiqadi.',
        }),
        h(
          'button',
          {
            class: 'btn btn-grad btn-lg',
            type: 'button',
            on: {
              click: () => {
                resetForm();
                selectTab('form');
              },
            },
          },
          'Tadbir yaratish',
        ),
      ),
    );
    return;
  }
  eventList.replaceChildren(...events.map(eventCard));
}

/** @param {OrganizerEvent} event */
function eventCard(event) {
  const status = STATUS[event.status] ?? STATUS.PENDING;
  const active = event.sessions.filter((s) => s.status === 'ACTIVE');
  const sold = active.reduce((a, s) => a + s.sold, 0);
  const revenue = active.reduce((a, s) => a + s.revenue, 0);
  const cancelled = event.status === 'CANCELLED';

  const actions = h(
    'div',
    { class: 'oeactions' },
    !cancelled
      ? h(
          'button',
          {
            class: 'btn btn-primary btn-sm',
            type: 'button',
            on: { click: () => void openSession(event) },
          },
          icon('calendar', 15),
          "Seans qo'shish",
        )
      : null,
    !cancelled
      ? h(
          'button',
          {
            class: 'btn btn-secondary btn-sm',
            type: 'button',
            on: { click: () => startEdit(event) },
          },
          'Tahrirlash',
        )
      : null,
    event.status === 'APPROVED'
      ? h(
          'a',
          { class: 'btn btn-secondary btn-sm', href: routes.event(event.id) },
          icon('eye', 15),
          "Saytda ko'rish",
        )
      : null,
    !cancelled
      ? h('button', {
          class: 'btn btn-ghost btn-sm btn-danger',
          type: 'button',
          text: 'Bekor qilish',
          on: {
            click: () =>
              confirmAction(
                'Tadbirni bekor qilasizmi?',
                `"${event.title}" ning barcha seanslari to'xtatiladi va sotilgan chiptalar bekor bo'ladi. Bu amalni ortga qaytarib bo'lmaydi.`,
                async () => {
                  await api.organizer.cancelEvent(event.id);
                  toast('Tadbir bekor qilindi');
                  await loadEvents();
                },
              ),
          },
        })
      : null,
  );

  const notice =
    event.status === 'REJECTED' && event.rejectReason
      ? h(
          'div',
          { class: 'reason' },
          h('b', { text: 'Admin izohi: ' }),
          event.rejectReason,
          h('span', {
            class: 'reason-hint',
            text: ' Tuzatib saqlasangiz, tadbir qayta tekshiruvga yuboriladi.',
          }),
        )
      : event.status === 'PENDING'
        ? h(
            'div',
            { class: 'oenote' },
            icon('clock', 15),
            active.length
              ? 'Admin tekshiruvida. Tasdiqlangach tadbir afishada chiqadi.'
              : "Admin tekshiruvida. Hozircha seans qo'shib qo'ying — tasdiqlangach darhol sotuv boshlanadi.",
          )
        : event.status === 'APPROVED' && !active.length
          ? h(
              'div',
              { class: 'oenote warn' },
              icon('bolt', 15),
              "Tadbir afishada, lekin seans yo'q — chipta sotish uchun seans qo'shing.",
            )
          : null;

  return h(
    'article',
    { class: `oecard${cancelled ? ' is-off' : ''}` },
    h(
      'div',
      { class: 'oetop' },
      h(
        'div',
        { class: `oeposter ${fallbackClass(event.id)}` },
        posterImage(event.posterUrl, ''),
      ),
      h(
        'div',
        { class: 'oeinfo' },
        h('span', {
          class: `badge ${status.badge}`,
          text: status.label.toUpperCase(),
        }),
        h('h3', { text: event.title }),
        h(
          'div',
          { class: 'oemeta' },
          h('span', null, icon('clock', 14), fmt.duration(event.duration)),
          event.ageLimit !== null
            ? h('span', { text: fmt.ageLabel(event.ageLimit) })
            : null,
          h('span', null, icon('calendar', 14), `${active.length} ta seans`),
          h('span', null, icon('ticket', 14), `${sold} ta sotildi`),
          revenue
            ? h('span', { class: 'oerev', text: fmt.price(revenue) })
            : null,
        ),
        notice,
        actions,
      ),
    ),
    event.sessions.length
      ? h(
          'div',
          { class: 'oesessions' },
          event.sessions.map((s) => sessionRow(event, s)),
        )
      : null,
  );
}

/** @param {OrganizerEvent} event @param {OrganizerSession} s */
function sessionRow(event, s) {
  const { d, m } = fmt.dayMonth(s.startTime);
  const past = Date.parse(s.startTime) <= Date.now();
  const off = s.status === 'CANCELLED';
  const seated = s.seatingType === 'SEATED';
  const prices = s.ticketCategories.map((c) => Number(c.price));
  const range = prices.length
    ? Math.min(...prices) === Math.max(...prices)
      ? fmt.price(Math.min(...prices))
      : `${fmt.price(Math.min(...prices))} – ${fmt.price(Math.max(...prices))}`
    : '';
  const capacity = seated
    ? null
    : s.ticketCategories.reduce((a, c) => a + (c.quantity ?? 0), 0);

  return h(
    'div',
    { class: `osess${off || past ? ' dim' : ''}` },
    h(
      'div',
      { class: 'sdate', 'aria-hidden': 'true' },
      h('b', { text: String(Number(d)) }),
      h('span', { text: m.slice(0, 3) }),
    ),
    h(
      'div',
      { class: 'osinfo' },
      h('b', {
        text: `${fmt.weekday(s.startTime)}, ${fmt.time(s.startTime)} · ${s.venue.name}`,
      }),
      h(
        'span',
        null,
        seated ? "O'rindiqli" : 'Umumiy kirish',
        ' · ',
        s.ticketCategories.map((c) => c.name).join(', '),
        range ? ` · ${range}` : '',
      ),
    ),
    h(
      'div',
      { class: 'ossold' },
      h('b', { text: capacity ? `${s.sold} / ${capacity}` : String(s.sold) }),
      h('span', { text: s.revenue ? fmt.price(s.revenue) : 'sotildi' }),
    ),
    off
      ? h('span', { class: 'badge b-neutral', text: 'BEKOR' })
      : past
        ? h('span', { class: 'badge b-neutral', text: "O'TDI" })
        : h(
            'button',
            {
              class: 'picon',
              type: 'button',
              title: 'Seansni bekor qilish',
              'aria-label': `${fmt.dateTime(s.startTime)} seansini bekor qilish`,
              on: {
                click: () =>
                  confirmAction(
                    'Seansni bekor qilasizmi?',
                    `${fmt.dateTime(s.startTime)}, ${s.venue.name}. Sotilgan chiptalar bekor qilinadi.`,
                    async () => {
                      await api.organizer.cancelSession(s.id);
                      toast('Seans bekor qilindi');
                      await loadEvents();
                    },
                  ),
              },
            },
            icon('close', 15),
          ),
  );
}

// ---------- Tadbir formasi ----------

const form = /** @type {HTMLFormElement} */ ($('event-form'));
const titleIn = /** @type {HTMLInputElement} */ ($('ev-title'));
const descIn = /** @type {HTMLTextAreaElement} */ ($('ev-desc'));
const durIn = /** @type {HTMLInputElement} */ ($('ev-duration'));
const ageIn = /** @type {HTMLSelectElement} */ ($('ev-age'));
const posterIn = /** @type {HTMLInputElement} */ ($('ev-poster'));
const galleryIn = /** @type {HTMLInputElement} */ ($('ev-gallery'));
const posterPreview = /** @type {HTMLImageElement} */ ($('poster-preview'));
/** @type {File | null} */
let posterFile = null;

function setupForm() {
  descIn.addEventListener('input', () => {
    const n = descIn.value.trim().length;
    $('desc-count').textContent = n >= 10 ? `${n} belgi` : `${n} / 10+`;
  });
  posterIn.addEventListener('change', () =>
    pickPoster(posterIn.files?.[0] ?? null),
  );
  const dz = $('dropzone');
  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('over');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    pickPoster(e.dataTransfer?.files?.[0] ?? null);
  });
  galleryIn.addEventListener('change', () => {
    const files = [...(galleryIn.files ?? [])].slice(0, 10);
    $('gallery-preview').replaceChildren(
      ...files.map((f) => {
        const img = h('img', { alt: '' });
        img.src = URL.createObjectURL(f);
        return img;
      }),
    );
  });
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (
      (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) &&
      t.getAttribute('aria-invalid')
    )
      setFieldError(t, null);
  });
  $('form-cancel').addEventListener('click', () => {
    resetForm();
    selectTab('events');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void submitEvent();
  });
}

/** @param {File | null} file */
function pickPoster(file) {
  const err = $('poster-error');
  err.hidden = true;
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    err.textContent = 'Faqat JPG, PNG yoki WEBP rasm';
    err.hidden = false;
    return;
  }
  if (file.size > MAX_POSTER) {
    err.textContent = 'Rasm 5 MB dan katta';
    err.hidden = false;
    return;
  }
  posterFile = file;
  posterPreview.src = URL.createObjectURL(file);
  showPoster(true);
}

/** @param {boolean} has */
function showPoster(has) {
  posterPreview.hidden = !has;
  $('dz-empty').hidden = has;
  $('dz-change').hidden = !has;
  $('dropzone').classList.toggle('has', has);
}

function resetForm() {
  editing = null;
  form.reset();
  posterFile = null;
  posterPreview.removeAttribute('src');
  showPoster(false);
  $('gallery-preview').replaceChildren();
  $('gallery-field').hidden = false;
  $('poster-error').hidden = true;
  $('desc-count').textContent = '0 / 10+';
  $('form-title').textContent = 'Yangi tadbir';
  $('form-sub').textContent =
    "Afisha va asosiy ma'lumotlarni kiriting. Saqlangach, seans va narxlarni qo'shasiz.";
  $('form-submit').textContent = 'Tadbirni yaratish';
  $('tab-form').textContent = 'Yangi tadbir';
  setBanner($('form-banner'), null);
  for (const el of [titleIn, descIn, durIn]) setFieldError(el, null);
}

/** @param {OrganizerEvent} event */
function startEdit(event) {
  resetForm();
  editing = event;
  titleIn.value = event.title;
  descIn.value = event.description;
  descIn.dispatchEvent(new Event('input'));
  durIn.value = String(event.duration);
  ageIn.value = event.ageLimit === null ? '' : String(event.ageLimit);
  posterPreview.src = event.posterUrl;
  showPoster(true);
  $('gallery-field').hidden = true;
  $('form-title').textContent = 'Tadbirni tahrirlash';
  $('form-sub').textContent =
    event.status === 'APPROVED'
      ? 'Diqqat: saqlangach tadbir qayta admin tekshiruviga yuboriladi va tasdiqlanguncha afishadan olinadi.'
      : 'Saqlangach tadbir admin tekshiruviga yuboriladi.';
  $('form-submit').textContent = "O'zgarishlarni saqlash";
  $('tab-form').textContent = 'Tahrirlash';
  selectTab('form');
  scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitEvent() {
  setBanner($('form-banner'), null);
  const title = titleIn.value.trim();
  const desc = descIn.value.trim();
  const dur = Number(durIn.value);
  let ok = true;
  setFieldError(titleIn, title ? null : 'Tadbir nomini kiriting');
  setFieldError(
    descIn,
    desc.length >= 10 ? null : "Tavsif kamida 10 belgi bo'lsin",
  );
  setFieldError(
    durIn,
    Number.isInteger(dur) && dur >= 1 && dur <= 1440
      ? null
      : '1 dan 1440 gacha daqiqa',
  );
  if (!title || desc.length < 10 || !(dur >= 1 && dur <= 1440)) ok = false;
  if (!editing && !posterFile) {
    const err = $('poster-error');
    err.textContent = 'Afisha majburiy';
    err.hidden = false;
    ok = false;
  }
  if (!ok) {
    /** @type {HTMLElement | null} */ (
      form.querySelector('[aria-invalid="true"]')
    )?.focus();
    return;
  }

  const data = new FormData();
  data.set('title', title);
  data.set('description', desc);
  data.set('duration', String(Math.round(dur)));
  if (ageIn.value !== '') data.set('ageLimit', ageIn.value);
  if (posterFile) data.set('poster', posterFile);

  const button = /** @type {HTMLButtonElement} */ ($('form-submit'));
  await withBusy(
    button,
    async () => {
      try {
        if (editing) {
          await api.organizer.updateEvent(editing.id, data);
          toast("O'zgarishlar saqlandi — tadbir tekshiruvga yuborildi");
          resetForm();
          selectTab('events');
          await loadEvents();
          return;
        }
        const created = /** @type {{ id: string }} */ (
          await api.organizer.createEvent(data)
        );
        const gallery = [...(galleryIn.files ?? [])].slice(0, 10);
        if (gallery.length && created?.id) {
          const g = new FormData();
          for (const f of gallery) g.append('images', f);
          await api.organizer
            .addImages(created.id, g)
            .catch(() =>
              toast('Afisha saqlandi, lekin galereya rasmlari yuklanmadi'),
            );
        }
        toast("Tadbir yaratildi! Endi seans qo'shing");
        resetForm();
        selectTab('events');
        await loadEvents();
        const fresh = events.find((e) => e.id === created?.id);
        if (fresh) void openSession(fresh);
      } catch (error) {
        setBanner($('form-banner'), errorMessage(error));
      }
    },
    editing ? 'Saqlanmoqda…' : 'Yaratilmoqda…',
  );
}

// ---------- Seans qo'shish ----------

const sdForm = /** @type {HTMLFormElement} */ ($('session-form'));
const sdVenue = /** @type {HTMLSelectElement} */ ($('sd-venue'));
const sdTime = /** @type {HTMLInputElement} */ ($('sd-time'));
const catsEl = $('cats');
/** @type {(() => void) | null} */
let closeSession = null;
/** @type {OrganizerEvent | null} */
let sessionEvent = null;
/** @type {Map<string, import('../types.js').VenueDetail>} */
const venueCache = new Map();

const seating = () =>
  /** @type {'SEATED' | 'GENERAL'} */ (
    /** @type {HTMLInputElement} */ (
      sdForm.querySelector('input[name="seating"]:checked')
    ).value
  );

function setupSessionForm() {
  $('sd-close').addEventListener('click', () => closeSession?.());
  $('sd-cancel').addEventListener('click', () => closeSession?.());
  sdVenue.addEventListener('change', () => {
    syncSeatingAvailability();
    void renderCats();
  });
  for (const r of sdForm.querySelectorAll('input[name="seating"]')) {
    r.addEventListener('change', () => void renderCats());
  }
  sdForm.addEventListener('submit', (e) => {
    e.preventDefault();
    void submitSession();
  });
}

/** @param {OrganizerEvent} event */
async function openSession(event) {
  sessionEvent = event;
  $('sd-event').textContent = event.title;
  setBanner($('sd-banner'), null);
  sdForm.reset();
  closeSession = openModal($('session-drawer'));
  // Minimal vaqt: hozirdan 1 soat keyin; standart — ertaga 19:00
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const local = (/** @type {Date} */ d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const min = new Date(Date.now() + 3600e3);
  sdTime.min = local(min);
  const def = new Date();
  def.setDate(def.getDate() + 1);
  def.setHours(19, 0, 0, 0);
  sdTime.value = local(def);

  if (!venues.length) {
    sdVenue.replaceChildren(h('option', { value: '', text: 'Yuklanmoqda…' }));
    try {
      venues = (await api.organizer.venues()).filter((x) => x.isActive);
    } catch (error) {
      setBanner($('sd-banner'), errorMessage(error));
      return;
    }
  }
  if (!venues.length) {
    sdVenue.replaceChildren(h('option', { value: '', text: "Zal yo'q" }));
    setBanner(
      $('sd-banner'),
      "Hali birorta zal qo'shilmagan. Zallarni admin qo'shadi.",
    );
    return;
  }
  // O'rindiqli zallar birinchi
  const sorted = [...venues].sort(
    (a, b) => Number(b._count.sectors > 0) - Number(a._count.sectors > 0),
  );
  sdVenue.replaceChildren(
    ...sorted.map((x) =>
      h('option', {
        value: x.id,
        text: `${x.name}${x._count.sectors ? '' : " · o'rindiqsiz"}`,
      }),
    ),
  );
  syncSeatingAvailability();
  await renderCats();
}

/** O'rindiqsiz zalda faqat umumiy kirish bo'lishi mumkin */
function syncSeatingAvailability() {
  const venue = venues.find((x) => x.id === sdVenue.value);
  const seatedInput = /** @type {HTMLInputElement} */ (
    sdForm.querySelector('input[value="SEATED"]')
  );
  const generalInput = /** @type {HTMLInputElement} */ (
    sdForm.querySelector('input[value="GENERAL"]')
  );
  const canSeat = Boolean(venue && venue._count.sectors > 0);
  seatedInput.disabled = !canSeat;
  seatedInput.closest('label')?.classList.toggle('disabled', !canSeat);
  if (!canSeat) generalInput.checked = true;
}

async function renderCats() {
  const type = seating();
  $('cats-label').textContent =
    type === 'SEATED' ? 'Sektorlar va narxlar' : 'Chipta toifalari';
  if (type === 'GENERAL') {
    catsEl.replaceChildren(
      h('div', { class: 'gcats' }),
      h(
        'button',
        {
          class: 'btn btn-secondary btn-sm addcat',
          type: 'button',
          on: { click: () => addGeneralRow() },
        },
        "+ Toifa qo'shish",
      ),
    );
    addGeneralRow('Standart', '', '100');
    return;
  }
  const venueId = sdVenue.value;
  if (!venueId) return;
  catsEl.replaceChildren(
    h('div', { class: 'state small' }, h('div', { class: 'spinner' })),
  );
  let venue = venueCache.get(venueId);
  if (!venue) {
    try {
      venue = await api.organizer.venue(venueId);
      venueCache.set(venueId, venue);
    } catch (error) {
      catsEl.replaceChildren(
        h('p', { class: 'field-error', text: errorMessage(error) }),
      );
      return;
    }
  }
  if (!venue.sectors.length) {
    catsEl.replaceChildren(
      h('p', {
        class: 'hint-line',
        text: "Bu zalda sektor yo'q. Umumiy kirish turini tanlang yoki boshqa zal tanlang.",
      }),
    );
    return;
  }
  catsEl.replaceChildren(
    h('p', {
      class: 'hint-line',
      text: 'Har bir sektor uchun narx kiriting. Sotilmaydigan sektordan belgini olib tashlang.',
    }),
    ...venue.sectors.map((sector) => {
      const seats = sector.rows.reduce((a, r) => a + r.seats.length, 0);
      const row = h(
        'div',
        { class: 'scat', dataset: { sector: sector.id } },
        h(
          'label',
          { class: 'scat-on' },
          h('input', {
            type: 'checkbox',
            checked: true,
            'aria-label': `${sector.name} sotuvda`,
          }),
          h(
            'span',
            null,
            h('b', { text: sector.name }),
            h('small', {
              text: `${sector.rows.length} qator · ${seats} o'rin`,
            }),
          ),
        ),
        h('input', {
          class: 'input',
          type: 'text',
          value: sector.name,
          maxlength: '100',
          'aria-label': `${sector.name}: toifa nomi`,
          'data-k': 'name',
        }),
        h('input', {
          class: 'input',
          type: 'number',
          min: '0',
          step: '1000',
          placeholder: "Narx, so'm",
          'aria-label': `${sector.name}: narx`,
          'data-k': 'price',
        }),
      );
      const box = /** @type {HTMLInputElement} */ (
        row.querySelector('input[type="checkbox"]')
      );
      box.addEventListener('change', () =>
        row.classList.toggle('off', !box.checked),
      );
      return row;
    }),
  );
}

/** @param {string} [name] @param {string} [price] @param {string} [qty] */
function addGeneralRow(name = '', price = '', qty = '') {
  const list = catsEl.querySelector('.gcats');
  if (!list) return;
  const row = h(
    'div',
    { class: 'gcat' },
    h('input', {
      class: 'input',
      type: 'text',
      value: name,
      placeholder: 'Toifa nomi (VIP, Standart…)',
      maxlength: '100',
      'aria-label': 'Toifa nomi',
      'data-k': 'name',
    }),
    h('input', {
      class: 'input',
      type: 'number',
      min: '0',
      step: '1000',
      value: price,
      placeholder: "Narx, so'm",
      'aria-label': 'Narx',
      'data-k': 'price',
    }),
    h('input', {
      class: 'input',
      type: 'number',
      min: '1',
      step: '1',
      value: qty,
      placeholder: 'Soni',
      'aria-label': 'Chiptalar soni',
      'data-k': 'qty',
    }),
    h(
      'button',
      {
        class: 'picon',
        type: 'button',
        'aria-label': "Toifani o'chirish",
        on: {
          click: () => {
            if (list.children.length > 1) row.remove();
          },
        },
      },
      icon('close', 15),
    ),
  );
  list.append(row);
}

async function submitSession() {
  if (!sessionEvent) return;
  const banner = $('sd-banner');
  setBanner(banner, null);
  const type = seating();
  const venueId = sdVenue.value;
  if (!venueId) return setBanner(banner, 'Zalni tanlang');
  const when = sdTime.value ? new Date(sdTime.value) : null;
  if (!when || Number.isNaN(when.getTime()))
    return setBanner(banner, 'Sana va vaqtni kiriting');
  if (when.getTime() <= Date.now())
    return setBanner(banner, "Seans vaqti kelajakda bo'lishi kerak");

  /** @type {{ name: string, price: number, sectorId?: string, quantity?: number }[]} */
  const categories = [];
  /** @param {Element} row @param {string} k */
  const val = (row, k) =>
    /** @type {HTMLInputElement} */ (
      row.querySelector(`[data-k="${k}"]`)
    ).value.trim();
  if (type === 'SEATED') {
    for (const row of catsEl.querySelectorAll('.scat')) {
      if (row.classList.contains('off')) continue;
      const name = val(row, 'name');
      const price = Number(val(row, 'price'));
      if (!name || val(row, 'price') === '' || !(price >= 0))
        return setBanner(
          banner,
          'Har bir tanlangan sektor uchun nom va narx kiriting',
        );
      categories.push({
        name,
        price,
        sectorId: /** @type {HTMLElement} */ (row).dataset.sector,
      });
    }
    if (!categories.length)
      return setBanner(banner, "Kamida bitta sektor sotuvda bo'lishi kerak");
  } else {
    for (const row of catsEl.querySelectorAll('.gcat')) {
      const name = val(row, 'name');
      const price = Number(val(row, 'price'));
      const quantity = Number(val(row, 'qty'));
      if (
        !name ||
        val(row, 'price') === '' ||
        !(price >= 0) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      )
        return setBanner(
          banner,
          'Har bir toifa uchun nom, narx va sonini kiriting',
        );
      categories.push({ name, price, quantity });
    }
  }

  const event = sessionEvent;
  await withBusy(
    /** @type {HTMLButtonElement} */ ($('sd-submit')),
    async () => {
      try {
        await api.organizer.createSession(event.id, {
          venueId,
          startTime: when.toISOString(),
          seatingType: type,
          categories,
        });
        closeSession?.();
        toast(`Seans qo'shildi: ${fmt.dateTime(when.toISOString())}`);
        await loadEvents();
      } catch (error) {
        setBanner(banner, errorMessage(error));
      }
    },
    "Qo'shilmoqda…",
  );
}

// ---------- Kontrollerlar ----------

async function loadControllers() {
  showLoading(ctrlList);
  try {
    controllers = await api.organizer.controllers();
  } catch (error) {
    showError(ctrlList, error, loadControllers);
    return;
  }
  renderStats();
  renderControllers();
}

function renderControllers() {
  if (!controllers.length) {
    showEmpty(
      ctrlList,
      "Hali kontroller yo'q. Chap tomondagi forma orqali yarating va tadbirga biriktiring.",
    );
    return;
  }
  ctrlList.replaceChildren(...controllers.map(controllerCard));
}

/** @param {OrganizerController} c */
function controllerCard(c) {
  const assigned = new Set(c.controllerEvents.map((x) => x.event.id));
  const options = events.filter(
    (e) => e.status !== 'CANCELLED' && !assigned.has(e.id),
  );
  const select = h(
    'select',
    { class: 'input', 'aria-label': `${c.email}: tadbir tanlash` },
    h('option', {
      value: '',
      text: options.length
        ? 'Tadbirga biriktirish…'
        : "Biriktiriladigan tadbir yo'q",
    }),
    options.map((e) => h('option', { value: e.id, text: e.title })),
  );
  select.disabled = !options.length;
  select.addEventListener('change', () => {
    const eventId = select.value;
    if (!eventId) return;
    select.disabled = true;
    void api.organizer
      .assign(c.id, eventId)
      .then(async () => {
        toast('Kontroller tadbirga biriktirildi');
        await loadControllers();
      })
      .catch((error) => {
        toast(errorMessage(error));
        select.disabled = false;
        select.value = '';
      });
  });

  return h(
    'article',
    { class: 'ccard' },
    h(
      'div',
      { class: 'ccard-top' },
      h('span', {
        class: 'uav r-CONTROLLER',
        'aria-hidden': 'true',
        text: ((c.fullName || c.email)[0] ?? '?').toUpperCase(),
      }),
      h(
        'div',
        { class: 'uname' },
        h('span', { class: 'n', text: c.fullName || 'Ismsiz' }),
        h('span', { class: 'e', text: c.email }),
      ),
      h('span', { class: 'ccount', text: `${c._count.checkedTickets} skaner` }),
      h(
        'button',
        {
          class: 'picon',
          type: 'button',
          title: "O'chirish",
          'aria-label': `${c.email} kontrollerni o'chirish`,
          on: {
            click: () =>
              confirmAction(
                "Kontrollerni o'chirasizmi?",
                `${c.fullName || c.email} endi tizimga kira olmaydi.`,
                async () => {
                  await api.organizer.deleteController(c.id);
                  toast("Kontroller o'chirildi");
                  await loadControllers();
                },
              ),
          },
        },
        icon('close', 15),
      ),
    ),
    h(
      'div',
      { class: 'ctags' },
      c.controllerEvents.length
        ? c.controllerEvents.map((x) =>
            h(
              'span',
              { class: 'ctag' },
              x.event.title,
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': `${x.event.title} dan ajratish`,
                  on: {
                    click: () =>
                      void api.organizer
                        .unassign(x.id)
                        .then(async () => {
                          toast('Biriktirish olib tashlandi');
                          await loadControllers();
                        })
                        .catch((error) => toast(errorMessage(error))),
                  },
                },
                icon('close', 12),
              ),
            ),
          )
        : h('span', {
            class: 'hint-line',
            text: 'Hali tadbirga biriktirilmagan',
          }),
    ),
    select,
  );
}

function setupControllerForm() {
  const f = /** @type {HTMLFormElement} */ ($('ctrl-form'));
  const name = /** @type {HTMLInputElement} */ ($('c-name'));
  const email = /** @type {HTMLInputElement} */ ($('c-email'));
  const pass = /** @type {HTMLInputElement} */ ($('c-pass'));
  passwordToggle(pass);
  f.addEventListener('input', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.getAttribute('aria-invalid'))
      setFieldError(t, null);
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    setBanner($('ctrl-banner'), null);
    const errs = [
      [name, name.value.trim() ? null : 'Ismni kiriting'],
      [email, v.email(email.value)],
      [pass, v.strongPassword(pass.value)],
    ];
    for (const [el, msg] of errs)
      setFieldError(
        /** @type {HTMLInputElement} */ (el),
        /** @type {string | null} */ (msg),
      );
    const bad = errs.find(([, msg]) => msg);
    if (bad) return /** @type {HTMLInputElement} */ (bad[0]).focus();
    void withBusy(
      /** @type {HTMLButtonElement} */ ($('ctrl-submit')),
      async () => {
        try {
          await api.organizer.createController({
            fullName: name.value.trim(),
            email: email.value.trim(),
            password: pass.value,
          });
          toast(`Kontroller yaratildi: ${email.value.trim()}`);
          f.reset();
          await loadControllers();
        } catch (error) {
          setBanner(
            $('ctrl-banner'),
            error instanceof ApiError &&
              error.status === 400 &&
              /password/i.test(error.message)
              ? "Parol yetarlicha kuchli emas: katta va kichik harf, raqam va belgi bo'lsin"
              : errorMessage(error),
          );
        }
      },
      'Yaratilmoqda…',
    );
  });
}

// ---------- Tasdiqlash oynasi ----------

/** @param {string} title @param {string} sub @param {() => Promise<void>} run */
function confirmAction(title, sub, run) {
  $('cm-title').textContent = title;
  $('cm-sub').textContent = sub;
  setBanner($('cm-banner'), null);
  const close = openModal($('confirm-modal'));
  const ok = /** @type {HTMLButtonElement} */ ($('cm-ok'));
  const cancel = $('cm-cancel');
  const onCancel = () => close();
  const onOk = () =>
    void withBusy(ok, async () => {
      try {
        await run();
        close();
      } catch (error) {
        setBanner($('cm-banner'), errorMessage(error));
      }
    });
  ok.addEventListener('click', onOk);
  cancel.addEventListener('click', onCancel);
  const obs = new MutationObserver(() => {
    if ($('confirm-modal').hidden) {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      obs.disconnect();
    }
  });
  obs.observe($('confirm-modal'), {
    attributes: true,
    attributeFilter: ['hidden'],
  });
}
