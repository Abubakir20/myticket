// @ts-check
// Bitta chipta: katta QR (kirishda Controller skanerlaydi). GET /tickets/:id.

import { api, ApiError } from '../api.js';
import * as fmt from '../format.js';
import { routes, param } from '../routes.js';
import { requireUser } from '../session.js';
import { qrSvg } from '../qr.js';
import { $, h, frag, showLoading, showError, showEmpty } from '../ui.js';

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
  content.replaceChildren(
    frag(
      h(
        'div',
        { class: usable ? 'qrbig' : 'qrbig used' },
        qrSvg(ticket.qrCode, `${session.event.title} chiptasi QR kodi`),
      ),
      h('h2', { text: session.event.title }),
      h(
        'p',
        { class: 'v' },
        `${fmt.dateTime(session.startTime)} · ${session.venue.name}`,
        h('br'),
        fmt.seatLabel(ticket.orderItem.ticketCategory.name, ticket.seat),
      ),
      h('span', {
        class: `status status-${ticket.status}`,
        text: STATUS_LABEL[ticket.status],
      }),
      ticket.status === 'USED' && ticket.usedAt
        ? h('p', {
            class: 'v',
            style: 'margin:12px 0 0',
            text: `Ishlatilgan vaqt: ${fmt.dateTime(ticket.usedAt)}`,
          })
        : null,
      usable
        ? h('p', {
            class: 'code',
            text: ticket.qrCode,
            title: "Kodni qo'lda kiritish uchun",
          })
        : null,
    ),
  );
}
