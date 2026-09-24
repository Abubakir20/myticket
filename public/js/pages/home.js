// @ts-check
// Bosh sahifa: eng yaqin tadbir (hero), tadbirlar to'ri va sahifalash. Ma'lumot: GET /events, GET /events/:id.

import { api } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { mountNav, mountFooter } from '../shell.js';
import {
  $,
  h,
  showEmpty,
  showError,
  fallbackClass,
  posterImage,
} from '../ui.js';

/** @typedef {import('../types.js').EventListItem} EventListItem */
/** @typedef {import('../types.js').PageMeta} PageMeta */

const PAGE_SIZE = 12;

const heroEl = $('hero');
const listEl = $('events');
const pagerEl = $('pager');

void mountNav($('topnav'), 'home');
mountFooter($('footer'));
void load();

async function load() {
  const page = Math.max(1, Number(param('page')) || 1);
  renderSkeleton(page === 1);
  pagerEl.replaceChildren();

  let result;
  try {
    result = await api.events.list(page, PAGE_SIZE);
  } catch (error) {
    heroEl.replaceChildren();
    showError(listEl, error, load);
    return;
  }

  const { items, meta } = result;
  if (!items.length && meta.total > 0) {
    location.replace(routes.home(meta.totalPages)); // mavjud bo'lmagan sahifa
    return;
  }
  if (!items.length) {
    heroEl.replaceChildren();
    showEmpty(
      listEl,
      "Hozircha sotuvdagi tadbirlar yo'q. Tez orada qaytib ko'ring.",
    );
    return;
  }

  listEl.replaceChildren(h('div', { class: 'grid' }, items.map(eventCard)));
  renderPager(meta);
  if (page === 1) void renderHero(items);
  else heroEl.replaceChildren();
}

/** @param {boolean} withHero */
function renderSkeleton(withHero) {
  heroEl.replaceChildren(
    withHero ? h('div', { class: 'hero skeleton', 'aria-hidden': 'true' }) : '',
  );
  listEl.replaceChildren(
    h(
      'div',
      {
        class: 'grid',
        'aria-busy': 'true',
        'aria-label': 'Tadbirlar yuklanmoqda',
      },
      Array.from({ length: 4 }, () => h('div', { class: 'ecard skeleton' })),
    ),
  );
}

/** @param {EventListItem} event */
function eventCard(event) {
  const when = event.nextSessionAt
    ? fmt.dateTime(event.nextSessionAt)
    : 'Seanslar tez kunda';
  return h(
    'a',
    { class: 'ecard', href: routes.event(event.id) },
    h(
      'div',
      { class: `poster ${fallbackClass(event.id)}` },
      posterImage(event.posterUrl, ''),
      event.ageLimit !== null
        ? h('span', { class: 'agebadge', text: fmt.ageLabel(event.ageLimit) })
        : null,
      h('h5', { text: event.title }),
    ),
    h(
      'div',
      { class: 'ebody' },
      h(
        'div',
        { class: 'emeta' },
        h('span', { text: when }),
        h('span', { text: '·', 'aria-hidden': 'true' }),
        h('span', { text: fmt.duration(event.duration) }),
      ),
      h('div', { class: 'eprice', text: 'Chipta olish →' }),
    ),
  );
}

/**
 * Hero — seansi eng yaqin tadbir. Zal va narx ro'yxat javobida yo'q, shuning uchun
 * faqat shu bitta tadbirning tafsiloti so'raladi.
 * @param {EventListItem[]} items
 */
async function renderHero(items) {
  const upcoming = items
    .filter((e) => e.nextSessionAt)
    .sort(
      (a, b) =>
        Date.parse(/** @type {string} */ (a.nextSessionAt)) -
        Date.parse(/** @type {string} */ (b.nextSessionAt)),
    );
  const pick = upcoming[0];
  if (!pick) {
    heroEl.replaceChildren();
    return;
  }

  let detail = null;
  try {
    detail = await api.events.get(pick.id);
  } catch {
    // Tafsilot kelmasa ham hero ro'yxatdagi ma'lumot bilan chiziladi
  }
  const session = detail?.sessions.find(
    (s) => s.startTime === pick.nextSessionAt,
  );
  const from = detail
    ? fmt.minPrice(
        detail.sessions
          .filter((s) => Date.parse(s.startTime) > Date.now())
          .flatMap((s) => s.ticketCategories),
      )
    : null;

  heroEl.replaceChildren(
    h(
      'div',
      { class: 'hero' },
      h('div', { class: 'blob1', 'aria-hidden': 'true' }),
      h('div', { class: 'blob2', 'aria-hidden': 'true' }),
      h('p', { class: 'hero-kicker', text: 'Eng yaqin tadbir' }),
      h('h1', { text: pick.title }),
      h(
        'div',
        { class: 'hero-meta' },
        h('span', {
          text: `📅 ${fmt.dateTime(/** @type {string} */ (pick.nextSessionAt))}`,
        }),
        session
          ? h('span', {
              text: `📍 ${session.venue.name}, ${session.venue.address}`,
            })
          : null,
      ),
      h(
        'div',
        { class: 'hero-cta' },
        h('a', {
          class: 'btn btn-primary btn-lg',
          href: routes.event(pick.id),
          text: 'Chipta olish',
        }),
        from !== null ? h('span', { text: `${fmt.price(from)} dan` }) : null,
      ),
    ),
  );
}

/** @param {PageMeta} meta */
function renderPager({ page, totalPages }) {
  if (totalPages <= 1) return;
  /** @param {string} label @param {number} target @param {string} [aria] */
  const link = (label, target, aria) => {
    const disabled = target < 1 || target > totalPages;
    return h('a', {
      class: 'pgbtn',
      text: label,
      href: disabled ? null : routes.home(target),
      'aria-label': aria ?? `${target}-sahifa`,
      'aria-current': target === page && !aria ? 'page' : null,
      'aria-disabled': disabled ? 'true' : null,
    });
  };
  // Ko'p sahifa bo'lsa: 1 … joriy atrofi … oxirgi
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  /** @type {HTMLElement[]} */
  const nodes = [link('‹', page - 1, 'Oldingi sahifa')];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1)
      nodes.push(
        h('span', { class: 'pgbtn', text: '…', 'aria-hidden': 'true' }),
      );
    nodes.push(link(String(p), p));
  });
  nodes.push(link('›', page + 1, 'Keyingi sahifa'));
  pagerEl.replaceChildren(...nodes);
}
