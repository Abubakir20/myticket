// @ts-check
// Kontroller: biriktirilgan tadbirlar ro'yxati (dizayn 4a). GET /check-in/events.

import { api } from '../api.js';
import * as fmt from '../format.js';
import { routes } from '../routes.js';
import { currentOrNextSession } from '../schedule.js';
import { requireUser, logout } from '../session.js';
import { themeButton } from '../shell.js';
import {
  $,
  h,
  showLoading,
  showError,
  showEmpty,
  fallbackClass,
  posterImage,
} from '../ui.js';

/** @typedef {import('../types.js').ControllerEvent} ControllerEvent */

const content = $('content');
const logoutButton = h('button', {
  class: 'btn btn-secondary',
  type: 'button',
  text: 'Chiqish',
  style: 'min-height:34px;font-size:12.5px',
  on: { click: () => void logout() },
});
$('actions').append(themeButton(), logoutButton);

void load();

async function load() {
  await requireUser(['CONTROLLER']);
  showLoading(content);
  let events;
  try {
    events = await api.checkIn.events();
  } catch (error) {
    showError(content, error, load);
    return;
  }
  if (!events.length) {
    showEmpty(
      content,
      'Sizga hali tadbir biriktirilmagan. Tashkilotchiga murojaat qiling.',
    );
    return;
  }
  content.replaceChildren(...events.map(eventRow));
}

/** @param {ControllerEvent} event */
function eventRow(event) {
  const session = currentOrNextSession(event.sessions);
  return h(
    'div',
    { class: 'evrow' },
    h(
      'div',
      { class: `evposter ${fallbackClass(event.id)}` },
      posterImage(event.posterUrl, ''),
    ),
    h(
      'div',
      { class: 'evinfo' },
      h('div', { class: 't', text: event.title }),
      h('div', {
        class: 'v',
        text: session
          ? `${fmt.dateTime(session.startTime)} · ${session.venue.name}`
          : "Faol seans yo'q",
      }),
    ),
    h('a', {
      class: 'btn btn-secondary',
      href: routes.scan(event.id),
      text: 'Skanerlash',
      'aria-label': `${event.title}: skanerlash`,
    }),
  );
}
