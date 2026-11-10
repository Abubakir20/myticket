// @ts-check
// Statik SVG belgilar (foydalanuvchi ma'lumoti yo'q — innerHTML xavfsiz).

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** @type {Record<string, string>} */
const PATHS = {
  sun: `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>`,
  moon: `<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  'arrow-left': `<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  'arrow-right': `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
  pin: `<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>`,
  ticket: `<path d="M3.5 8.5V7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-3.5a2.5 2.5 0 0 0 0-5z"/><path d="M14 5v14" stroke-dasharray="2 2.5"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  cube: `<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>`,
  grid: `<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>`,
  eye: `<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  expand: `<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  rotate: `<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>`,
  sparkle: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>`,
  shield: `<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.4-4.4"/>`,
  bolt: `<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>`,
  logout: `<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>`,
  qr: `<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>`,
};

/**
 * @param {string} name
 * @param {number} [size]
 * @returns {SVGSVGElement}
 */
export function icon(name, size = 18) {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${STROKE} aria-hidden="true" focusable="false">${PATHS[name] ?? ''}</svg>`;
  return /** @type {SVGSVGElement} */ (tpl.content.firstElementChild);
}

/** Brend belgisi: gradientli chipta @returns {SVGSVGElement} */
export function logoMark() {
  const id = `lg${Math.random().toString(36).slice(2, 8)}`;
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff5a2e"/><stop offset=".55" stop-color="#ff2e7e"/><stop offset="1" stop-color="#6c4dff"/>
  </linearGradient></defs>
  <path fill="url(#${id})" d="M9 6h22a4 4 0 0 1 4 4v5.2a4.8 4.8 0 0 0 0 9.6V30a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5.2a4.8 4.8 0 0 0 0-9.6V10a4 4 0 0 1 4-4z"/>
  <path d="M25 9v22" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="2.2 2.6"/>
  <path d="M12.5 20.3l3.2 3.2 5.8-6.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  return /** @type {SVGSVGElement} */ (tpl.content.firstElementChild);
}
