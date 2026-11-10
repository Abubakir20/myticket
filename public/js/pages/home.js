// @ts-check
// Bosh sahifa: aylanuvchi hero (eng yaqin tadbirlar), qidiruv/sana filtri, afisha to'ri va sahifalash.
// Ma'lumot: GET /events.

import { api } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { mountNav, mountFooter } from '../shell.js';
import { icon } from '../icons.js';
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
const HERO_COUNT = 5;
const HERO_INTERVAL = 7000;

const heroEl = $('hero');
const listEl = $('events');
const pagerEl = $('pager');
const searchInput = /** @type {HTMLInputElement} */ ($('search'));
const whenEl = $('when');

const WHEN = [
  ['all', 'Hammasi'],
  ['today', 'Bugun'],
  ['week', 'Shu hafta'],
  ['month', 'Shu oy'],
];

/** @type {EventListItem[]} */
let items = [];
const filter = { text: '', when: 'all' };

for (const el of document.querySelectorAll('[data-icon]')) {
  el.append(icon(/** @type {HTMLElement} */ (el).dataset.icon ?? '', 20));
}

void mountNav($('topnav'), 'home');
mountFooter($('footer'));
setupFilters();
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

  const { meta } = result;
  items = result.items;
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

  renderList();
  renderPager(meta);
  if (page === 1) renderHero(items);
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
      Array.from({ length: 8 }, () =>
        h(
          'div',
          { class: 'ecard is-skeleton', 'aria-hidden': 'true' },
          h('div', { class: 'poster skeleton' }),
          h('div', { class: 'sk-line skeleton' }),
          h('div', { class: 'sk-line short skeleton' }),
        ),
      ),
    ),
  );
}

// ---------- Filtr ----------

function setupFilters() {
  whenEl.replaceChildren(
    ...WHEN.map(([key, label]) =>
      h('button', {
        class: 'chip',
        type: 'button',
        text: label,
        'aria-pressed': String(key === filter.when),
        dataset: { key },
        on: {
          click: () => {
            filter.when = key;
            for (const chip of whenEl.children)
              chip.setAttribute(
                'aria-pressed',
                String(/** @type {HTMLElement} */ (chip).dataset.key === key),
              );
            renderList();
          },
        },
      }),
    ),
  );
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      filter.text = searchInput.value.trim().toLowerCase();
      renderList();
    }, 150);
  });
}

/** @param {EventListItem} event */
function matches(event) {
  if (filter.text) {
    const hay = `${event.title} ${event.venueName ?? ''}`.toLowerCase();
    if (!hay.includes(filter.text)) return false;
  }
  if (filter.when === 'all') return true;
  if (!event.nextSessionAt) return false;
  const at = new Date(event.nextSessionAt);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = { today: 1, week: 7, month: 31 }[filter.when] ?? 0;
  const end = new Date(startOfDay.getTime() + days * 86400000);
  return at >= now && at < end;
}

function renderList() {
  if (!items.length) return;
  const shown = items.filter(matches);
  if (!shown.length) {
    showEmpty(
      listEl,
      filter.text
        ? `"${searchInput.value.trim()}" bo'yicha tadbir topilmadi.`
        : "Bu davrda tadbir yo'q. Boshqa sanani tanlab ko'ring.",
      {
        label: 'Filtrni tozalash',
        onClick: () => {
          searchInput.value = '';
          filter.text = '';
          /** @type {HTMLButtonElement | null} */ (
            whenEl.querySelector('[data-key="all"]')
          )?.click();
          renderList();
        },
      },
    );
    return;
  }
  listEl.replaceChildren(
    h(
      'div',
      { class: 'grid' },
      shown.map((event, i) => eventCard(event, i)),
    ),
  );
}

// ---------- Kartochka ----------

/** @param {EventListItem} event @param {number} index */
function eventCard(event, index) {
  const when = event.nextSessionAt
    ? fmt.dateTime(event.nextSessionAt)
    : 'Seanslar tez kunda';
  const price =
    event.minPrice !== null && event.minPrice !== undefined
      ? fmt.price(event.minPrice)
      : null;
  const date = event.nextSessionAt ? fmt.dayMonth(event.nextSessionAt) : null;

  return h(
    'a',
    {
      class: 'ecard',
      href: routes.event(event.id),
      style: `--i:${Math.min(index, 11)}`,
      'aria-label': `${event.title}, ${when}${price ? `, ${price} dan` : ''}`,
    },
    h(
      'div',
      { class: `poster ${fallbackClass(event.id)}` },
      posterImage(event.posterUrl, ''),
      date
        ? h(
            'div',
            { class: 'datechip', 'aria-hidden': 'true' },
            h('b', { text: String(Number(date.d)) }),
            h('span', { text: date.m.slice(0, 3) }),
          )
        : null,
      event.ageLimit !== null
        ? h('span', { class: 'agebadge', text: fmt.ageLabel(event.ageLimit) })
        : null,
      h(
        'span',
        { class: 'poster-cta', 'aria-hidden': 'true' },
        'Chipta olish',
        icon('arrow-right', 16),
      ),
    ),
    h(
      'div',
      { class: 'ebody' },
      h('h3', { class: 'etitle', text: event.title }),
      h(
        'div',
        { class: 'emeta' },
        icon('clock', 14),
        h('span', {
          text: event.nextSessionAt
            ? `${fmt.time(event.nextSessionAt)} · ${fmt.duration(event.duration)}`
            : 'Seanslar tez kunda',
        }),
      ),
      event.venueName
        ? h(
            'div',
            { class: 'emeta' },
            icon('pin', 14),
            h('span', { class: 'evenue', text: event.venueName }),
          )
        : null,
      h(
        'div',
        { class: 'efoot' },
        price
          ? h('span', { class: 'eprice' }, h('small', { text: 'dan ' }), price)
          : h('span', { class: 'eprice muted', text: 'Tez orada' }),
      ),
    ),
  );
}

// ---------- Hero ----------

/** @type {(() => void) | null} */
let stopHero = null;

/**
 * Seansi eng yaqin tadbirlar navbatma-navbat ko'rsatiladi.
 * @param {EventListItem[]} list
 */
function renderHero(list) {
  stopHero?.();
  const picks = list
    .filter((e) => e.nextSessionAt)
    .sort(
      (a, b) =>
        Date.parse(/** @type {string} */ (a.nextSessionAt)) -
        Date.parse(/** @type {string} */ (b.nextSessionAt)),
    )
    .slice(0, HERO_COUNT);
  if (!picks.length) {
    heroEl.replaceChildren();
    return;
  }

  const slides = picks.map((pick, i) => heroSlide(pick, i === 0));
  const dots = picks.map((pick, i) =>
    h(
      'button',
      {
        class: 'hdot',
        type: 'button',
        'aria-label': `${i + 1}-tadbir: ${pick.title}`,
        'aria-current': i === 0 ? 'true' : null,
        on: { click: () => show(i, true) },
      },
      h('span', { class: 'hdot-fill' }),
    ),
  );
  const hero = h(
    'div',
    { class: 'hero', 'aria-roledescription': 'karusel' },
    slides,
    picks.length > 1 ? h('div', { class: 'hdots' }, dots) : null,
  );
  heroEl.replaceChildren(hero);

  let current = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @param {number} next @param {boolean} [manual] */
  function show(next, manual = false) {
    slides[current].classList.remove('active');
    slides[current].setAttribute('aria-hidden', 'true');
    slides[current].inert = true;
    dots[current]?.removeAttribute('aria-current');
    current = (next + slides.length) % slides.length;
    slides[current].classList.add('active');
    slides[current].removeAttribute('aria-hidden');
    slides[current].inert = false;
    dots[current]?.setAttribute('aria-current', 'true');
    schedule(manual);
  }
  /** @param {boolean} [manual] */
  function schedule(manual = false) {
    clearTimeout(timer);
    if (reduced || slides.length < 2) return;
    hero.style.setProperty('--hero-ms', `${HERO_INTERVAL}ms`);
    hero.classList.remove('run');
    void hero.offsetWidth; // progress animatsiyasini qayta boshlash
    hero.classList.add('run');
    timer = setTimeout(
      () => show(current + 1),
      manual ? HERO_INTERVAL * 1.5 : HERO_INTERVAL,
    );
  }
  hero.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    hero.classList.add('paused');
  });
  hero.addEventListener('mouseleave', () => {
    hero.classList.remove('paused');
    schedule();
  });
  schedule();
  stopHero = () => clearTimeout(timer);

  // Afisha kursorga qarab biroz og'adi (3D effekt)
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      hero.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
      hero.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--rx', '0deg');
      hero.style.setProperty('--ry', '0deg');
    });
  }
}

/** @param {EventListItem} pick @param {boolean} active */
function heroSlide(pick, active) {
  const at = /** @type {string} */ (pick.nextSessionAt);
  const slide = h(
    'article',
    {
      class: `hslide${active ? ' active' : ''}`,
      'aria-hidden': active ? null : 'true',
    },
    h(
      'div',
      { class: `hbg ${fallbackClass(pick.id)}`, 'aria-hidden': 'true' },
      posterImage(pick.posterUrl, ''),
    ),
    h('div', { class: 'hshade', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'hcontent' },
      h(
        'div',
        { class: 'htext' },
        h(
          'div',
          { class: 'hkicker' },
          h('span', { class: 'live-dot', 'aria-hidden': 'true' }),
          `Eng yaqin · ${fmt.relativeDateTime(at)}`,
        ),
        h('h1', { text: pick.title }),
        h(
          'div',
          { class: 'hmeta' },
          h('span', null, icon('calendar', 16), fmt.dateTime(at)),
          pick.venueName
            ? h('span', null, icon('pin', 16), pick.venueName)
            : null,
          pick.ageLimit !== null
            ? h('span', null, icon('user', 16), fmt.ageLabel(pick.ageLimit))
            : null,
        ),
        h(
          'div',
          { class: 'hcta' },
          h(
            'a',
            { class: 'btn btn-grad btn-lg', href: routes.event(pick.id) },
            icon('ticket', 18),
            'Chipta olish',
          ),
          pick.minPrice !== null && pick.minPrice !== undefined
            ? h(
                'span',
                { class: 'hprice' },
                h('small', { text: 'narxi' }),
                `${fmt.price(pick.minPrice)} dan`,
              )
            : null,
        ),
      ),
      h(
        'a',
        {
          class: `hposter ${fallbackClass(pick.id)}`,
          href: routes.event(pick.id),
          tabindex: '-1',
          'aria-hidden': 'true',
        },
        posterImage(pick.posterUrl, ''),
        h('span', { class: 'hposter-shine' }),
      ),
    ),
  );
  if (!active) slide.inert = true;
  return slide;
}

// ---------- Sahifalash ----------

/** @param {PageMeta} meta */
function renderPager({ page, totalPages }) {
  if (totalPages <= 1) return;
  /** @param {string | Node} label @param {number} target @param {string} [aria] */
  const link = (label, target, aria) => {
    const disabled = target < 1 || target > totalPages;
    return h(
      'a',
      {
        class: 'pgbtn',
        href: disabled ? null : routes.home(target),
        'aria-label': aria ?? `${target}-sahifa`,
        'aria-current': target === page && !aria ? 'page' : null,
        'aria-disabled': disabled ? 'true' : null,
      },
      label,
    );
  };
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  /** @type {HTMLElement[]} */
  const nodes = [link(icon('arrow-left', 16), page - 1, 'Oldingi sahifa')];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1)
      nodes.push(
        h('span', { class: 'pgbtn gap', text: '…', 'aria-hidden': 'true' }),
      );
    nodes.push(link(String(p), p));
  });
  nodes.push(link(icon('arrow-right', 16), page + 1, 'Keyingi sahifa'));
  pagerEl.replaceChildren(...nodes);
}
