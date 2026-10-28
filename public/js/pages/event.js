// @ts-check
// Tadbir sahifasi: afisha, tavsif, galereya, seanslar. Ma'lumot: GET /events/:id.

import { api, ApiError, serverNow } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { mountBackBar } from '../shell.js';
import {
  $,
  h,
  showLoading,
  showError,
  showEmpty,
  fallbackClass,
  posterImage,
  openModal,
} from '../ui.js';

/** @typedef {import('../types.js').EventDetail} EventDetail */
/** @typedef {import('../types.js').EventSession} EventSession */

const main = $('main');
const id = param('id');

mountBackBar($('topnav'), routes.home(), 'Bosh sahifaga', 'wrap-md');
void load();

async function load() {
  if (!id) {
    showEmpty(main, "Tadbir ko'rsatilmagan", {
      label: 'Bosh sahifaga',
      href: routes.home(),
    });
    return;
  }
  showLoading(main);
  try {
    render(await api.events.get(id));
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      showEmpty(main, 'Tadbir topilmadi yoki sotuvdan olingan', {
        label: 'Bosh sahifaga',
        href: routes.home(),
      });
      return;
    }
    showError(main, error, load);
  }
}

/** @param {EventDetail} event */
function render(event) {
  document.title = `${event.title} — Chipta`;
  const now = serverNow();
  const upcoming = event.sessions.filter((s) => Date.parse(s.startTime) > now);
  const from = fmt.minPrice(upcoming.flatMap((s) => s.ticketCategories));

  const hero = h(
    'div',
    { class: `ehero ${fallbackClass(event.id)}` },
    posterImage(event.posterUrl, ''),
    h('div', { class: 'blob', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'kicker' },
      event.ageLimit !== null
        ? h('span', { class: 'kchip', text: fmt.ageLabel(event.ageLimit) })
        : null,
      h('span', { class: 'kchip', text: fmt.duration(event.duration) }),
    ),
    h('h1', { text: event.title }),
  );

  const facts = h(
    'aside',
    { class: 'stickycard', 'aria-label': "Qisqacha ma'lumot" },
    h(
      'div',
      { class: 'ecard-box' },
      h(
        'div',
        { class: 'metaRow' },
        h(
          'div',
          null,
          h('span', { text: 'Yosh chegarasi' }),
          h('b', { text: fmt.ageLabel(event.ageLimit) }),
        ),
        h(
          'div',
          null,
          h('span', { text: 'Davomiyligi' }),
          h('b', { text: fmt.duration(event.duration) }),
        ),
        h(
          'div',
          null,
          h('span', { text: "Boshlang'ich narx" }),
          h('b', { text: from !== null ? fmt.price(from) : '—' }),
        ),
        event.organizer.fullName
          ? h(
              'div',
              null,
              h('span', { text: 'Tashkilotchi' }),
              h('b', { text: event.organizer.fullName }),
            )
          : null,
      ),
    ),
  );

  const content = h(
    'div',
    null,
    h('p', { class: 'desc', text: event.description }),
    event.images.length ? gallery(event) : null,
    h('h4', { style: 'margin:0 0 6px', text: 'Seanslar' }),
    event.sessions.length
      ? h(
          'div',
          { class: 'ecard-box sessions' },
          event.sessions.map((s) => sessionRow(event, s, now)),
        )
      : h(
          'div',
          { class: 'ecard-box' },
          h('p', {
            class: 'text-muted',
            style: 'margin:0',
            text: "Hozircha seanslar yo'q",
          }),
        ),
  );

  main.replaceChildren(hero, h('div', { class: 'grid2' }, content, facts));
}

/**
 * @param {EventDetail} event
 * @param {EventSession} session
 * @param {number} now
 */
function sessionRow(event, session, now) {
  const { d, m } = fmt.dayMonth(session.startTime);
  const past = Date.parse(session.startTime) <= now;
  const seated = session.seatingType === 'SEATED';
  const href = seated
    ? routes.seats(session.id, event.id)
    : routes.categories(session.id, event.id);
  const label = `${fmt.dateTime(session.startTime)}, ${session.venue.name}`;

  const info = h(
    'div',
    { class: 'sinfo' },
    h('div', {
      class: 't',
      text: `${fmt.time(session.startTime)} · ${session.venue.name}`,
    }),
    h('div', { class: 'v', text: session.venue.address }),
    past
      ? h('span', {
          class: 'badge b-neutral',
          style: 'margin-top:6px',
          text: "O'TIB KETGAN",
        })
      : h('span', {
          class: seated ? 'stag' : 'stag stag-general',
          text: seated ? "O'RINDIQLI" : 'UMUMIY',
        }),
  );
  const date = h(
    'div',
    { class: 'sdate', 'aria-hidden': 'true' },
    h('div', { class: 'd', text: d }),
    h('div', { class: 'm', text: m }),
  );

  if (past) {
    return h(
      'div',
      { class: 'sess off' },
      date,
      info,
      h('button', {
        class: 'btn btn-secondary',
        type: 'button',
        disabled: true,
        text: 'Chipta olish',
      }),
    );
  }
  return h(
    'div',
    { class: 'sess' },
    date,
    info,
    h('a', {
      class: 'btn btn-primary',
      href,
      text: 'Chipta olish',
      'aria-label': `Chipta olish: ${label}`,
    }),
  );
}

/** @param {EventDetail} event */
function gallery(event) {
  const lightbox = $('lightbox');
  const lightboxImg = /** @type {HTMLImageElement} */ ($('lightbox-img'));
  /** @type {(() => void) | null} */
  let close = null;
  $('lightbox-close').addEventListener('click', () => close?.());

  return h(
    'section',
    { 'aria-label': 'Fotogalereya' },
    h('h4', { style: 'margin:0 0 14px', text: 'Fotogalereya' }),
    h(
      'div',
      { class: 'gal' },
      event.images.map((image, i) =>
        h(
          'button',
          {
            class: `gph ${fallbackClass(image.id)}`,
            type: 'button',
            'aria-label': `${i + 1}-rasmni kattalashtirish`,
            on: {
              click: () => {
                lightboxImg.src = image.url;
                lightboxImg.alt = `${event.title} — ${i + 1}-rasm`;
                close = openModal(lightbox);
              },
            },
          },
          h('img', { src: image.url, alt: '', loading: 'lazy' }),
        ),
      ),
    ),
  );
}
