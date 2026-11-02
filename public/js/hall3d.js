// @ts-check
// 3D zal (Three.js): yoysimon qatorlar, ko'tarilib boruvchi pog'onalar, sahna va ekranda afisha.
// O'rindiqni bosish — tanlash; "joydan ko'rinish" — kamera o'sha o'rindiqqa o'tirib sahnaga qaraydi.
// Faqat ko'rinish qatlami: holat (tanlov, band joylar) seats.js da, bu yerga set* orqali beriladi.

import * as THREE from '../vendor/three.js';
import * as fmt from './format.js';

/** @typedef {import('./types.js').SeatMap} SeatMap */
/** @typedef {import('./types.js').SeatStatus} SeatStatus */

/**
 * @typedef {object} SeatNode
 * @property {string} id
 * @property {number} index         InstancedMesh ichidagi tartib raqami
 * @property {string} sector
 * @property {number} sectorIndex
 * @property {number} row
 * @property {number} num
 * @property {number} price
 * @property {SeatStatus} status
 * @property {THREE.Vector3} pos    o'rindiq asosi (dunyo koordinatasi)
 * @property {number} rot           Y o'qi bo'yicha burilish (sahnaga qaragan)
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

// Sektor ranglari: oldingi (qimmat) sektordan boshlab
export const SECTOR_COLORS = {
  dark: ['#f5b84a', '#ff6b5a', '#8b73ff', '#2ec5ff', '#3ddc97', '#ff4d93'],
  light: ['#e59a1c', '#ff5640', '#6c4dff', '#0ea5e9', '#10a36a', '#ff2e7e'],
};

const THEMES = {
  dark: {
    bg: '#07070c',
    floor: '#0b0b13',
    riser: '#181823',
    frame: '#12121b',
    stage: '#1c1c28',
    wall: '#09090f',
    sold: '#30303d',
    held: '#6d5a26',
    selected: '#ffffff',
    fog: [26, 90],
    ambient: 0.55,
    hemi: 0.5,
  },
  light: {
    bg: '#eceef5',
    floor: '#e2e5ee',
    riser: '#d3d7e2',
    frame: '#c4c9d6',
    stage: '#cfd3de',
    wall: '#e6e8f0',
    sold: '#b6bac8',
    held: '#f0cf86',
    selected: '#0e0f1a',
    fog: [40, 120],
    ambient: 0.9,
    hemi: 0.7,
  },
};

const SEAT_GAP = 0.66; // o'rindiqlar orasidagi masofa (yoy bo'yicha)
const ROW_GAP = 0.98; // qatorlar orasidagi masofa
const RAKE = 0.2; // har qatorda ko'tarilish
const FIRST_ROW = 7.5; // sahna markazidan birinchi qatorgacha
const SECTOR_GAP = 1.5; // sektorlar orasidagi yo'lak
const FOCUS = new THREE.Vector3(0, 0, -3); // qatorlar yoyining markazi (sahna o'rtasi)
const BALCONY = /balkon|beletaj|loja|amfiteatr|yarus|lodge|balcony/i;

const EYE = 1.08; // o'tirgan odam ko'zi balandligi

/**
 * @param {{
 *   container: HTMLElement,
 *   map: SeatMap,
 *   posterUrl: string,
 *   title: string,
 *   onToggle: (seatId: string) => void,
 *   onModeChange?: (mode: 'hall' | 'seat', seat?: SeatNode) => void,
 * }} options
 * @returns {Hall3D | null} WebGL bo'lmasa null
 */
export function createHall3D(options) {
  const { container, map } = options;

  /** @type {THREE.WebGLRenderer} */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
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
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = Math.PI * 0.08;

  // ---------- Mavzu ----------

  const themeName = () =>
    document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light';
  let theme = THEMES[themeName()];
  let sectorPalette = SECTOR_COLORS[themeName()];

  const floorMat = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0,
  });
  const riserMat = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    metalness: 0.05,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0.2,
  });
  const stageMat = new THREE.MeshStandardMaterial({
    roughness: 0.45,
    metalness: 0.15,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    roughness: 0.55,
    metalness: 0.05,
  });
  /** @type {THREE.MeshStandardMaterial[]} */
  const wallMats = [];

  const ambient = new THREE.AmbientLight('#ffffff', 0.5);
  const hemi = new THREE.HemisphereLight('#c9d4ff', '#2a1d18', 0.5);
  const key = new THREE.DirectionalLight('#ffffff', 1.1);
  key.position.set(6, 22, 18);
  scene.add(ambient, hemi, key);

  function applyTheme() {
    theme = THEMES[themeName()];
    sectorPalette = SECTOR_COLORS[themeName()];
    scene.background = new THREE.Color(theme.bg);
    scene.fog = new THREE.Fog(theme.bg, theme.fog[0], theme.fog[1]);
    floorMat.color.set(theme.floor);
    riserMat.color.set(theme.riser);
    frameMat.color.set(theme.frame);
    stageMat.color.set(theme.stage);
    for (const m of wallMats) m.color.set(theme.wall);
    ambient.intensity = theme.ambient;
    hemi.intensity = theme.hemi;
    for (const { mesh, sectorIndex } of sectorEdges) {
      /** @type {THREE.MeshBasicMaterial} */ (mesh.material).color.set(
        sectorColor(sectorIndex),
      );
    }
    paintAll();
    requestRender();
  }

  /** @param {number} i */
  const sectorColor = (i) => sectorPalette[i % sectorPalette.length];

  // ---------- Joylashuv ----------

  /** @type {SeatNode[]} */
  const nodes = [];
  /** @type {Map<string, SeatNode>} */
  const byId = new Map();
  /** @type {{ name: string, price: number, index: number, pos: THREE.Vector3, el: HTMLElement }[]} */
  const labels = [];
  /** @type {{ mesh: THREE.Mesh, sectorIndex: number }[]} */
  const sectorEdges = [];

  let maxChord = 10;
  let maxDist = FIRST_ROW;
  let maxY = 0;
  let distance = FIRST_ROW;
  let base = 0;
  const hall = new THREE.Group();
  scene.add(hall);

  map.sectors.forEach((sector, si) => {
    const balcony = si > 0 && BALCONY.test(sector.sectorName);
    if (si > 0) {
      distance += SECTOR_GAP;
      base += balcony ? 2.6 : 0.45;
    }
    const rows = [...sector.rows].sort((a, b) => a.number - b.number);
    const sectorStart = distance;
    let lastY = base;
    let widest = 0;

    rows.forEach((row, ri) => {
      const d = distance + ri * ROW_GAP;
      const y = base + ri * RAKE + (si === 0 && !balcony ? 0 : 0.25);
      const seats = [...row.seats].sort((a, b) => a.number - b.number);
      const step = SEAT_GAP / d;
      const theta = ((seats.length - 1) / 2) * step;
      widest = Math.max(widest, theta);
      maxChord = Math.max(maxChord, 2 * d * Math.sin(theta));

      seats.forEach((seat, k) => {
        const phi = -theta + k * step;
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

      // Qator pog'onasi (yoysimon)
      const margin = 0.55 / d;
      const bottom = balcony ? y - 0.55 : 0;
      const riser = annulus(
        d - ROW_GAP / 2,
        d + ROW_GAP / 2,
        theta + margin,
        y - bottom,
        bottom,
      );
      const mesh = new THREE.Mesh(riser, riserMat);
      hall.add(mesh);
      lastY = y;
      maxY = Math.max(maxY, y);
    });

    const end = distance + (rows.length - 1) * ROW_GAP;
    // Sektorning old chetida ingichka yorug' chiziq — sektor rangi
    const edgeD = sectorStart - ROW_GAP / 2 - 0.06;
    const edge = new THREE.Mesh(
      annulus(
        edgeD - 0.05,
        edgeD + 0.05,
        widest + 0.55 / sectorStart,
        0.04,
        (balcony ? base + 0.25 : base) + 0.02,
      ),
      new THREE.MeshBasicMaterial({ color: sectorColor(si) }),
    );
    hall.add(edge);
    sectorEdges.push({ mesh: edge, sectorIndex: si });

    if (balcony) {
      // Balkon parapeti
      const wall = annulus(
        edgeD - 0.12,
        edgeD + 0.02,
        widest + 0.6 / sectorStart,
        0.7,
        base + 0.25 - 0.55,
      );
      hall.add(new THREE.Mesh(wall, frameMat));
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
    // Yorliq sektorning yon chetida (chap/o'ng navbatma-navbat) — bir-birini to'smaydi
    const midD = (sectorStart + end) / 2;
    const side = si % 2 === 0 ? 1 : -1;
    const ang = side * (widest + 0.9 / midD);
    labels.push({
      name: sector.sectorName,
      price: Number(sector.price),
      index: si,
      pos: new THREE.Vector3(
        FOCUS.x + midD * Math.sin(ang),
        (base + lastY) / 2 + 1.3,
        FOCUS.z + midD * Math.cos(ang),
      ),
      el,
    });

    maxDist = end;
    distance = end + ROW_GAP;
  });

  // ---------- O'rindiqlar (bitta InstancedMesh) ----------

  const chair = chairGeometry();
  const seatsMesh = new THREE.InstancedMesh(
    chair,
    seatMat,
    Math.max(nodes.length, 1),
  );
  seatsMesh.count = nodes.length;
  hall.add(seatsMesh);
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  /** @type {Set<string>} */
  let selected = new Set();
  /** @type {SeatNode | null} */
  let hovered = null;

  /** @param {SeatNode} n */
  function placeSeat(n) {
    const scale = hovered === n ? 1.22 : selected.has(n.id) ? 1.1 : 1;
    dummy.position.copy(n.pos);
    dummy.rotation.set(0, n.rot, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    seatsMesh.setMatrixAt(n.index, dummy.matrix);
  }

  /** @param {SeatNode} n */
  function colorSeat(n) {
    if (selected.has(n.id)) tmpColor.set(theme.selected);
    else if (n.status === 'SOLD') tmpColor.set(theme.sold);
    else if (n.status === 'HELD') tmpColor.set(theme.held);
    else {
      tmpColor.set(sectorColor(n.sectorIndex));
      if (hovered === n) tmpColor.lerp(new THREE.Color('#ffffff'), 0.35);
    }
    seatsMesh.setColorAt(n.index, tmpColor);
  }

  function paintAll() {
    for (const n of nodes) {
      placeSeat(n);
      colorSeat(n);
    }
    seatsMesh.instanceMatrix.needsUpdate = true;
    if (seatsMesh.instanceColor) seatsMesh.instanceColor.needsUpdate = true;
    syncMarkers();
  }

  /** @param {SeatNode} n */
  function repaint(n) {
    placeSeat(n);
    colorSeat(n);
    seatsMesh.instanceMatrix.needsUpdate = true;
    if (seatsMesh.instanceColor) seatsMesh.instanceColor.needsUpdate = true;
  }

  // Tanlangan o'rindiqlar ustida suzib turuvchi belgi
  const markerGeo = new THREE.ConeGeometry(0.16, 0.36, 18);
  markerGeo.rotateX(Math.PI);
  const markerMat = new THREE.MeshStandardMaterial({
    color: '#ff4d2e',
    emissive: '#ff2e7e',
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  const ringGeo = new THREE.RingGeometry(0.34, 0.42, 32);
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
      cone.position.y = 1.35;
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.03;
      g.add(cone, ring);
      g.position.copy(n.pos);
      hall.add(g);
      markers.set(id, g);
    }
  }

  // ---------- Sahna ----------

  const stageW = THREE.MathUtils.clamp(maxChord * 0.72, 11, 24);
  const stageD = 5.2;
  const stageH = 1.1;
  const stageFront = FOCUS.z + 3.6;
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(stageW, stageH, stageD),
    stageMat,
  );
  stage.position.set(0, stageH / 2, stageFront - stageD / 2);
  scene.add(stage);

  const edgeStrip = new THREE.Mesh(
    new THREE.BoxGeometry(stageW, 0.07, 0.06),
    new THREE.MeshBasicMaterial({ color: '#ff4d2e' }),
  );
  edgeStrip.position.set(0, stageH - 0.03, stageFront + 0.01);
  scene.add(edgeStrip);

  const screenW = stageW * 0.82;
  const screenH = screenW * (9 / 16);
  const screenY = stageH + 0.6 + screenH / 2;
  const screenZ = stageFront - stageD + 0.15;
  const screenTex = posterTexture(options.posterUrl, options.title, () =>
    requestRender(),
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );
  screen.position.set(0, screenY, screenZ);
  scene.add(screen);

  // Sahna ramkasi (proscenium)
  const portalH = screenY + screenH / 2 + 1.2;
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, portalH, 1),
      frameMat,
    );
    pillar.position.set(
      side * (stageW / 2 + 0.4),
      portalH / 2,
      stageFront - 0.8,
    );
    scene.add(pillar);
  }
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(stageW + 1.6, 1, 1),
    frameMat,
  );
  beam.position.set(0, portalH - 0.5, stageFront - 0.8);
  scene.add(beam);

  const spotA = new THREE.SpotLight('#ffd6a8', 60, 40, 0.5, 0.6, 1.4);
  spotA.position.set(-5, portalH + 3, stageFront + 6);
  spotA.target.position.set(0, stageH, stageFront - stageD / 2);
  const spotB = spotA.clone();
  spotB.color.set('#b9a8ff');
  spotB.position.set(5, portalH + 3, stageFront + 6);
  spotB.target.position.copy(spotA.target.position);
  scene.add(spotA, spotA.target, spotB, spotB.target);

  // Zal devorlari: faqat ichki tomoni chiziladi (tashqaridan kamera "ko'radi" — to'smaydi)
  const wallMat = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0,
  });
  wallMats.push(wallMat);
  const wallX = Math.max(maxChord / 2 + 3.5, stageW / 2 + 2.5);
  const wallLen = maxDist + 12;
  const wallH = Math.max(portalH + 1.5, maxY + 5);
  const wallZ = (stageFront - stageD - 1 + FOCUS.z + maxDist + 3) / 2;
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(wallLen, wallH),
      wallMat,
    );
    wall.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * wallX, wallH / 2, wallZ);
    scene.add(wall);
    // vertikal yorug' chiziqlar (bra)
    for (let i = 0; i < 5; i += 1) {
      const z = stageFront + 2 + i * ((maxDist + 4) / 5);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 2.4),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? '#8b73ff' : '#ff6a4a',
          toneMapped: false,
        }),
      );
      strip.rotation.y = wall.rotation.y;
      strip.position.set(side * (wallX - 0.02), maxY * 0.5 + 2.6, z);
      scene.add(strip);
      const glow = new THREE.PointLight(
        i % 2 ? '#8b73ff' : '#ff6a4a',
        2.2,
        7,
        2,
      );
      glow.position.set(side * (wallX - 0.8), maxY * 0.5 + 2.6, z);
      scene.add(glow);
    }
  }
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(wallX * 2, wallH),
    wallMat,
  );
  backWall.rotation.y = Math.PI;
  backWall.position.set(0, wallH / 2, FOCUS.z + maxDist + 3);
  scene.add(backWall);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  const stageLook = new THREE.Vector3(
    0,
    stageH + screenH * 0.42,
    stageFront - stageD / 2,
  );

  // ---------- Kamera ----------

  const backZ = FOCUS.z + maxDist + 1;
  const frontZ = stageFront - stageD;
  const overviewTarget = new THREE.Vector3(
    0,
    maxY * 0.3 + 1,
    (frontZ + backZ) / 2 + 1,
  );
  const span = Math.max(backZ - frontZ, maxChord + 2);
  const box0 = container.getBoundingClientRect();
  const aspect0 = box0.width && box0.height ? box0.width / box0.height : 1.4;
  // Tor (mobil) ekranda zal kengligi sig'ishi uchun kamera uzoqroqda
  const overviewDist =
    (span * 1.08 + 3) * (aspect0 < 1 ? Math.pow(1 / aspect0, 0.55) : 1);
  controls.minDistance = 6;
  controls.maxDistance = overviewDist * 1.8;

  /** @param {number} azimuth @param {number} polar @param {number} dist @param {THREE.Vector3} target */
  function spherical(azimuth, polar, dist, target) {
    return new THREE.Vector3(
      target.x + dist * Math.sin(polar) * Math.sin(azimuth),
      target.y + dist * Math.cos(polar),
      target.z + dist * Math.sin(polar) * Math.cos(azimuth),
    );
  }

  /** @type {null | { from: THREE.Vector3, to: THREE.Vector3, fromT: THREE.Vector3, toT: THREE.Vector3, fromFov: number, toFov: number, start: number, ms: number, done?: () => void }} */
  let tween = null;
  /** @type {'hall' | 'seat'} */
  let mode = 'hall';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @param {THREE.Vector3} pos @param {THREE.Vector3} target @param {number} fov @param {number} ms @param {() => void} [done] */
  function flyTo(pos, target, fov, ms, done) {
    tween = {
      from: camera.position.clone(),
      to: pos,
      fromT: controls.target.clone(),
      toT: target,
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
    t.z = (stageFront + FOCUS.z + maxDist) / 2;
    flyTo(spherical(0, 0.2, overviewDist * 1.05, t), t, 42, 1100);
  }

  /** @param {string} id */
  function viewFromSeat(id) {
    const n = byId.get(id);
    if (!n) return;
    const eye = n.pos.clone();
    eye.y += EYE;
    // ko'z o'rindiq suyanchig'idan biroz oldinda
    eye.x -= Math.sin(n.rot) * 0.05;
    eye.z -= Math.cos(n.rot) * 0.05;
    setMode('seat', n);
    hideTip();
    flyTo(eye, stageLook.clone(), 58, 1400);
  }

  /** @param {'hall' | 'seat'} next @param {SeatNode} [seat] */
  function setMode(next, seat) {
    mode = next;
    controls.enabled = next === 'hall';
    container.dataset.mode = next;
    overlay.hidden = next === 'seat';
    options.onModeChange?.(next, seat);
  }

  // Kirish animatsiyasi: zal uzoqdan va yon tomondan "uchib" keladi
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

  function requestRender() {
    needsRender = true;
  }

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
    } else if (controls.enabled) {
      changed = controls.update();
    }
    if (markers.size) {
      const bob = Math.sin(now / 380) * 0.08;
      for (const m of markers.values()) {
        m.children[0].position.y = 1.35 + bob;
        m.children[0].rotation.y = now / 700;
      }
      changed = true;
    }
    if (changed || needsRender) {
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

  // ---------- Kursor va bosish ----------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  /** @type {{ x: number, y: number, t: number, id: number } | null} */
  let down = null;
  let hoverQueued = false;
  /** @type {PointerEvent | null} */
  let lastMove = null;

  /** @param {number} clientX @param {number} clientY @returns {SeatNode | null} */
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(seatsMesh, false)[0];
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

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    down = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      id: e.pointerId,
    };
  }
  /** @param {PointerEvent} e */
  function onPointerUp(e) {
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (mode !== 'hall' || moved > 7 || !quick) return;
    const n = pick(e.clientX, e.clientY);
    if (n) {
      options.onToggle(n.id);
      if (e.pointerType === 'mouse') showTip(n, e.clientX, e.clientY);
    }
  }
  /** @param {PointerEvent} e */
  function onPointerMove(e) {
    if (e.pointerType !== 'mouse' || mode !== 'hall') return;
    if (e.buttons) {
      hideTip();
      return;
    }
    lastMove = e;
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      if (!lastMove) return;
      const n = pick(lastMove.clientX, lastMove.clientY);
      setHover(n);
      if (n) showTip(n, lastMove.clientX, lastMove.clientY);
      else tooltip.hidden = true;
    });
  }
  function onLeave() {
    lastMove = null;
    hideTip();
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onLeave);
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

// ---------- Geometriya yordamchilari ----------

/**
 * Yoysimon pog'ona: FOCUS markazli halqa bo'lagi, `height` balandlikda, `bottom` dan boshlab.
 * @param {number} rIn @param {number} rOut @param {number} theta yarim burchak @param {number} height @param {number} bottom
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
    curveSegments: Math.max(12, Math.round(theta * 40)),
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(FOCUS.x, bottom, FOCUS.z);
  return geo;
}

/** Kreslo: o'tiradigan joy + suyanchiq + oyoq (old tomoni -Z, ya'ni sahnaga) */
function chairGeometry() {
  const seat = new THREE.RoundedBoxGeometry(0.52, 0.13, 0.46, 2, 0.05);
  seat.translate(0, 0.36, -0.02);
  const back = new THREE.RoundedBoxGeometry(0.52, 0.5, 0.11, 2, 0.05);
  back.rotateX(-0.12);
  back.translate(0, 0.66, 0.22);
  const leg = new THREE.RoundedBoxGeometry(0.12, 0.3, 0.12, 1, 0.02);
  leg.translate(0, 0.15, 0.04);
  const merged = THREE.mergeGeometries([seat, back, leg], false);
  return merged ?? seat;
}

/**
 * Sahna ekrani: afisha (xiralashtirilgan fon + markazda afisha) va tadbir nomi.
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
    wrap(ctx, title, 80, H * 0.36 + 80, W * 0.42, 70, 4);
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
function wrap(ctx, text, x, y, maxW, lh, maxLines) {
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
