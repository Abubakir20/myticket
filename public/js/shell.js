// @ts-check
// Sayt karkasi: yuqori navigatsiya (dizayn: Chipta Home .topnav), mavzu tugmasi, footer.

import { h } from './ui.js';
import { routes } from './routes.js';
import { getUser, isAdmin, logout } from './session.js';

/** @typedef {'home' | 'tickets' | 'orders' | 'profile' | 'admin' | null} NavKey */

const THEME_KEY = 'chipta:theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';
}

/** @param {HTMLButtonElement} button */
function syncThemeButton(button) {
  const dark = currentTheme() === 'dark';
  button.textContent = dark ? '☀' : '☾';
  button.setAttribute(
    'aria-label',
    dark ? "Yorug' mavzuga o'tish" : "Qorong'i mavzuga o'tish",
  );
}

export function themeButton() {
  const button = h('button', { class: 'themebtn', type: 'button' });
  syncThemeButton(button);
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Saqlanmasa ham joriy sahifada ishlaydi
    }
    syncThemeButton(button);
  });
  return button;
}

/**
 * To'liq navigatsiya: brend, havolalar, mavzu, kirish/chiqish.
 * @param {HTMLElement} mount  <header> elementi
 * @param {NavKey} active
 */
export async function mountNav(mount, active) {
  /** @param {string} href @param {string} label @param {NavKey} key */
  const link = (href, label, key) =>
    h('a', {
      href,
      text: label,
      'aria-current': active === key ? 'page' : null,
    });

  const links = h(
    'nav',
    { class: 'navlinks', id: 'navlinks', 'aria-label': 'Asosiy menyu' },
    link(routes.home(), 'Bosh sahifa', 'home'),
  );
  const actions = h('div', { class: 'navactions' }, themeButton());
  const menuButton = h('button', {
    class: 'themebtn menubtn',
    type: 'button',
    text: '☰',
    'aria-label': 'Menyu',
    'aria-expanded': 'false',
    'aria-controls': 'navlinks',
  });
  actions.append(menuButton);

  const header = h(
    'div',
    { class: 'wrap nav' },
    h('a', { class: 'nav-brand', href: routes.home(), text: 'Chipta' }),
    links,
    actions,
  );
  mount.className = 'topnav';
  mount.replaceChildren(header);
  menuButton.addEventListener('click', () => {
    const open = mount.dataset.open !== 'true';
    mount.dataset.open = String(open);
    menuButton.setAttribute('aria-expanded', String(open));
  });

  const user = await getUser().catch(() => null);
  if (!user) {
    const login = h('a', {
      class: 'btn btn-secondary',
      href: routes.login(location.pathname + location.search),
      text: 'Kirish',
    });
    actions.insertBefore(login, menuButton);
    return;
  }
  if (user.role === 'CONTROLLER') {
    links.append(h('a', { href: routes.controller(), text: 'Kontroller' }));
  } else if (isAdmin(user)) {
    links.append(link(routes.admin(), 'Admin panel', 'admin'));
  } else {
    links.append(
      link(routes.tickets(), 'Chiptalarim', 'tickets'),
      link(routes.orders(), 'Buyurtmalarim', 'orders'),
    );
  }
  links.append(link(routes.profile(), 'Profil', 'profile'));
  const logoutButton = h('button', {
    class: 'btn btn-secondary',
    type: 'button',
    text: 'Chiqish',
  });
  logoutButton.addEventListener('click', () => {
    logoutButton.disabled = true;
    void logout();
  });
  actions.insertBefore(logoutButton, menuButton);
}

/**
 * Detal sahifalari uchun faqat "orqaga" havolasi bo'lgan panel (dizayn: Event Detail, Seat Selection).
 * @param {HTMLElement} mount
 * @param {string} href
 * @param {string} label
 * @param {string} [wrapClass]  sahifa kontenti bilan bir xil kenglik (masalan 'wrap-md')
 * @returns {HTMLAnchorElement} matnini keyin yangilash uchun
 */
export function mountBackBar(mount, href, label, wrapClass = '') {
  const back = h('a', { class: 'back', href, text: `← ${label}` });
  mount.className = 'topnav';
  mount.replaceChildren(
    h('div', { class: `wrap backbar ${wrapClass}` }, back, themeButton()),
  );
  return back;
}

/** @param {HTMLElement} mount */
export function mountFooter(mount) {
  mount.className = 'site-footer';
  mount.textContent =
    '© 2026 Chipta — konsert, teatr va shoular uchun chipta platformasi';
}
