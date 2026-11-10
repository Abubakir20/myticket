// Demo tadbirlar uchun original afishalar: SVG generatsiya qilinadi va sharp bilan WebP ga aylantiriladi.
// Tashqi rasm yuklanmaydi — server ichida ishlaydi, mualliflik huquqi muammosi yo'q.

export type PosterTheme =
  | 'orchestra'
  | 'jazz'
  | 'theatre'
  | 'standup'
  | 'folk'
  | 'neon'
  | 'kids'
  | 'rock'
  | 'maqom'
  | 'magic'
  | 'ballet'
  | 'cinema';

export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 900;
const W = POSTER_WIDTH;
const H = POSTER_HEIGHT;

// Deterministik tasodifiy sonlar: bir xil seed — bir xil afisha
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const f = (n: number) => n.toFixed(1);

function svg(defs: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <filter id="blur-lg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
  <filter id="blur-md" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="blur-sm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 0.07"/></feComponentTransfer>
  </filter>
  ${defs}
</defs>
${body}
<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}

function bg(id: string, stops: [string, string, string?], angle = 155) {
  const rad = (angle * Math.PI) / 180;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;
  const s = stops.filter(Boolean) as string[];
  return `<linearGradient id="${id}" x1="${f(100 - x2)}%" y1="${f(100 - y2)}%" x2="${f(x2)}%" y2="${f(y2)}%">
${s.map((c, i) => `<stop offset="${(i / (s.length - 1)) * 100}%" stop-color="${c}"/>`).join('')}
</linearGradient>`;
}

function stars(r: () => number, count: number, color = '#fff', maxY = H) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const size = r() * 2.4 + 0.6;
    out += `<circle cx="${f(r() * W)}" cy="${f(r() * maxY)}" r="${f(size)}" fill="${color}" opacity="${f(r() * 0.6 + 0.25)}"/>`;
  }
  return out;
}

function bokeh(r: () => number, count: number, colors: string[]) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const c = colors[Math.floor(r() * colors.length)];
    out += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(r() * 70 + 20)}" fill="${c}" opacity="${f(r() * 0.35 + 0.1)}" filter="url(#blur-sm)"/>`;
  }
  return out;
}

const themes: Record<PosterTheme, (r: () => number) => string> = {
  // Simfonik orkestr: oltin tovush to'lqinlari va yulduzli tun
  orchestra: (r) => {
    let arcs = '';
    for (let i = 0; i < 14; i++) {
      const rad = 120 + i * 48;
      arcs += `<circle cx="${W / 2}" cy="${H + 80}" r="${rad}" fill="none" stroke="#f3c26b" stroke-width="${f(2 + (i % 3))}" opacity="${f(0.75 - i * 0.045)}"/>`;
    }
    return svg(
      bg('g', ['#0d1430', '#1d2a5c', '#3b2f63']) +
        `<radialGradient id="glow" cx="50%" cy="100%" r="60%"><stop offset="0%" stop-color="#f6b54a" stop-opacity="0.7"/><stop offset="100%" stop-color="#f6b54a" stop-opacity="0"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${stars(r, 160, '#fff6dc', H * 0.7)}
       <rect width="${W}" height="${H}" fill="url(#glow)"/>${arcs}
       <circle cx="${W / 2}" cy="${H + 80}" r="110" fill="#f6c46e" filter="url(#blur-md)"/>`,
    );
  },

  // Jazz klub: tutunli ko'k fon, diagonal yorug'lik nurlari, bokeh
  jazz: (r) =>
    svg(
      bg('g', ['#05141f', '#0e3a52', '#12202e']),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       ${bokeh(r, 26, ['#ffb347', '#ff7e5f', '#6dd5ed', '#f7d794'])}
       <g opacity="0.35" filter="url(#blur-md)">
         <polygon points="${W * 0.62},0 ${W * 0.78},0 ${W * 0.35},${H} ${W * 0.05},${H}" fill="#ffd28a"/>
         <polygon points="${W * 0.84},0 ${W * 0.9},0 ${W * 0.72},${H} ${W * 0.55},${H}" fill="#ffe7b8"/>
       </g>
       <g fill="none" stroke="#f7d794" stroke-width="3" opacity="0.8">
         <path d="M ${W * 0.14} ${H * 0.72} q 60 -120 120 0 t 120 0 t 120 0 t 120 0"/>
         <path d="M ${W * 0.14} ${H * 0.78} q 60 -80 120 0 t 120 0 t 120 0 t 120 0" opacity="0.5"/>
       </g>`,
    ),

  // Teatr: qizil parda va markazdagi projektor nuri
  theatre: (r) => {
    let folds = '';
    const fold = (x0: number, dir: 1 | -1) => {
      let d = '';
      for (let i = 0; i < 7; i++) {
        const x = x0 + dir * i * 46;
        const sway = r() * 30 - 15;
        d += `<path d="M ${f(x)} 0 C ${f(x + sway)} ${H * 0.35}, ${f(x - sway)} ${H * 0.7}, ${f(x + dir * 18)} ${H}" stroke="#3d0710" stroke-width="10" opacity="0.45" fill="none"/>`;
      }
      return d;
    };
    folds += fold(30, 1) + fold(W - 30, -1);
    return svg(
      bg('g', ['#12060a', '#2a0c14', '#12060a'], 90) +
        bg('curtain', ['#9e1b2b', '#6d0f1c', '#9e1b2b'], 0) +
        `<radialGradient id="spot" cx="50%" cy="55%" r="38%"><stop offset="0%" stop-color="#ffe9c2" stop-opacity="0.85"/><stop offset="100%" stop-color="#ffe9c2" stop-opacity="0"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <ellipse cx="${W / 2}" cy="${H * 0.82}" rx="${W * 0.28}" ry="60" fill="#ffe9c2" opacity="0.25" filter="url(#blur-md)"/>
       <rect width="${W}" height="${H}" fill="url(#spot)"/>
       <path d="M 0 0 L ${W * 0.36} 0 C ${W * 0.3} ${H * 0.4}, ${W * 0.2} ${H * 0.75}, ${W * 0.08} ${H} L 0 ${H} Z" fill="url(#curtain)"/>
       <path d="M ${W} 0 L ${W * 0.64} 0 C ${W * 0.7} ${H * 0.4}, ${W * 0.8} ${H * 0.75}, ${W * 0.92} ${H} L ${W} ${H} Z" fill="url(#curtain)"/>
       ${folds}
       <path d="M 0 0 H ${W} V 70 Q ${W * 0.75} 130 ${W / 2} 90 Q ${W * 0.25} 130 0 70 Z" fill="#7d1220"/>
       <path d="M 0 70 Q ${W * 0.25} 130 ${W / 2} 90 Q ${W * 0.75} 130 ${W} 70" stroke="#d9a441" stroke-width="5" fill="none"/>`,
    );
  },

  // Stand-up: g'isht devor, projektor va mikrofon siluyeti
  standup: (r) => {
    let bricks = '';
    const bw = 120;
    const bh = 48;
    for (let y = 0; y < H; y += bh) {
      const offset = (y / bh) % 2 === 0 ? 0 : bw / 2;
      for (let x = -bw; x < W + bw; x += bw) {
        const shade = 30 + Math.floor(r() * 18);
        bricks += `<rect x="${x + offset + 3}" y="${y + 3}" width="${bw - 6}" height="${bh - 6}" rx="4" fill="rgb(${shade + 60},${shade + 18},${shade})"/>`;
      }
    }
    return svg(
      `<radialGradient id="spot" cx="50%" cy="42%" r="45%"><stop offset="0%" stop-color="#fff2c9" stop-opacity="0.65"/><stop offset="60%" stop-color="#fff2c9" stop-opacity="0.1"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="#2a1712"/>${bricks}
       <rect width="${W}" height="${H}" fill="url(#spot)"/>
       <g transform="translate(${W / 2} ${H * 0.3})">
         <ellipse cx="0" cy="0" rx="46" ry="62" fill="#1b1b1f"/>
         <g stroke="#3a3a42" stroke-width="3">${Array.from({ length: 7 }, (_, i) => `<line x1="-40" y1="${-45 + i * 15}" x2="40" y2="${-45 + i * 15}"/>`).join('')}</g>
         <rect x="-18" y="58" width="36" height="34" rx="8" fill="#26262c"/>
         <rect x="-7" y="90" width="14" height="${H * 0.62}" fill="#1b1b1f"/>
         <ellipse cx="0" cy="${H * 0.62 + 88}" rx="110" ry="18" fill="#141417"/>
       </g>`,
    );
  },

  // Folklor festivali: suzani uslubidagi rozetkalar
  folk: (r) => {
    const palette = [
      '#c0392b',
      '#e67e22',
      '#f1c40f',
      '#16a085',
      '#8e44ad',
      '#2c3e50',
    ];
    const rosette = (
      cx: number,
      cy: number,
      size: number,
      c1: string,
      c2: string,
    ) => {
      let petals = '';
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = cx + Math.cos(a) * size * 0.62;
        const py = cy + Math.sin(a) * size * 0.62;
        petals += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(size * 0.32)}" ry="${f(size * 0.14)}" fill="${c1}" transform="rotate(${f((a * 180) / Math.PI)} ${f(px)} ${f(py)})"/>`;
      }
      return `<g>${petals}<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(size * 0.42)}" fill="${c2}"/>
        <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(size * 0.3)}" fill="none" stroke="#fdf3df" stroke-width="${f(size * 0.05)}" stroke-dasharray="${f(size * 0.08)} ${f(size * 0.06)}"/>
        <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(size * 0.14)}" fill="#fdf3df"/></g>`;
    };
    let body = `<rect width="${W}" height="${H}" fill="#f6ead2"/>`;
    const spots: [number, number, number][] = [
      [W * 0.5, H * 0.48, 230],
      [W * 0.14, H * 0.2, 130],
      [W * 0.86, H * 0.22, 140],
      [W * 0.12, H * 0.82, 150],
      [W * 0.88, H * 0.8, 130],
      [W * 0.32, H * 0.9, 80],
      [W * 0.7, H * 0.06, 85],
    ];
    for (const [x, y, s] of spots) {
      const c1 = palette[Math.floor(r() * palette.length)];
      let c2 = palette[Math.floor(r() * palette.length)];
      if (c2 === c1) c2 = '#2c3e50';
      body += rosette(x, y, s, c1, c2);
    }
    let vines = '';
    for (let i = 0; i < 18; i++) {
      const x = r() * W;
      const y = r() * H;
      vines += `<path d="M ${f(x)} ${f(y)} q 30 -40 60 0 t 60 0" stroke="#16a085" stroke-width="5" fill="none" opacity="0.55"/>`;
      vines += `<circle cx="${f(x + 120)}" cy="${f(y)}" r="9" fill="#c0392b" opacity="0.7"/>`;
    }
    return svg('', body.replace('</rect>', '</rect>') + vines);
  },

  // Elektron musiqa: neon setka va retro quyosh
  neon: (r) => {
    let grid = '';
    const horizon = H * 0.58;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const y = horizon + Math.pow(t, 2.2) * (H - horizon);
      grid += `<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="#ff3df2" stroke-width="${f(1 + t * 3)}" opacity="${f(0.3 + t * 0.6)}"/>`;
    }
    for (let i = -12; i <= 12; i++) {
      grid += `<line x1="${W / 2 + i * 40}" y1="${horizon}" x2="${W / 2 + i * 260}" y2="${H}" stroke="#36e4ff" stroke-width="2" opacity="0.65"/>`;
    }
    let sunBands = '';
    for (let i = 0; i < 6; i++) {
      sunBands += `<rect x="${W / 2 - 260}" y="${f(horizon - 120 + i * 24)}" width="520" height="${f(4 + i * 2.2)}" fill="#1a0533"/>`;
    }
    return svg(
      bg('g', ['#1a0533', '#3d0b5c', '#12021f'], 90) +
        `<linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe86b"/><stop offset="100%" stop-color="#ff3d8b"/></linearGradient>
         <clipPath id="sunclip"><rect x="0" y="0" width="${W}" height="${horizon}"/></clipPath>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${stars(r, 90, '#ffd1ff', horizon)}
       <circle cx="${W / 2}" cy="${horizon}" r="300" fill="#ff3d8b" opacity="0.35" filter="url(#blur-lg)"/>
       <g clip-path="url(#sunclip)"><circle cx="${W / 2}" cy="${horizon}" r="260" fill="url(#sun)"/>${sunBands}</g>
       <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="#12021f"/>
       ${grid}
       <line x1="0" y1="${horizon}" x2="${W}" y2="${horizon}" stroke="#ff9cf7" stroke-width="3"/>`,
    );
  },

  // Bolalar spektakli: quyosh, bulutlar, havo sharlari va tepaliklar
  kids: (r) => {
    const cloud = (x: number, y: number, s: number) =>
      `<g fill="#ffffff" opacity="0.95"><ellipse cx="${x}" cy="${y}" rx="${70 * s}" ry="${40 * s}"/><ellipse cx="${x + 55 * s}" cy="${y - 25 * s}" rx="${55 * s}" ry="${45 * s}"/><ellipse cx="${x + 110 * s}" cy="${y}" rx="${70 * s}" ry="${38 * s}"/></g>`;
    let balloons = '';
    const colors = [
      '#ff6b6b',
      '#feca57',
      '#48dbfb',
      '#ff9ff3',
      '#1dd1a1',
      '#5f27cd',
    ];
    for (let i = 0; i < 7; i++) {
      const x = W * 0.2 + r() * W * 0.6;
      const y = H * 0.18 + r() * H * 0.3;
      const c = colors[i % colors.length];
      balloons += `<path d="M ${f(x)} ${f(y + 62)} q 14 60 -6 140" stroke="#5d5d5d" stroke-width="2" fill="none"/>
        <ellipse cx="${f(x)}" cy="${f(y)}" rx="46" ry="58" fill="${c}"/>
        <ellipse cx="${f(x - 16)}" cy="${f(y - 20)}" rx="10" ry="16" fill="#fff" opacity="0.5"/>
        <polygon points="${f(x - 7)},${f(y + 58)} ${f(x + 7)},${f(y + 58)} ${f(x)},${f(y + 68)}" fill="${c}"/>`;
    }
    return svg(
      bg('g', ['#7fd3ff', '#bde8ff', '#fff4d6'], 90),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <circle cx="${W * 0.85}" cy="${H * 0.18}" r="90" fill="#ffd45e"/>
       <circle cx="${W * 0.85}" cy="${H * 0.18}" r="130" fill="#ffd45e" opacity="0.3"/>
       ${cloud(W * 0.08, H * 0.16, 1)}${cloud(W * 0.55, H * 0.1, 0.8)}${cloud(W * 0.3, H * 0.42, 0.6)}
       ${balloons}
       <path d="M 0 ${H * 0.78} Q ${W * 0.25} ${H * 0.62} ${W * 0.5} ${H * 0.78} T ${W} ${H * 0.74} V ${H} H 0 Z" fill="#7bc96f"/>
       <path d="M 0 ${H * 0.88} Q ${W * 0.3} ${H * 0.76} ${W * 0.62} ${H * 0.9} T ${W} ${H * 0.86} V ${H} H 0 Z" fill="#4caf50"/>`,
    );
  },

  // Rok festivali: tog'lar, chaqmoq va issiq osmon
  rock: (r) => {
    let ridge = `M 0 ${H}`;
    let x = 0;
    while (x <= W) {
      ridge += ` L ${f(x)} ${f(H * 0.55 + r() * H * 0.25)}`;
      x += 60 + r() * 80;
    }
    ridge += ` L ${W} ${H} Z`;
    let ridge2 = `M 0 ${H}`;
    x = 0;
    while (x <= W) {
      ridge2 += ` L ${f(x)} ${f(H * 0.7 + r() * H * 0.18)}`;
      x += 40 + r() * 60;
    }
    ridge2 += ` L ${W} ${H} Z`;
    return svg(
      bg('g', ['#ff5e3a', '#b31217', '#1a0a0a'], 90),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <circle cx="${W * 0.3}" cy="${H * 0.36}" r="150" fill="#ffd27a" opacity="0.85"/>
       <circle cx="${W * 0.3}" cy="${H * 0.36}" r="230" fill="#ffb24a" opacity="0.25" filter="url(#blur-md)"/>
       <path d="${ridge}" fill="#3a0d0d"/>
       <path d="${ridge2}" fill="#140505"/>
       <polygon points="${W * 0.68},${H * 0.08} ${W * 0.6},${H * 0.42} ${W * 0.66},${H * 0.42} ${W * 0.58},${H * 0.76} ${W * 0.76},${H * 0.32} ${W * 0.69},${H * 0.32} ${W * 0.75},${H * 0.08}" fill="#fff3b0"/>
       <polygon points="${W * 0.68},${H * 0.08} ${W * 0.6},${H * 0.42} ${W * 0.66},${H * 0.42} ${W * 0.58},${H * 0.76} ${W * 0.76},${H * 0.32} ${W * 0.69},${H * 0.32} ${W * 0.75},${H * 0.08}" fill="#fff3b0" filter="url(#blur-md)" opacity="0.8"/>`,
    );
  },

  // Maqom kechasi: lojuvard va feruza girih naqshi
  maqom: () => {
    const star = (cx: number, cy: number, s: number) => {
      const pts: string[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? s : s * 0.55;
        pts.push(`${f(cx + Math.cos(a) * rad)},${f(cy + Math.sin(a) * rad)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="#e8c26a" stroke-width="3"/>
        <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.32)}" fill="#1aa3a3" opacity="0.85"/>
        <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.12)}" fill="#e8c26a"/>`;
    };
    let tiles = '';
    const step = 150;
    for (let y = 0; y <= H + step; y += step) {
      for (let x = 0; x <= W + step; x += step) {
        tiles += star(x, y, 62);
        tiles += `<rect x="${x + step / 2 - 14}" y="${y + step / 2 - 14}" width="28" height="28" fill="#e8c26a" opacity="0.5" transform="rotate(45 ${x + step / 2} ${y + step / 2})"/>`;
      }
    }
    return svg(
      bg('g', ['#0b2a5b', '#123f7a', '#0a1f45']) +
        `<radialGradient id="vig" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.6"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${tiles}
       <path d="M ${W * 0.3} ${H} V ${H * 0.42} A ${W * 0.2} ${W * 0.2} 0 0 1 ${W * 0.7} ${H * 0.42} V ${H} Z" fill="#071a3a" opacity="0.88"/>
       <path d="M ${W * 0.3} ${H} V ${H * 0.42} A ${W * 0.2} ${W * 0.2} 0 0 1 ${W * 0.7} ${H * 0.42} V ${H}" fill="none" stroke="#e8c26a" stroke-width="8"/>
       <rect width="${W}" height="${H}" fill="url(#vig)"/>`,
    );
  },

  // Fokuslar shousi: binafsha fon, uchqunlar va sehrli yoy
  magic: (r) => {
    let sparks = '';
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const x = W * 0.2 + t * W * 0.6;
      const y = H * 0.75 - Math.sin(t * Math.PI) * H * 0.5 + (r() - 0.5) * 60;
      const s = r() * 14 + 6;
      sparks += `<path d="M ${f(x)} ${f(y - s)} L ${f(x + s * 0.25)} ${f(y - s * 0.25)} L ${f(x + s)} ${f(y)} L ${f(x + s * 0.25)} ${f(y + s * 0.25)} L ${f(x)} ${f(y + s)} L ${f(x - s * 0.25)} ${f(y + s * 0.25)} L ${f(x - s)} ${f(y)} L ${f(x - s * 0.25)} ${f(y - s * 0.25)} Z" fill="#fff4c2" opacity="${f(0.5 + r() * 0.5)}"/>`;
    }
    return svg(
      bg('g', ['#1b0638', '#4a1273', '#0c0320']) +
        `<radialGradient id="glow" cx="50%" cy="70%" r="50%"><stop offset="0%" stop-color="#c77dff" stop-opacity="0.7"/><stop offset="100%" stop-color="#c77dff" stop-opacity="0"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${stars(r, 140, '#e0c3ff')}
       <rect width="${W}" height="${H}" fill="url(#glow)"/>
       <path d="M ${W * 0.2} ${H * 0.75} Q ${W * 0.5} ${H * -0.2} ${W * 0.8} ${H * 0.75}" stroke="#ffd166" stroke-width="10" fill="none" opacity="0.4" filter="url(#blur-md)"/>
       ${sparks}
       <g transform="translate(${W / 2} ${H * 0.86})">
         <ellipse cx="0" cy="0" rx="150" ry="26" fill="#0a0212"/>
         <rect x="-92" y="-190" width="184" height="190" rx="10" fill="#0a0212"/>
         <rect x="-92" y="-62" width="184" height="30" fill="#b5179e"/>
       </g>`,
    );
  },

  // Balet: oqayotgan lentalar va yumshoq pastel ranglar
  ballet: (r) => {
    let ribbons = '';
    const colors = ['#ffd6e0', '#f7aef8', '#b8c0ff', '#ffffff', '#ffc8dd'];
    for (let i = 0; i < 9; i++) {
      const y = H * 0.15 + i * H * 0.09;
      const a = 80 + r() * 120;
      ribbons += `<path d="M -50 ${f(y)} C ${f(W * 0.25)} ${f(y - a)}, ${f(W * 0.55)} ${f(y + a)}, ${W + 50} ${f(y - a * 0.4)}" stroke="${colors[i % colors.length]}" stroke-width="${f(6 + r() * 20)}" fill="none" opacity="${f(0.35 + r() * 0.45)}" stroke-linecap="round"/>`;
    }
    let feathers = '';
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = r() * H;
      const rot = r() * 360;
      feathers += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="22" ry="6" fill="#ffffff" opacity="${f(0.3 + r() * 0.5)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})"/>`;
    }
    return svg(
      bg('g', ['#0f3b45', '#1c5c69', '#2b1d4a']),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <circle cx="${W * 0.5}" cy="${H * 0.45}" r="260" fill="#ffd6e0" opacity="0.18" filter="url(#blur-lg)"/>
       ${ribbons}${feathers}`,
    );
  },

  // Kino-konsert: plyonka lentasi va projektor nuri
  cinema: (r) => {
    let holes = '';
    for (let x = 20; x < W; x += 60) {
      holes += `<rect x="${x}" y="${H * 0.62 + 14}" width="30" height="20" rx="4" fill="#f5ead8"/>`;
      holes += `<rect x="${x}" y="${H * 0.62 + 186}" width="30" height="20" rx="4" fill="#f5ead8"/>`;
    }
    let frames = '';
    for (let i = 0; i < 6; i++) {
      const x = 30 + i * 200;
      const hue = Math.floor(r() * 360);
      frames += `<rect x="${x}" y="${H * 0.62 + 46}" width="170" height="128" rx="6" fill="hsl(${hue} 55% 45%)" opacity="0.9"/>`;
    }
    return svg(
      bg('g', ['#120d0b', '#2a1d16', '#120d0b'], 90),
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <polygon points="${W * 0.08},${H * 0.14} ${W},${H * -0.1} ${W},${H * 0.58}" fill="#fff1c9" opacity="0.18" filter="url(#blur-md)"/>
       <polygon points="${W * 0.08},${H * 0.14} ${W},${H * 0.05} ${W},${H * 0.4}" fill="#fff1c9" opacity="0.14"/>
       ${stars(r, 70, '#fff1c9', H * 0.55)}
       <circle cx="${W * 0.08}" cy="${H * 0.14}" r="48" fill="#3a2a20" stroke="#c9a46a" stroke-width="6"/>
       <circle cx="${W * 0.08}" cy="${H * 0.14}" r="18" fill="#fff1c9"/>
       <g transform="rotate(-4 ${W / 2} ${H * 0.75})">
         <rect x="-20" y="${H * 0.62}" width="${W + 40}" height="220" fill="#1a1a1a"/>
         ${holes}${frames}
       </g>`,
    );
  },
};

export function posterSvg(theme: PosterTheme, seed: number) {
  return themes[theme](rng(seed));
}
