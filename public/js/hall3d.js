// @ts-check
// 3D zal (Three.js) — haqiqiy teatr zali qoidalari asosida:
//  • qatorlar sahna atrofida yoy bo'ylab, orqaga qarab ko'tariladi (parter yumshoq, amfiteatr/balkon tik);
//  • qator bloklarga bo'linadi, bloklar orasida yo'lak (≈1.1 m), yo'lakda gilam, har qatorda 2 zina va LED;
//  • o'rindiq ≈0.56 m, qatorlar orasi ≈0.9 m, qo'ltiqtayanch va yon tirgakli kreslolar;
//  • balkon — fasad, tutqich, ustunlar; sahna — portal, baxmal parda, yog'och pol, rampa chiroqlari.
// Rejimlar: "zal" (aylantirish) va "o'rindiq" (kamera joyda, atrofga qarash va yaqinlashtirish mumkin).
// Faqat ko'rinish qatlami: holat (tanlov, band joylar) seats.js da, bu yerga set* orqali beriladi.

import * as THREE from '../vendor/three.js';
import * as fmt from './format.js';

/** @typedef {import('./types.js').SeatMap} SeatMap */
/** @typedef {import('./types.js').SeatStatus} SeatStatus */

/**
 * @typedef {object} SeatNode
 * @property {string} id
 * @property {number} index
 * @property {string} sector
 * @property {number} sectorIndex
 * @property {number} row
 * @property {number} num
 * @property {number} price
 * @property {SeatStatus} status
 * @property {THREE.Vector3} pos
 * @property {number} rot
 */

/**
 * @typedef {object} Hall3D
 * @property {(statuses: Map<string, SeatStatus>) => void} setStatuses
 * @property {(ids: Set<string>) => void} setSelected
 * @property {(id: string) => void} viewFromSeat
 * @property {() => void} overview
 * @property {() => void} topView
 * @property {() => void} destroy
 */

// Kreslo qoplamasi (baxmal) — narx toifasi bo'yicha. seats.js dagi PALETTE bilan bir xil.
export const SECTOR_COLORS = [
  '#d9a13b',
  '#c8323f',
  '#6d4bd1',
  '#2a7fc0',
  '#2e9e6b',
  '#c23a7c',
];

const THEMES = {
  dark: {
    bg: '#06060a',
    floor: '#1a1016',
    riserTop: '#1e151b',
    riserSide: '#120c10',
    aisle: '#5e1622',
    wall: '#100c10',
    panel: '#3b2619',
    dado: '#0c0a0c',
    stage: '#3a2617',
    frame: '#141018',
    trim: '#b8913f',
    sold: '#2c2b35',
    held: '#7a6227',
    selected: '#ffffff',
    chairFrame: '#1b1a20',
    fog: [30, 110],
    ambient: 0.42,
    hemi: 0.45,
    key: 0.7,
    beam: 0.5,
  },
  light: {
    bg: '#e9e6e1',
    floor: '#d6cdc3',
    riserTop: '#cec4b9',
    riserSide: '#b5aa9d',
    aisle: '#a83440',
    wall: '#e7ddd0',
    panel: '#b88a62',
    dado: '#9c7a5c',
    stage: '#a87c52',
    frame: '#cfc4b6',
    trim: '#b8913f',
    sold: '#b4b2b8',
    held: '#e7c67f',
    selected: '#111018',
    chairFrame: '#3a3640',
    fog: [45, 140],
    ambient: 0.85,
    hemi: 0.6,
    key: 1.0,
    beam: 0.18,
  },
};

const SEAT_GAP = 0.56; // o'rindiq kengligi (markazdan markazgacha)
const ROW_GAP = 0.9; // qatorlar orasi (back-to-back)
const AISLE = 1.1; // yo'lak kengligi
const FIRST_ROW = 7.5; // sahna markazidan birinchi qatorgacha
const SECTOR_GAP = 1.6; // sektorlar orasidagi ko'ndalang yo'lak
const FOCUS = new THREE.Vector3(0, 0, -3); // qatorlar yoyining markazi
const BALCONY = /balkon|beletaj|loja|yarus|lodge|balcony|mezzanine/i;
const EYE = 1.6; // odam bo'yi: ko'z balandligi (poldan ≈1.6 m) — oldingi qatorlar sahnani to'smaydi

/**
 * @param {{
 *   container: HTMLElement,
 *   map: SeatMap,
 *   posterUrl: string,
 *   title: string,
 *   onToggle: (seatId: string) => void,
 *   onModeChange?: (mode: 'hall' | 'seat', seat?: SeatNode) => void,
 * }} options
 * @returns {Hall3D | null}
 */
export function createHall3D(options) {
  const { container, map } = options;

  /** @type {THREE.WebGLRenderer} */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(
    Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2),
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = 'hall3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    "Zalning 3D ko'rinishi. Klaviatura bilan tanlash uchun «Sxema» ko'rinishiga o'ting.",
  );
  container.append(canvas);

  const overlay = document.createElement('div');
  overlay.className = 'hall3d-labels';
  overlay.setAttribute('aria-hidden', 'true');
  const tooltip = document.createElement('div');
  tooltip.className = 'hall3d-tip';
  tooltip.hidden = true;
  container.append(overlay, tooltip);

  let needsRender = true;
  const requestRender = () => {
    needsRender = true;
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = Math.PI * 0.06;

  // ---------- Materiallar (mavzu bo'yicha rangi o'zgaradi) ----------

  const themeName = () =>
    document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light';
  let theme = THEMES[themeName()];

  const mats = {
    floor: new THREE.MeshStandardMaterial({ roughness: 1 }),
    riserTop: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
    riserSide: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    aisle: new THREE.MeshStandardMaterial({ roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({
      roughness: 0.95,
      side: THREE.FrontSide,
    }),
    panel: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    dado: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    stage: new THREE.MeshStandardMaterial({
      roughness: 0.55,
      map: woodTexture(),
    }),
    stageSide: new THREE.MeshStandardMaterial({
      roughness: 0.8,
      color: '#0d0b0d',
    }),
    frame: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }),
    trim: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.85 }),
    curtain: new THREE.MeshStandardMaterial({
      color: '#7a0e1b',
      roughness: 0.88,
      side: THREE.DoubleSide,
    }),
    seat: new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 }),
    chairFrame: new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.3,
    }),
    black: new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.6 }),
    led: new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }),
    aisleLight: new THREE.MeshBasicMaterial({
      color: '#ffe3b0',
      toneMapped: false,
    }),
    sconce: new THREE.MeshBasicMaterial({
      color: '#ffcf8a',
      toneMapped: false,
    }),
  };

  const ambient = new THREE.AmbientLight('#ffffff', 0.5);
  const hemi = new THREE.HemisphereLight('#d6dcff', '#2a1a14', 0.5);
  const key = new THREE.DirectionalLight('#fff4e6', 0.8);
  key.position.set(6, 24, 20);
  scene.add(ambient, hemi, key);

  function applyTheme() {
    theme = THEMES[themeName()];
    scene.background = new THREE.Color(theme.bg);
    scene.fog = new THREE.Fog(theme.bg, theme.fog[0], theme.fog[1]);
    mats.floor.color.set(theme.floor);
    mats.riserTop.color.set(theme.riserTop);
    mats.riserSide.color.set(theme.riserSide);
    mats.aisle.color.set(theme.aisle);
    mats.wall.color.set(theme.wall);
    mats.panel.color.set(theme.panel);
    mats.dado.color.set(theme.dado);
    mats.stage.color.set(theme.stage);
    mats.frame.color.set(theme.frame);
    mats.trim.color.set(theme.trim);
    mats.chairFrame.color.set(theme.chairFrame);
    ambient.intensity = theme.ambient;
    hemi.intensity = theme.hemi;
    key.intensity = theme.key;
    // Zal chiroqlari yoniq (yorug' mavzu) bo'lsa, havodagi nur ko'rinmaydi — haqiqatdagidek
    beamMat.opacity = theme.beam;
    for (const b of beams) b.mesh.visible = themeName() === 'dark';
    poolMat.opacity = Math.max(theme.beam, 0.3);
    paintAll();
    requestRender();
  }

  /** @param {number} i */
  const sectorColor = (i) => SECTOR_COLORS[i % SECTOR_COLORS.length];

  // ---------- Joylashuv ----------

  /** @type {SeatNode[]} */
  const nodes = [];
  /** @type {Map<string, SeatNode>} */
  const byId = new Map();
  /** @type {{ pos: THREE.Vector3, el: HTMLElement }[]} */
  const labels = [];

  // Yo'lak detallari (instanced): gilam, zina chetidagi LED, oraliq zina, qator chetidagi chiroq
  /** @type {THREE.Matrix4[]} */ const carpetM = [];
  /** @type {THREE.Matrix4[]} */ const ledM = [];
  /** @type {THREE.Matrix4[]} */ const halfStepM = [];
  /** @type {THREE.Matrix4[]} */ const aisleLightM = [];
  /** @type {{ from: THREE.Vector3, to: THREE.Vector3 }[]} */ const rails = [];

  let maxChord = 10;
  let maxDist = FIRST_ROW;
  let maxY = 0;
  let distance = FIRST_ROW;
  let base = 0;
  const hall = new THREE.Group();
  scene.add(hall);

  const tmpObj = new THREE.Object3D();
  /** @param {number} phi @param {number} d @param {number} y @param {number} [sx] @param {number} [sy] @param {number} [sz] */
  const radialMatrix = (phi, d, y, sx = 1, sy = 1, sz = 1) => {
    tmpObj.position.set(
      FOCUS.x + d * Math.sin(phi),
      y,
      FOCUS.z + d * Math.cos(phi),
    );
    tmpObj.rotation.set(0, phi, 0);
    tmpObj.scale.set(sx, sy, sz);
    tmpObj.updateMatrix();
    return tmpObj.matrix.clone();
  };

  map.sectors.forEach((sector, si) => {
    const balcony = si > 0 && BALCONY.test(sector.sectorName);
    const rake = balcony ? 0.36 : si === 0 ? 0.12 : 0.24;
    if (si > 0) {
      distance += SECTOR_GAP;
      base += balcony ? 2.8 : 0.5;
    }
    const rows = [...sector.rows].sort((a, b) => a.number - b.number);
    const sectorStart = distance;
    let widest = 0;
    let lastY = base;
    /** @type {number[]} yo'lak markazlari (yoy uzunligi bo'yicha, eng uzun qatorga ko'ra) */
    let aisleS = [];

    rows.forEach((row, ri) => {
      const d = distance + ri * ROW_GAP;
      const y = base + ri * rake + (si === 0 ? 0 : 0.2);
      const seats = [...row.seats].sort((a, b) => a.number - b.number);
      const n = seats.length;
      // Bloklar: ≤9 — bitta (yon yo'laklar), ≤18 — ikkita (markaziy yo'lak), aks holda uchta
      const nb = n <= 9 ? 1 : n <= 18 ? 2 : 3;
      const per = Math.ceil(n / nb);
      const block = (/** @type {number} */ k) =>
        Math.min(nb - 1, Math.floor(k / per));
      const span = (n - 1) * SEAT_GAP + (nb - 1) * AISLE;
      /** @param {number} k */
      const sOf = (k) => k * SEAT_GAP + block(k) * AISLE - span / 2;
      const half = span / 2 + SEAT_GAP / 2 + AISLE;
      const theta = half / d;
      widest = Math.max(widest, theta);
      maxChord = Math.max(maxChord, 2 * d * Math.sin(theta));

      seats.forEach((seat, k) => {
        const phi = sOf(k) / d;
        const pos = new THREE.Vector3(
          FOCUS.x + d * Math.sin(phi),
          y,
          FOCUS.z + d * Math.cos(phi),
        );
        const node = {
          id: seat.seatId,
          index: nodes.length,
          sector: sector.sectorName,
          sectorIndex: si,
          row: row.number,
          num: seat.number,
          price: Number(sector.price),
          status: seat.status,
          pos,
          rot: phi,
        };
        nodes.push(node);
        byId.set(node.id, node);
      });

      // Yo'lak markazlari: chap chet, bloklar orasi, o'ng chet
      const rowAisles = [sOf(0) - SEAT_GAP / 2 - AISLE / 2];
      for (let b = 1; b < nb; b += 1) {
        const last = b * per - 1;
        rowAisles.push((sOf(last) + sOf(last + 1)) / 2);
      }
      rowAisles.push(sOf(n - 1) + SEAT_GAP / 2 + AISLE / 2);
      if (ri === rows.length - 1) aisleS = rowAisles;

      // Pog'ona (tepasi gilam rangida, old yuzasi to'qroq)
      const bottom = balcony ? y - 0.6 : 0;
      const riser = annulus(
        d - ROW_GAP / 2,
        d + ROW_GAP / 2,
        theta,
        y - bottom,
        bottom,
      );
      hall.add(new THREE.Mesh(riser, [mats.riserTop, mats.riserSide]));

      for (const s of rowAisles) {
        const phi = s / d;
        carpetM.push(radialMatrix(phi, d, y + 0.006, AISLE * 0.92, 1, ROW_GAP));
        ledM.push(
          radialMatrix(
            phi,
            d - ROW_GAP / 2 + 0.02,
            y + 0.01,
            AISLE * 0.86,
            1,
            1,
          ),
        );
        // Oraliq zina: oldingi qator yo'lagining orqa yarmida (har qatorga 2 zina)
        if (ri > 0 && rake > 0.15) {
          const dPrev = d - ROW_GAP;
          const yPrev = y - rake;
          halfStepM.push(
            radialMatrix(
              phi,
              dPrev + ROW_GAP / 4,
              yPrev + rake / 4,
              AISLE * 0.92,
              rake / 2,
              ROW_GAP / 2,
            ),
          );
          ledM.push(
            radialMatrix(
              phi,
              dPrev + 0.02,
              yPrev + rake / 2 + 0.01,
              AISLE * 0.86,
              1,
              1,
            ),
          );
        }
      }
      // Qator chetidagi kresloda past "yo'lak chirog'i"
      for (let b = 0; b < nb; b += 1) {
        const first = b * per;
        const last = Math.min(n - 1, (b + 1) * per - 1);
        aisleLightM.push(
          radialMatrix(
            (sOf(first) - SEAT_GAP / 2 + 0.03) / d,
            d + 0.05,
            y + 0.22,
          ),
        );
        aisleLightM.push(
          radialMatrix(
            (sOf(last) + SEAT_GAP / 2 - 0.03) / d,
            d + 0.05,
            y + 0.22,
          ),
        );
      }

      lastY = y;
      maxY = Math.max(maxY, y);
    });

    const end = distance + (rows.length - 1) * ROW_GAP;
    const firstY = base + (si === 0 ? 0 : 0.2);

    // Tik sektorlarda yo'lak tutqichlari
    if (rake >= 0.24 && rows.length > 1) {
      for (const s of aisleS) {
        const phi0 = s / sectorStart;
        const phi1 = s / end;
        rails.push({
          from: new THREE.Vector3(
            FOCUS.x + sectorStart * Math.sin(phi0),
            firstY + 0.9,
            FOCUS.z + sectorStart * Math.cos(phi0),
          ),
          to: new THREE.Vector3(
            FOCUS.x + end * Math.sin(phi1),
            lastY + 0.9,
            FOCUS.z + end * Math.cos(phi1),
          ),
        });
      }
    }

    // Sektor old chetidagi ingichka rangli chiziq — narx toifasini zalning o'zida ham ko'rsatadi
    const edgeD = sectorStart - ROW_GAP / 2 - 0.05;
    hall.add(
      new THREE.Mesh(
        annulus(edgeD - 0.04, edgeD + 0.04, widest, 0.03, firstY + 0.005),
        new THREE.MeshBasicMaterial({
          color: sectorColor(si),
          toneMapped: false,
        }),
      ),
    );

    if (balcony) {
      // Balkon fasadi: pastki tekislikdan parapet tepasigacha, tepasida oltin tutqich
      const top = firstY + 0.95;
      const bottomF = firstY - 1.1;
      hall.add(
        new THREE.Mesh(
          annulus(edgeD - 0.16, edgeD, widest + 0.02, top - bottomF, bottomF),
          [mats.frame, mats.frame],
        ),
      );
      hall.add(
        new THREE.Mesh(
          annulus(edgeD - 0.2, edgeD + 0.04, widest + 0.03, 0.06, top),
          mats.trim,
        ),
      );
      hall.add(
        new THREE.Mesh(
          annulus(
            edgeD - 0.18,
            edgeD - 0.15,
            widest + 0.02,
            0.05,
            bottomF + 0.35,
          ),
          mats.trim,
        ),
      );
      // Balkon ostidagi ustunlar
      const cols = Math.max(3, Math.round(widest * 4));
      for (let c = 0; c <= cols; c += 1) {
        const phi = -widest + (2 * widest * c) / cols;
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.2, bottomF, 16),
          mats.frame,
        );
        col.position.set(
          FOCUS.x + (edgeD + 0.3) * Math.sin(phi),
          bottomF / 2,
          FOCUS.z + (edgeD + 0.3) * Math.cos(phi),
        );
        hall.add(col);
      }
    }

    const el = document.createElement('div');
    el.className = 'hall3d-label';
    el.style.setProperty('--c', sectorColor(si));
    const nameEl = document.createElement('b');
    nameEl.textContent = sector.sectorName;
    const priceEl = document.createElement('span');
    priceEl.textContent = fmt.price(sector.price);
    el.append(nameEl, priceEl);
    overlay.append(el);
    const midD = (sectorStart + end) / 2;
    const side = si % 2 === 0 ? 1 : -1;
    const ang = side * (widest + 0.7 / midD);
    labels.push({
      pos: new THREE.Vector3(
        FOCUS.x + midD * Math.sin(ang),
        (firstY + lastY) / 2 + 1.4,
        FOCUS.z + midD * Math.cos(ang),
      ),
      el,
    });

    maxDist = end;
    distance = end + ROW_GAP;
  });

  /** @param {THREE.BufferGeometry} geo @param {THREE.Material} mat @param {THREE.Matrix4[]} list */
  const instanced = (geo, mat, list) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    hall.add(mesh);
  };
  instanced(new THREE.BoxGeometry(1, 0.012, 1), mats.aisle, carpetM);
  instanced(new THREE.BoxGeometry(1, 0.018, 0.035), mats.led, ledM);
  instanced(new THREE.BoxGeometry(1, 1, 1), mats.riserTop, halfStepM);
  instanced(
    new THREE.BoxGeometry(0.05, 0.035, 0.035),
    mats.aisleLight,
    aisleLightM,
  );
  for (const r of rails) {
    hall.add(tube(r.from, r.to, 0.025, mats.trim));
    for (const t of [0, 0.5, 1]) {
      const p = r.from.clone().lerp(r.to, t);
      hall.add(
        tube(new THREE.Vector3(p.x, p.y - 0.9, p.z), p, 0.02, mats.trim),
      );
    }
  }

  // ---------- Kreslolar: qoplama (rangli) + karkas (qo'ltiqtayanch, yon tirgak) ----------

  const upholstery = new THREE.InstancedMesh(
    chairUpholstery(),
    mats.seat,
    Math.max(nodes.length, 1),
  );
  const frames = new THREE.InstancedMesh(
    chairFrame(),
    mats.chairFrame,
    Math.max(nodes.length, 1),
  );
  upholstery.count = nodes.length;
  frames.count = nodes.length;
  hall.add(upholstery, frames);
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const white = new THREE.Color('#ffffff');

  /** @type {Set<string>} */
  let selected = new Set();
  /** @type {SeatNode | null} */
  let hovered = null;
  /** @type {SeatNode | null} o'rindiq rejimida kamera turgan joy */
  let seated = null;

  /** @param {SeatNode} n */
  function placeSeat(n) {
    const scale =
      seated === n
        ? 0.0001
        : hovered === n
          ? 1.12
          : selected.has(n.id)
            ? 1.05
            : 1;
    dummy.position.copy(n.pos);
    dummy.rotation.set(0, n.rot, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    upholstery.setMatrixAt(n.index, dummy.matrix);
    frames.setMatrixAt(n.index, dummy.matrix);
  }

  /** @param {SeatNode} n */
  function colorSeat(n) {
    if (selected.has(n.id)) tmpColor.set(theme.selected);
    else if (n.status === 'SOLD') tmpColor.set(theme.sold);
    else if (n.status === 'HELD') tmpColor.set(theme.held);
    else {
      tmpColor.set(sectorColor(n.sectorIndex));
      if (hovered === n) tmpColor.lerp(white, 0.4);
    }
    upholstery.setColorAt(n.index, tmpColor);
  }

  function flush() {
    upholstery.instanceMatrix.needsUpdate = true;
    frames.instanceMatrix.needsUpdate = true;
    if (upholstery.instanceColor) upholstery.instanceColor.needsUpdate = true;
  }

  function paintAll() {
    for (const n of nodes) {
      placeSeat(n);
      colorSeat(n);
    }
    flush();
    syncMarkers();
  }

  /** @param {SeatNode} n */
  function repaint(n) {
    placeSeat(n);
    colorSeat(n);
    flush();
  }

  // Tanlangan o'rindiq ustida suzuvchi belgi
  const markerGeo = new THREE.ConeGeometry(0.15, 0.34, 18);
  markerGeo.rotateX(Math.PI);
  const markerMat = new THREE.MeshStandardMaterial({
    color: '#ff4d2e',
    emissive: '#ff2e7e',
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  const ringGeo = new THREE.RingGeometry(0.3, 0.37, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ff4d2e',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  /** @type {Map<string, THREE.Group>} */
  const markers = new Map();

  function syncMarkers() {
    for (const [id, m] of markers) {
      if (!selected.has(id)) {
        hall.remove(m);
        markers.delete(id);
      }
    }
    for (const id of selected) {
      if (markers.has(id)) continue;
      const n = byId.get(id);
      if (!n) continue;
      const g = new THREE.Group();
      const cone = new THREE.Mesh(markerGeo, markerMat);
      cone.position.y = 1.45;
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.02;
      g.add(cone, ring);
      g.position.copy(n.pos);
      hall.add(g);
      markers.set(id, g);
    }
  }

  // ---------- Sahna ----------

  const stageW = THREE.MathUtils.clamp(maxChord * 0.7, 12, 26);
  const stageD = 6;
  const stageH = 1.05;
  const apronFront = FOCUS.z + 3.6; // apronning eng oldingi nuqtasi
  const portalZ = apronFront - 2.2; // portal (proscenium) chizig'i
  const backZ = portalZ - stageD;

  // Yoysimon apron + asosiy sahna (yog'och pol)
  const stage = new THREE.Mesh(
    apronGeometry(stageW / 2, apronFront, backZ, stageH),
    [mats.stage, mats.stageSide],
  );
  scene.add(stage);
  // Rampa chiroqlari (apron chetida)
  {
    const R = 22;
    const cz = apronFront - R;
    const lights = [];
    for (let i = 0; i <= 26; i += 1) {
      const x = -stageW / 2 + 0.4 + ((stageW - 0.8) * i) / 26;
      const z = cz + Math.sqrt(R * R - x * x) + 0.01;
      tmpObj.position.set(x, stageH - 0.06, z);
      tmpObj.rotation.set(0, Math.atan2(x, z - cz), 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      lights.push(tmpObj.matrix.clone());
    }
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 0.05, 0.02),
      mats.led,
      lights.length,
    );
    lights.forEach((m, i) => inst.setMatrixAt(i, m));
    scene.add(inst);
  }

  // Sahna orqasidagi banner (afisha)
  const screenW = stageW * 0.62;
  const screenH = screenW * (9 / 16);
  const screenY = stageH + 0.7 + screenH / 2;
  const screenTex = posterTexture(
    options.posterUrl,
    options.title,
    requestRender,
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );
  screen.position.set(0, screenY, backZ + 0.2);
  scene.add(screen);

  // Portal: ustunlar, ustki to'sin, oltin hoshiya
  const portalH = Math.max(screenY + screenH / 2 + 1.4, 7);
  const portalHalf = stageW / 2 - 0.6;
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, portalH, 1.2),
      mats.frame,
    );
    pillar.position.set(side * (portalHalf + 0.7), portalH / 2, portalZ);
    scene.add(pillar);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, portalH - 0.4, 0.08),
      mats.trim,
    );
    trim.position.set(
      side * (portalHalf + 0.02),
      portalH / 2 - 0.2,
      portalZ + 0.62,
    );
    scene.add(trim);
    // Kolonkalar
    const spk = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.6, 0.8),
      mats.black,
    );
    spk.position.set(side * (stageW / 2 - 0.2), stageH + 0.8, apronFront - 1.6);
    spk.rotation.y = side * -0.25;
    scene.add(spk);
  }
  // Sahna qutisining orqa devori — portal balandligida, mavzu rangida
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(stageW + 2.8, portalH),
    mats.frame,
  );
  backWall.position.set(0, portalH / 2, backZ + 0.05);
  scene.add(backWall);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(stageW + 1.6, 1.4, 1.2),
    mats.frame,
  );
  beam.position.set(0, portalH - 0.7, portalZ);
  scene.add(beam);
  const beamTrim = new THREE.Mesh(
    new THREE.BoxGeometry(portalHalf * 2, 0.08, 0.08),
    mats.trim,
  );
  beamTrim.position.set(0, portalH - 1.42, portalZ + 0.62);
  scene.add(beamTrim);

  // Baxmal pardalar: yon tomonlarga yig'ilgan + ustki "valans"
  const curtainH = portalH - 1.4 - stageH;
  for (const side of [-1, 1]) {
    const w = stageW * 0.16;
    const drape = new THREE.Mesh(
      curtainGeometry(w, curtainH, 9, 0.16),
      mats.curtain,
    );
    drape.position.set(
      side * (portalHalf - w / 2 + 0.05),
      stageH + curtainH / 2,
      portalZ - 0.35,
    );
    scene.add(drape);
  }
  const valance = new THREE.Mesh(
    curtainGeometry(portalHalf * 2, 1.1, 28, 0.1),
    mats.curtain,
  );
  valance.position.set(0, portalH - 1.4 - 0.55, portalZ - 0.3);
  scene.add(valance);

  // Yorug'lik fermasi va sahnaga tushayotgan nur konuslari
  const trussY = portalH + 0.8;
  const trussZ = apronFront + 3;
  const truss = new THREE.Mesh(
    new THREE.BoxGeometry(stageW, 0.25, 0.25),
    mats.black,
  );
  truss.position.set(0, trussY, trussZ);
  scene.add(truss);
  // Projektor nurlari: yumshoq gradientli "god ray" — nur o'qi atrofida doim kameraga buriladi,
  // projektor yonida yorqin, pastga qarab kengayib so'nadi (qattiq qirrali konus emas)
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(),
    color: '#ffe6c4',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  /** @type {{ mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3 }[]} */
  const beams = [];
  const target = new THREE.Vector3(0, stageH, portalZ - 1.5);
  for (const x of [
    -stageW * 0.32,
    -stageW * 0.1,
    stageW * 0.1,
    stageW * 0.32,
  ]) {
    const fix = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 0.45, 12),
      mats.black,
    );
    const from = new THREE.Vector3(x, trussY - 0.35, trussZ);
    fix.position.copy(from);
    fix.lookAt(target);
    fix.rotateX(Math.PI / 2);
    scene.add(fix);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), mats.led);
    lens.position.copy(from).lerp(target, 0.25 / from.distanceTo(target));
    lens.lookAt(target);
    lens.rotateY(Math.PI);
    scene.add(lens);
    const to = new THREE.Vector3(x * 0.45, stageH + 0.02, portalZ - 1.2);
    const len = from.distanceTo(to);
    const geo = new THREE.PlaneGeometry(3.2, len);
    geo.translate(0, -len / 2, 0); // yuqori cheti — projektorda
    const mesh = new THREE.Mesh(geo, beamMat);
    mesh.position.copy(from);
    mesh.renderOrder = 2;
    scene.add(mesh);
    beams.push({ mesh, from, to });
  }
  const beamAxis = new THREE.Vector3();
  const beamNormal = new THREE.Vector3();
  const beamSide = new THREE.Vector3();
  const beamBasis = new THREE.Matrix4();
  /** Nur tekisligini o'qi atrofida kameraga burish (silindrik billboard) */
  function orientBeams() {
    for (const b of beams) {
      beamAxis.copy(b.from).sub(b.to).normalize(); // yuqoriga (projektorga) qarab
      beamNormal.copy(camera.position).sub(b.from);
      beamNormal
        .addScaledVector(beamAxis, -beamNormal.dot(beamAxis))
        .normalize();
      beamSide.crossVectors(beamAxis, beamNormal).normalize();
      beamBasis.makeBasis(beamSide, beamAxis, beamNormal);
      b.mesh.quaternion.setFromRotationMatrix(beamBasis);
    }
  }
  // Sahnadagi yorug'lik dog'lari (nur tushgan joy)
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: '#ffdcb0',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  for (const b of beams) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(b.to.x, stageH + 0.015, b.to.z);
    scene.add(pool);
  }
  const spotA = new THREE.SpotLight('#ffd8a8', 70, 45, 0.55, 0.6, 1.3);
  spotA.position.set(-6, trussY, trussZ);
  spotA.target.position.copy(target);
  const spotB = spotA.clone();
  spotB.color.set('#c9b8ff');
  spotB.position.set(6, trussY, trussZ);
  spotB.target.position.copy(target);
  scene.add(spotA, spotA.target, spotB, spotB.target);

  // ---------- Devorlar, eshiklar, chiqish belgilari ----------

  const wallX = Math.max(maxChord / 2 + 3, portalHalf + 2.2);
  const haloMat = new THREE.MeshBasicMaterial({
    map: haloTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const hallBack = FOCUS.z + maxDist + 2.5;
  const wallLen = hallBack - portalZ;
  const wallH = Math.max(portalH + 2, maxY + 6);
  const wallMidZ = (hallBack + portalZ) / 2;
  for (const side of [-1, 1]) {
    const rotY = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(wallLen, wallH),
      mats.wall,
    );
    wall.rotation.y = rotY;
    wall.position.set(side * wallX, wallH / 2, wallMidZ);
    scene.add(wall);
    // Pastki panel (dado)
    const dado = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.2, wallLen),
      mats.dado,
    );
    dado.position.set(side * (wallX - 0.03), 0.6, wallMidZ);
    scene.add(dado);
    // Akustik yog'och reykalar
    const slats = [];
    const count = Math.floor(wallLen / 0.45);
    for (let i = 0; i < count; i += 1) {
      tmpObj.position.set(
        side * (wallX - 0.06),
        1.2 + (wallH - 2.2) / 2,
        portalZ + 0.4 + i * 0.45,
      );
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      slats.push(tmpObj.matrix.clone());
    }
    const slatMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, wallH - 2.2, 0.16),
      mats.panel,
      slats.length,
    );
    slats.forEach((m, i) => slatMesh.setMatrixAt(i, m));
    scene.add(slatMesh);
    // Bra chiroqlari
    for (let i = 0; i < 4; i += 1) {
      const z = apronFront + 2 + i * ((maxDist + 2) / 4);
      const sc = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.5, 0.22),
        mats.sconce,
      );
      sc.position.set(side * (wallX - 0.12), maxY * 0.45 + 2.8, z);
      scene.add(sc);
      // Devordagi yorug' dog' (haqiqiy chiroq o'rniga — telefonlarda ham tez)
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), haloMat);
      halo.rotation.y = rotY;
      halo.position.set(side * (wallX - 0.08), maxY * 0.45 + 2.8, z);
      scene.add(halo);
    }
    // Old tomondagi eshik va "CHIQISH" belgisi (sahna yonida)
    addExit(side * (wallX - 0.04), apronFront + 0.6, rotY);
  }
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(wallX * 2, wallH),
    mats.wall,
  );
  back.rotation.y = Math.PI;
  back.position.set(0, wallH / 2, hallBack);
  scene.add(back);
  for (const side of [-1, 1])
    addExit(side * (wallX - 2), hallBack - 0.04, Math.PI, maxY + 0.2);

  /** @param {number} x @param {number} z @param {number} rotY @param {number} [y0] */
  function addExit(x, z, rotY, y0 = 0) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3), mats.black);
    door.rotation.y = rotY;
    door.position.set(x, y0 + 1.15, z);
    scene.add(door);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.3),
      new THREE.MeshBasicMaterial({ map: exitTexture(), toneMapped: false }),
    );
    sign.rotation.y = rotY;
    sign.position.set(x, y0 + 2.65, z);
    sign.translateZ(0.02);
    scene.add(sign);
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  const stageLook = new THREE.Vector3(0, stageH + 1.6, portalZ - 1.5);

  // ---------- Kamera ----------

  const frontZ = backZ;
  const overviewTarget = new THREE.Vector3(
    0,
    maxY * 0.3 + 1,
    (frontZ + hallBack) / 2 + 1,
  );
  const span = Math.max(hallBack - frontZ, maxChord + 2);
  const box0 = container.getBoundingClientRect();
  const aspect0 = box0.width && box0.height ? box0.width / box0.height : 1.4;
  const overviewDist =
    (span * 1.02 + 3) * (aspect0 < 1 ? Math.pow(1 / aspect0, 0.55) : 1);
  controls.minDistance = 5;
  controls.maxDistance = overviewDist * 1.8;

  /** @param {number} azimuth @param {number} polar @param {number} dist @param {THREE.Vector3} t */
  const spherical = (azimuth, polar, dist, t) =>
    new THREE.Vector3(
      t.x + dist * Math.sin(polar) * Math.sin(azimuth),
      t.y + dist * Math.cos(polar),
      t.z + dist * Math.sin(polar) * Math.cos(azimuth),
    );

  /** @type {null | { from: THREE.Vector3, to: THREE.Vector3, fromT: THREE.Vector3, toT: THREE.Vector3, fromFov: number, toFov: number, start: number, ms: number, done?: () => void }} */
  let tween = null;
  /** @type {'hall' | 'seat'} */
  let mode = 'hall';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @param {THREE.Vector3} pos @param {THREE.Vector3} t @param {number} fov @param {number} ms @param {() => void} [done] */
  function flyTo(pos, t, fov, ms, done) {
    tween = {
      from: camera.position.clone(),
      to: pos,
      fromT: controls.target.clone(),
      toT: t,
      fromFov: camera.fov,
      toFov: fov,
      start: performance.now(),
      ms: reduced ? 1 : ms,
      done,
    };
    requestRender();
  }

  function overview() {
    setMode('hall');
    flyTo(
      spherical(0.12, 0.98, overviewDist, overviewTarget),
      overviewTarget.clone(),
      42,
      1100,
    );
  }

  function topView() {
    setMode('hall');
    const t = overviewTarget.clone();
    t.z = (frontZ + hallBack) / 2;
    flyTo(spherical(0, 0.18, overviewDist * 1.05, t), t, 42, 1100);
  }

  // O'rindiq rejimi: kamera joyida, yaw/pitch bilan atrofga qaraladi, fov bilan yaqinlashtiriladi
  const look = {
    yaw: 0,
    pitch: 0,
    tYaw: 0,
    tPitch: 0,
    baseYaw: 0,
    fov: 58,
    tFov: 58,
  };
  const eye = new THREE.Vector3();
  const lookDir = new THREE.Vector3();

  /** @param {string} id */
  function viewFromSeat(id) {
    const n = byId.get(id);
    if (!n) return;
    const prev = seated;
    seated = n;
    if (prev) repaint(prev);
    repaint(n);
    eye.copy(n.pos);
    eye.y += EYE;
    eye.x += Math.sin(n.rot) * 0.06; // suyanchiqdan biroz oldinda
    eye.z += Math.cos(n.rot) * 0.06;
    const toStage = stageLook.clone().sub(eye);
    look.baseYaw = Math.atan2(toStage.x, toStage.z);
    look.yaw = look.tYaw = 0;
    look.pitch = look.tPitch = Math.atan2(
      toStage.y,
      Math.hypot(toStage.x, toStage.z),
    );
    look.fov = look.tFov = 58;
    setMode('seat', n);
    hideTip();
    flyTo(eye.clone(), stageLook.clone(), 58, 1400, () => {
      container.dataset.seatReady = 'true';
    });
  }

  /** @param {'hall' | 'seat'} next @param {SeatNode} [seat] */
  function setMode(next, seat) {
    if (next === 'hall' && seated) {
      const prev = seated;
      seated = null;
      repaint(prev);
    }
    mode = next;
    controls.enabled = next === 'hall';
    container.dataset.mode = next;
    delete container.dataset.seatReady;
    overlay.hidden = next === 'seat';
    for (const [id, m] of markers)
      m.visible = !(next === 'seat' && seated?.id === id);
    options.onModeChange?.(next, seat);
  }

  camera.position.copy(
    spherical(0.9, 0.62, overviewDist * 1.7, overviewTarget),
  );
  controls.target.copy(overviewTarget);
  camera.lookAt(overviewTarget);
  setMode('hall');
  flyTo(
    spherical(0.12, 0.98, overviewDist, overviewTarget),
    overviewTarget.clone(),
    42,
    2000,
  );

  // ---------- Render ----------

  let raf = 0;
  let width = 0;
  let height = 0;
  const projected = new THREE.Vector3();

  function resize() {
    const r = container.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /** @param {number} t */
  const ease = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /** @param {number} now */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    let changed = false;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.ms);
      const k = ease(t);
      camera.position.lerpVectors(tween.from, tween.to, k);
      controls.target.lerpVectors(tween.fromT, tween.toT, k);
      camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * k;
      camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      changed = true;
      if (t >= 1) {
        const done = tween.done;
        tween = null;
        done?.();
      }
    } else if (mode === 'seat') {
      // Silliq (inersiyali) qarash
      const dy = look.tYaw - look.yaw;
      const dp = look.tPitch - look.pitch;
      const df = look.tFov - look.fov;
      if (Math.abs(dy) + Math.abs(dp) + Math.abs(df) > 1e-4 || needsRender) {
        look.yaw += dy * 0.18;
        look.pitch += dp * 0.18;
        look.fov += df * 0.18;
        const a = look.baseYaw + look.yaw;
        lookDir.set(
          Math.sin(a) * Math.cos(look.pitch),
          Math.sin(look.pitch),
          Math.cos(a) * Math.cos(look.pitch),
        );
        camera.position.copy(eye);
        camera.lookAt(eye.clone().add(lookDir));
        if (Math.abs(camera.fov - look.fov) > 0.01) {
          camera.fov = look.fov;
          camera.updateProjectionMatrix();
        }
        changed = true;
      }
    } else if (controls.enabled) {
      changed = controls.update();
    }
    if (markers.size) {
      const bob = Math.sin(now / 380) * 0.08;
      for (const m of markers.values()) {
        m.children[0].position.y = 1.45 + bob;
        m.children[0].rotation.y = now / 700;
      }
      changed = true;
    }
    if (changed || needsRender) {
      orientBeams();
      renderer.render(scene, camera);
      updateLabels();
      needsRender = false;
    }
  }
  raf = requestAnimationFrame(frame);

  function updateLabels() {
    if (mode === 'seat') return;
    for (const l of labels) {
      projected.copy(l.pos).project(camera);
      const visible =
        projected.z < 1 &&
        Math.abs(projected.x) < 1.1 &&
        Math.abs(projected.y) < 1.1;
      l.el.style.opacity = visible ? '1' : '0';
      if (visible) {
        const x = THREE.MathUtils.clamp(
          ((projected.x + 1) / 2) * width,
          64,
          width - 64,
        );
        const y = THREE.MathUtils.clamp(
          ((1 - projected.y) / 2) * height,
          60,
          height - 8,
        );
        l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      }
    }
  }

  // ---------- Kursor, bosish va o'rindiq rejimida qarash ----------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  /** @type {{ x: number, y: number, t: number, id: number } | null} */
  let down = null;
  let hoverQueued = false;
  /** @type {PointerEvent | null} */
  let lastMove = null;
  /** @type {Map<number, { x: number, y: number }>} */
  const touches = new Map();
  let pinchDist = 0;

  /** @param {number} clientX @param {number} clientY @returns {SeatNode | null} */
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([upholstery, frames], false)[0];
    return hit && hit.instanceId !== undefined
      ? (nodes[hit.instanceId] ?? null)
      : null;
  }

  /** @param {SeatNode | null} n */
  function setHover(n) {
    if (hovered === n) return;
    const prev = hovered;
    hovered = n;
    if (prev) repaint(prev);
    if (n) repaint(n);
    canvas.style.cursor = n
      ? n.status === 'FREE'
        ? 'pointer'
        : 'not-allowed'
      : '';
    requestRender();
  }

  function hideTip() {
    tooltip.hidden = true;
    setHover(null);
  }

  /** @param {SeatNode} n @param {number} clientX @param {number} clientY */
  function showTip(n, clientX, clientY) {
    const r = container.getBoundingClientRect();
    const status = selected.has(n.id)
      ? 'Tanlangan — bosib bekor qiling'
      : n.status === 'FREE'
        ? "Bo'sh — bosib tanlang"
        : n.status === 'HELD'
          ? 'Band qilingan'
          : 'Sotilgan';
    tooltip.replaceChildren();
    const head = document.createElement('b');
    head.textContent = `${n.row}-qator, ${n.num}-o'rin`;
    const sub = document.createElement('span');
    sub.textContent = `${n.sector} · ${fmt.price(n.price)}`;
    const st = document.createElement('em');
    st.textContent = status;
    st.dataset.status = selected.has(n.id) ? 'SEL' : n.status;
    tooltip.append(head, sub, st);
    tooltip.hidden = false;
    const x = Math.min(clientX - r.left + 16, r.width - 200);
    const y = Math.max(clientY - r.top - 12, 8);
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** @param {number} dx @param {number} dy */
  function lookBy(dx, dy) {
    const k = (look.tFov / 58) * 0.0042; // yaqinlashtirilganda sekinroq aylanadi
    look.tYaw = THREE.MathUtils.clamp(look.tYaw - dx * k, -2.4, 2.4);
    look.tPitch = THREE.MathUtils.clamp(look.tPitch + dy * k, -0.75, 0.6);
    requestRender();
  }
  /** @param {number} delta */
  function zoomBy(delta) {
    look.tFov = THREE.MathUtils.clamp(look.tFov + delta, 22, 75);
    requestRender();
  }

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    down = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      id: e.pointerId,
    };
    if (mode === 'seat') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      container.classList.add('dragging');
    }
  }
  /** @param {PointerEvent} e */
  function onPointerUp(e) {
    if (mode === 'seat') {
      touches.delete(e.pointerId);
      if (!touches.size) container.classList.remove('dragging');
      down = null;
      return;
    }
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 7 || !quick) return;
    const n = pick(e.clientX, e.clientY);
    if (n) {
      options.onToggle(n.id);
      if (e.pointerType === 'mouse') showTip(n, e.clientX, e.clientY);
    }
  }
  /** @param {PointerEvent} e */
  function onPointerMove(e) {
    if (mode === 'seat') {
      const prev = touches.get(e.pointerId);
      if (!prev || tween) return;
      if (touches.size === 2) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...touches.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        zoomBy((pinchDist - dist) * 0.12);
        pinchDist = dist;
        return;
      }
      lookBy(e.clientX - prev.x, e.clientY - prev.y);
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    if (e.pointerType !== 'mouse') return;
    if (e.buttons) {
      hideTip();
      return;
    }
    lastMove = e;
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      if (!lastMove || mode !== 'hall') return;
      const n = pick(lastMove.clientX, lastMove.clientY);
      setHover(n);
      if (n) showTip(n, lastMove.clientX, lastMove.clientY);
      else tooltip.hidden = true;
    });
  }
  /** @param {WheelEvent} e */
  function onWheel(e) {
    if (mode !== 'seat') return;
    e.preventDefault();
    zoomBy(e.deltaY * 0.03);
  }
  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (mode !== 'seat') return;
    const step = 22;
    const keys = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const k = /** @type {Record<string, number[]>} */ (keys)[e.key];
    if (k) {
      e.preventDefault();
      lookBy(-k[0], k[1]);
    } else if (e.key === '+' || e.key === '=') zoomBy(-5);
    else if (e.key === '-') zoomBy(5);
  }
  function onLeave() {
    lastMove = null;
    if (mode === 'hall') hideTip();
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  controls.addEventListener('start', () => {
    tooltip.hidden = true;
    tween = null;
  });

  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  applyTheme();

  return {
    setStatuses(statuses) {
      for (const n of nodes) {
        const s = statuses.get(n.id);
        if (s) n.status = s;
      }
      paintAll();
      requestRender();
    },
    setSelected(ids) {
      selected = new Set(ids);
      paintAll();
      for (const [id, m] of markers)
        m.visible = !(mode === 'seat' && seated?.id === id);
      requestRender();
    },
    viewFromSeat,
    overview,
    topView,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const mesh = /** @type {THREE.Mesh} */ (o);
        mesh.geometry?.dispose();
      });
      canvas.remove();
      overlay.remove();
      tooltip.remove();
    },
  };
}

// ---------- Geometriya ----------

/**
 * Yoysimon pog'ona (FOCUS markazli halqa bo'lagi). Material guruhlari: 0 — ust/ost, 1 — yon yuzalar.
 * @param {number} rIn @param {number} rOut @param {number} theta @param {number} height @param {number} bottom
 */
function annulus(rIn, rOut, theta, height, bottom) {
  const shape = new THREE.Shape();
  const a0 = -Math.PI / 2 - theta;
  const a1 = -Math.PI / 2 + theta;
  shape.absarc(0, 0, rOut, a0, a1, false);
  shape.lineTo(rIn * Math.cos(a1), rIn * Math.sin(a1));
  shape.absarc(0, 0, rIn, a1, a0, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height, 0.02),
    bevelEnabled: false,
    curveSegments: Math.max(16, Math.round(theta * 48)),
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(FOCUS.x, bottom, FOCUS.z);
  return geo;
}

/**
 * Sahna: old tomoni yoysimon apron, orqasi to'g'ri.
 * @param {number} halfW @param {number} frontZ @param {number} backZ @param {number} height
 */
function apronGeometry(halfW, frontZ, backZ, height) {
  const R = 22;
  const cz = frontZ - R;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -backZ);
  const steps = 40;
  for (let i = 0; i <= steps; i += 1) {
    const x = -halfW + (2 * halfW * i) / steps;
    const z = cz + Math.sqrt(R * R - x * x);
    shape.lineTo(x, -z);
  }
  shape.lineTo(halfW, -backZ);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** O'tiradigan joy va suyanchiq (old tomoni -Z, ya'ni sahnaga) */
function chairUpholstery() {
  const seat = new THREE.RoundedBoxGeometry(0.46, 0.11, 0.46, 3, 0.045);
  seat.translate(0, 0.44, -0.04);
  const back = new THREE.RoundedBoxGeometry(0.46, 0.6, 0.1, 3, 0.045);
  back.rotateX(-0.16);
  back.translate(0, 0.8, 0.22);
  return THREE.mergeGeometries([seat, back], false) ?? seat;
}

/** Karkas: ikki yon tirgak + qo'ltiqtayanchlar */
function chairFrame() {
  const parts = [];
  for (const side of [-1, 1]) {
    const stand = new THREE.RoundedBoxGeometry(0.045, 0.62, 0.5, 1, 0.015);
    stand.translate(side * 0.255, 0.31, 0.02);
    const arm = new THREE.RoundedBoxGeometry(0.06, 0.04, 0.44, 1, 0.015);
    arm.translate(side * 0.255, 0.64, -0.02);
    parts.push(stand, arm);
  }
  return THREE.mergeGeometries(parts, false) ?? parts[0];
}

/**
 * Baxmal parda: burmalar sinus bilan, chetlari ozgina "og'irroq".
 * @param {number} w @param {number} h @param {number} folds @param {number} depth
 */
function curtainGeometry(w, h, folds, depth) {
  const geo = new THREE.PlaneGeometry(w, h, Math.max(24, folds * 8), 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const u = (x / w + 0.5) * folds * Math.PI * 2;
    pos.setZ(i, Math.sin(u) * depth + Math.sin(u * 2.3) * depth * 0.25);
  }
  geo.computeVertexNormals();
  return geo;
}

/** @param {THREE.Vector3} a @param {THREE.Vector3} b @param {number} r @param {THREE.Material} mat */
function tube(a, b, r, mat) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r, r, len, 10);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  return mesh;
}

// ---------- Teksturalar ----------

/** Sahna poli: yog'och taxtalar */
function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  const plank = 512 / 8;
  for (let i = 0; i < 8; i += 1) {
    const shade = 200 + Math.round(Math.random() * 40);
    ctx.fillStyle = `rgb(${shade},${shade - 12},${shade - 28})`;
    ctx.fillRect(0, i * plank, 512, plank - 2);
    ctx.strokeStyle = 'rgba(80,50,30,0.12)';
    for (let g = 0; g < 6; g += 1) {
      ctx.beginPath();
      const y = i * plank + 6 + Math.random() * (plank - 12);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + 4, 340, y - 4, 512, y + 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,25,15,0.35)';
    ctx.fillRect((i % 2) * 256 + 120, i * plank, 2, plank - 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.18, 0.18);
  return tex;
}

/** Nur: o'qi bo'ylab so'nadi, chetlari Gauss bo'yicha yumshoq, pastga qarab kengayadi */
function beamTexture() {
  const W = 128;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y += 1) {
    const t = y / (H - 1); // 0 — projektor, 1 — sahna
    const spread = 0.12 + 0.88 * t; // nur kengligi
    const along =
      Math.pow(1 - t, 1.6) * 0.85 +
      0.15 * Math.exp(-Math.pow((t - 0.95) / 0.05, 2));
    for (let x = 0; x < W; x += 1) {
      const u = (x / (W - 1)) * 2 - 1;
      const across = Math.exp(-Math.pow(u / (spread * 0.55), 2) * 2.2);
      const a = Math.min(1, along * across * (0.35 + 0.65 / (0.4 + spread)));
      const i = (y * W + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sahnadagi yorug'lik dog'i (oval, chetlari yumshoq) */
function poolTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Bra atrofidagi iliq yorug'lik dog'i */
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 192;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const g = ctx.createRadialGradient(64, 96, 4, 64, 96, 90);
  g.addColorStop(0, 'rgba(255,200,130,0.55)');
  g.addColorStop(0.4, 'rgba(255,170,90,0.18)');
  g.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 192);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @type {THREE.CanvasTexture | null} */
let exitTex = null;
/** Yashil "CHIQISH" belgisi */
function exitTexture() {
  if (exitTex) return exitTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 86;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.fillStyle = '#0a8a3a';
  ctx.fillRect(0, 0, 256, 86);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px Manrope, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHIQISH', 128, 46);
  exitTex = new THREE.CanvasTexture(c);
  exitTex.colorSpace = THREE.SRGBColorSpace;
  return exitTex;
}

/**
 * Sahna banneri: afisha (xiralashtirilgan fon + markazda afisha) va tadbir nomi.
 * @param {string} url @param {string} title @param {() => void} onReady
 */
function posterTexture(url, title, onReady) {
  const W = 1280;
  const H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  /** @param {HTMLImageElement | null} img */
  const draw = (img) => {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a0f2e');
    g.addColorStop(1, '#3a0d1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (img) {
      const s = Math.max(W / img.width, H / img.height) * 1.15;
      ctx.save();
      ctx.filter = 'blur(28px) brightness(0.55) saturate(1.3)';
      ctx.drawImage(
        img,
        (W - img.width * s) / 2,
        (H - img.height * s) / 2,
        img.width * s,
        img.height * s,
      );
      ctx.restore();
      const ph = H * 0.78;
      const pw = ph * 0.75;
      const px = W * 0.66 - pw / 2;
      const py = (H - ph) / 2;
      const cs = Math.max(pw / img.width, ph / img.height);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 26);
      ctx.clip();
      ctx.drawImage(
        img,
        px + (pw - img.width * cs) / 2,
        py + (ph - img.height * cs) / 2,
        img.width * cs,
        img.height * cs,
      );
      ctx.restore();
    }
    ctx.fillStyle = '#ff6a4a';
    ctx.font = '700 30px Manrope, system-ui, sans-serif';
    ctx.fillText('BUGUN SAHNADA', 80, H * 0.36);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 64px "Bricolage Grotesque", Manrope, system-ui, sans-serif';
    wrapText(ctx, title, 80, H * 0.36 + 80, W * 0.42, 70, 4);
    tex.needsUpdate = true;
    onReady();
  };
  draw(null);
  if (url) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => draw(img);
    img.src = url;
  }
  return tex;
}

/**
 * @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} x @param {number} y
 * @param {number} maxW @param {number} lh @param {number} maxLines
 */
function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lh);
      lines += 1;
      line = w;
      if (lines >= maxLines - 1) break;
    } else line = test;
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lh);
}
