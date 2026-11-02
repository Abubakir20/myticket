// @ts-check
// Bitta chipta: katta QR (kirishda Controller skanerlaydi). GET /tickets/:id.

import { api, ApiError } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { requireUser } from '../session.js';
import { qrSvg } from '../qr.js';
import {
  $,
  h,
  frag,
  showLoading,
  showError,
  showEmpty,
  fallbackClass,
  posterImage,
} from '../ui.js';
import { icon, logoMark } from '../icons.js';

$('back').append(icon('arrow-left', 20));

/** @typedef {import('../types.js').Ticket} Ticket */

const STATUS_LABEL = {
  ACTIVE: 'AKTIV',
  USED: 'ISHLATILGAN',
  CANCELLED: 'BEKOR QILINGAN',
};

const content = $('content');
const id = param('id');
void load();

async function load() {
  await requireUser(['CUSTOMER']);
  if (!id) {
    showEmpty(content, "Chipta ko'rsatilmagan", {
      label: 'Chiptalarim',
      href: routes.tickets(),
    });
    return;
  }
  showLoading(content);
  try {
    render(await api.tickets.get(id));
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      showEmpty(content, 'Chipta topilmadi', {
        label: 'Chiptalarim',
        href: routes.tickets(),
      });
      return;
    }
    showError(content, error, load);
  }
}

/** @param {Ticket} ticket */
function render(ticket) {
  const { session } = ticket;
  document.title = `${session.event.title} — chipta`;
  const usable = ticket.status === 'ACTIVE';
  const seat = ticket.seat;
  /** @param {string} k @param {string} v @param {string} [cls] */
  const cell = (k, v, cls = '') =>
    h(
      'div',
      { class: `tcell ${cls}` },
      h('small', { text: k }),
      h('b', { text: v }),
    );

  content.replaceChildren(
    h(
      'article',
      { class: `ticket ${usable ? '' : 'is-off'}` },
      h(
        'div',
        { class: `t-top ${fallbackClass(session.event.id)}` },
        posterImage(session.event.posterUrl, ''),
        h('div', { class: 't-shade', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: 't-topbar' },
          h('span', { class: 't-brand' }, logoMark(), 'Chipta'),
          h('span', {
            class: `status status-${ticket.status}`,
            text: STATUS_LABEL[ticket.status],
          }),
        ),
        h('h1', { text: session.event.title }),
      ),
      h(
        'div',
        { class: 't-details' },
        cell(
          'Sana',
          `${fmt.weekday(session.startTime)}, ${fmt.day(session.startTime)}`,
          'span2',
        ),
        cell('Boshlanish', fmt.time(session.startTime)),
        cell('Zal', session.venue.name, 'wide'),
        seat
          ? frag(
              cell('Sektor', seat.row.sector.name),
              cell('Qator', String(seat.row.number)),
              cell("O'rin", String(seat.number)),
            )
          : cell('Toifa', ticket.orderItem.ticketCategory.name, 'wide'),
        cell('Narx', fmt.price(ticket.orderItem.price), 'wide'),
      ),
      h('div', { class: 't-perf', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 't-qrbox' },
        h(
          'div',
          { class: usable ? 'qrbig' : 'qrbig used' },
          qrSvg(ticket.qrCode, `${session.event.title} chiptasi QR kodi`),
        ),
        usable
          ? h('p', {
              class: 't-hint',
              text: "Kirishda shu QR kodni kontrollerga ko'rsating",
            })
          : ticket.status === 'USED' && ticket.usedAt
            ? h('p', {
                class: 't-hint',
                text: `Ishlatilgan: ${fmt.dateTime(ticket.usedAt)}`,
              })
            : h('p', { class: 't-hint', text: 'Bu chipta bekor qilingan' }),
        usable
          ? h('p', {
              class: 'code',
              text: ticket.qrCode,
              title: "Kodni qo'lda kiritish uchun",
            })
          : null,
      ),
    ),
  );
}
