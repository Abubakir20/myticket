// @ts-check
// Mening chiptalarim: holat bo'yicha tablar (Aktiv / Ishlatilgan / Bekor qilingan). GET /tickets/me.

import { api } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { requireUser, BUYER_ROLES } from '../session.js';
import { mountNav, mountFooter } from '../shell.js';
import { qrSvg } from '../qr.js';
import {
  $,
  h,
  showLoading,
  showError,
  fallbackClass,
  posterImage,
} from '../ui.js';

/** @typedef {import('../types.js').Ticket} Ticket */
/** @typedef {import('../types.js').TicketStatus} TicketStatus */

/** @type {{ key: TicketStatus, label: string, empty: string }[]} */
const TABS = [
  { key: 'ACTIVE', label: 'Aktiv', empty: "Aktiv chiptalar yo'q" },
  { key: 'USED', label: 'Ishlatilgan', empty: "Ishlatilgan chiptalar yo'q" },
  {
    key: 'CANCELLED',
    label: 'Bekor qilingan',
    empty: "Bekor qilingan chiptalar yo'q",
  },
];

const tabsEl = $('tabs');
const content = $('content');
void mountNav($('topnav'), 'tickets');
mountFooter($('footer'));

/** @type {Ticket[]} */
let tickets = [];
/** @type {TicketStatus} */
let active = /** @type {TicketStatus} */ (
  TABS.find((t) => t.key === param('tab'))?.key ?? 'ACTIVE'
);

void load();

async function load() {
  await requireUser(BUYER_ROLES);
  showLoading(content);
  try {
    tickets = await api.tickets.mine();
  } catch (error) {
    showError(content, error, load);
    return;
  }
  renderTabs();
  renderList();
}

function renderTabs() {
  const buttons = TABS.map((tab) => {
    const count = tickets.filter((t) => t.status === tab.key).length;
    return h(
      'button',
      {
        class: 'tab',
        type: 'button',
        role: 'tab',
        id: `tab-${tab.key}`,
        'aria-selected': String(tab.key === active),
        tabindex: tab.key === active ? '0' : '-1',
        'aria-controls': 'content',
        on: { click: () => select(tab.key) },
      },
      tab.label,
      count ? h('span', { class: 'count', text: String(count) }) : null,
    );
  });
  // Tablar orasida o'q tugmalari bilan yurish (WAI-ARIA tabs)
  tabsEl.onkeydown = (event) => {
    const index = TABS.findIndex((t) => t.key === active);
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length].key;
    select(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  tabsEl.replaceChildren(...buttons);
  content.setAttribute('aria-labelledby', `tab-${active}`);
}

/** @param {TicketStatus} key */
function select(key) {
  active = key;
  const url = new URL(location.href);
  url.searchParams.set('tab', key);
  history.replaceState(null, '', url);
  renderTabs();
  renderList();
}

function renderList() {
  const list = tickets.filter((t) => t.status === active);
  if (!list.length) {
    const tab = /** @type {typeof TABS[number]} */ (
      TABS.find((t) => t.key === active)
    );
    content.replaceChildren(
      h(
        'div',
        { class: 'state' },
        h('p', { text: tab.empty }),
        active === 'ACTIVE'
          ? h('a', {
              class: 'btn btn-secondary',
              href: routes.home(),
              text: "Tadbirlarni ko'rish",
            })
          : null,
      ),
    );
    return;
  }
  const PAGE = 20;
  let shown = Math.min(PAGE, list.length);
  content.replaceChildren(...list.slice(0, shown).map(ticketCard));
  if (shown < list.length) {
    const more = h('button', { class: 'btn btn-secondary', type: 'button' });
    const wrap = h('div', { class: 'more' }, more);
    const label = () => {
      more.textContent = `Yana ko'rsatish (${shown} / ${list.length})`;
    };
    label();
    more.addEventListener('click', () => {
      const next = list.slice(shown, shown + PAGE);
      shown += next.length;
      wrap.before(...next.map(ticketCard));
      if (shown >= list.length) wrap.remove();
      else label();
    });
    content.append(wrap);
  }
}

/** @param {Ticket} ticket */
function ticketCard(ticket) {
  const { session } = ticket;
  const seat = fmt.seatLabel(ticket.orderItem.ticketCategory.name, ticket.seat);
  return h(
    'a',
    {
      class: ticket.status === 'ACTIVE' ? 'tcard' : 'tcard dim',
      href: routes.ticket(ticket.id),
      'aria-label': `${session.event.title}, ${fmt.dateTime(session.startTime)}, ${seat}`,
    },
    h(
      'div',
      { class: `tposter ${fallbackClass(session.event.id)}` },
      posterImage(session.event.posterUrl, ''),
    ),
    h(
      'div',
      { class: 'tinfo' },
      h('div', { class: 't', text: session.event.title }),
      h(
        'div',
        { class: 'v' },
        `${fmt.dateTime(session.startTime)} · ${session.venue.name}`,
        h('br'),
        seat,
      ),
      ticket.status === 'USED'
        ? h('span', { class: 'badge b-neutral', text: 'ISHLATILGAN' })
        : null,
      ticket.status === 'CANCELLED'
        ? h('span', { class: 'badge b-err', text: 'BEKOR QILINGAN' })
        : null,
    ),
    h(
      'div',
      { class: 'qr', 'aria-hidden': 'true' },
      qrSvg(ticket.qrCode, 'QR kod', 1),
    ),
  );
}
