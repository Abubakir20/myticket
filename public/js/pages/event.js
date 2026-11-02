// @ts-check
// Tadbir sahifasi: kinematografik sarlavha (afisha), tavsif, galereya, seanslar. Ma'lumot: GET /events/:id.

import { api, ApiError, serverNow } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { mountBackBar, mountFooter } from '../shell.js';
import { icon } from '../icons.js';
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

mountBackBar($('topnav'), routes.home(), 'Afisha', 'wrap-md');
mountFooter($('footer'));
$('lightbox-close').append(icon('close', 20));
void load();

async function load() {
  const box = h('div', { class: 'wrap wrap-md' });
  main.replaceChildren(box);
  if (!id) {
    showEmpty(box, "Tadbir ko'rsatilmagan", {
      label: 'Bosh sahifaga',
      href: routes.home(),
    });
    return;
  }
  showLoading(box);
  try {
    render(await api.events.get(id));
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      showEmpty(box, 'Tadbir topilmadi yoki sotuvdan olingan', {
        label: 'Bosh sahifaga',
        href: routes.home(),
      });
      return;
    }
    showError(box, error, load);
  }
}

/** @param {EventDetail} event */
function render(event) {
  document.title = `${event.title} — Chipta`;
  const now = serverNow();
  const upcoming = event.sessions.filter((s) => Date.parse(s.startTime) > now);
  const from = fmt.minPrice(upcoming.flatMap((s) => s.ticketCategories));
  const next = upcoming[0];
  const venues = [...new Set(upcoming.map((s) => s.venue.name))];

  const poster = h(
    'div',
    { class: `eposter ${fallbackClass(event.id)}` },
    posterImage(event.posterUrl, event.title),
    h('span', { class: 'eposter-shine', 'aria-hidden': 'true' }),
  );

  const hero = h(
    'section',
    { class: 'ehero' },
    h(
      'div',
      { class: `ehero-bg ${fallbackClass(event.id)}`, 'aria-hidden': 'true' },
      posterImage(event.posterUrl, ''),
    ),
    h('div', { class: 'ehero-shade', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'wrap wrap-md ehero-in' },
      poster,
      h(
        'div',
        { class: 'ehead' },
        h(
          'div',
          { class: 'echips' },
          event.ageLimit !== null
            ? h('span', { class: 'echip', text: fmt.ageLabel(event.ageLimit) })
            : null,
          h(
            'span',
            { class: 'echip' },
            icon('clock', 14),
            fmt.duration(event.duration),
          ),
          upcoming.length
            ? h(
                'span',
                { class: 'echip' },
                icon('calendar', 14),
                `${upcoming.length} ta seans`,
              )
            : null,
        ),
        h('h1', { text: event.title }),
        h(
          'div',
          { class: 'efacts' },
          next
            ? fact('calendar', 'Eng yaqin seans', fmt.dateTime(next.startTime))
            : null,
          venues.length
            ? fact(
                'pin',
                venues.length > 1 ? 'Zallar' : 'Zal',
                venues.join(', '),
              )
            : null,
          event.organizer.fullName
            ? fact('user', 'Tashkilotchi', event.organizer.fullName)
            : null,
        ),
        h(
          'div',
          { class: 'ecta' },
          upcoming.length
            ? h(
                'a',
                { class: 'btn btn-grad btn-lg', href: '#sessions' },
                icon('ticket', 18),
                'Seans tanlash',
              )
            : h('span', { class: 'badge b-neutral', text: "SEANSLAR YO'Q" }),
          from !== null
            ? h(
                'div',
                { class: 'efrom' },
                h('small', { text: 'Chiptalar narxi' }),
                `${fmt.price(from)} dan`,
              )
            : null,
        ),
      ),
    ),
  );

  const about = h(
    'div',
    { class: 'eabout' },
    h('h2', { class: 'esec-title', text: 'Tadbir haqida' }),
    h('p', { class: 'desc', text: event.description }),
    event.images.length ? gallery(event) : null,
  );

  const sessions = h(
    'aside',
    { class: 'esessions', id: 'sessions', 'aria-labelledby': 'sessions-title' },
    h(
      'div',
      { class: 'sesscard' },
      h(
        'div',
        { class: 'sesshead' },
        h('h2', {
          class: 'esec-title',
          id: 'sessions-title',
          text: 'Seanslar',
        }),
        upcoming.length
          ? h('span', { class: 'muted', text: `${upcoming.length} ta mavjud` })
          : null,
      ),
      event.sessions.length
        ? h(
            'div',
            { class: 'sesslist' },
            event.sessions.map((s) => sessionRow(event, s, now)),
          )
        : h('p', {
            class: 'text-muted sessempty',
            text: "Hozircha seanslar yo'q",
          }),
    ),
  );

  main.replaceChildren(
    hero,
    h('div', { class: 'wrap wrap-md ebody-grid' }, about, sessions),
  );

  // Afisha kursorga qarab og'adi
  if (
    matchMedia('(pointer: fine)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    hero.addEventListener('pointermove', (e) => {
      const r = poster.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      poster.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
      poster.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => {
      poster.style.setProperty('--ry', '0deg');
      poster.style.setProperty('--rx', '0deg');
    });
  }
}

/** @param {string} ic @param {string} label @param {string} value */
function fact(ic, label, value) {
  return h(
    'div',
    { class: 'efact' },
    h('span', { class: 'efact-ic' }, icon(ic, 18)),
    h('div', null, h('small', { text: label }), h('b', { text: value })),
  );
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
  const from = fmt.minPrice(session.ticketCategories);

  const body = [
    h(
      'div',
      { class: 'sdate', 'aria-hidden': 'true' },
      h('b', { text: String(Number(d)) }),
      h('span', { text: m.slice(0, 3) }),
    ),
    h(
      'div',
      { class: 'sinfo' },
      h(
        'div',
        { class: 't' },
        h('span', { text: fmt.time(session.startTime) }),
        h('span', { class: 'wd', text: fmt.weekday(session.startTime) }),
      ),
      h('div', { class: 'v', text: session.venue.name }),
      h(
        'div',
        { class: 'stags' },
        past
          ? h('span', { class: 'stag off', text: "O'tib ketgan" })
          : h(
              'span',
              { class: seated ? 'stag' : 'stag general' },
              icon(seated ? 'cube' : 'ticket', 12),
              seated ? '3D zal · joy tanlash' : 'Umumiy kirish',
            ),
        !past && from !== null
          ? h('span', { class: 'sfrom', text: `${fmt.price(from)} dan` })
          : null,
      ),
    ),
    h('span', { class: 'sgo', 'aria-hidden': 'true' }, icon('arrow-right', 18)),
  ];

  if (past)
    return h('div', { class: 'sess off', 'aria-disabled': 'true' }, body);
  return h(
    'a',
    {
      class: 'sess',
      href,
      'aria-label': `Chipta olish: ${fmt.dateTime(session.startTime)}, ${session.venue.name}`,
    },
    body,
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
    { class: 'egallery', 'aria-label': 'Fotogalereya' },
    h('h2', { class: 'esec-title', text: 'Fotogalereya' }),
    h(
      'div',
      { class: `gal n${Math.min(event.images.length, 4)}` },
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
