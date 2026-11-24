// Portada: un motor radial de 9 cilindros (137 piezas) que nace de una galaxia de partículas,
// explota en vista explotada, se arma pieza por pieza con el scroll, un escáner lo vuelve metal
// y al final arranca. Todo procedural, sin modelos descargados.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (s) => document.querySelector(s);
const sec = $('.ensamble');
const canvas = $('#ens-canvas');
const capaEtiquetas = $('.ens-etiquetas');
const pasosLi = [...document.querySelectorAll('.ens-pasos li')];
const hudPct = $('#hud-pct'), hudPiezas = $('#hud-piezas'), hudRpm = $('#hud-rpm'), hudTemp = $('#hud-temp');
const barra = $('.ens-barra i');
const destello = $('.ens-flash');
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esMovil = () => innerWidth <= 760;

// ---------- línea de tiempo (progreso del scroll, 0 a 1) ----------
const T = {
  juntaA: 0.035, juntaB: 0.17,      // la galaxia se vuelve holograma
  lineasA: 0.165, lineasB: 0.195,   // aparecen las piezas en líneas
  boomA: 0.195, boomB: 0.235,       // vista explotada
  barridoA: 0.715, barridoB: 0.8,   // escáner: de plano a metal
  encA: 0.8, encB: 0.87,            // encendido
  final: 0.86,
};
const OLAS = [
  { a: 0.25, b: 0.29 },   // 0 cárter y bancada
  { a: 0.285, b: 0.355 }, // 1 cilindros
  { a: 0.35, b: 0.42 },   // 2 culatas
  { a: 0.415, b: 0.475 }, // 3 balancines
  { a: 0.47, b: 0.55 },   // 4 varillas y encendido
  { a: 0.545, b: 0.61 },  // 5 escape y admisión
  { a: 0.605, b: 0.655 }, // 6 hélice
  { a: 0.65, b: 0.70 },   // 7 tornillería
];
// cámara: [progreso, distancia, giro, elevación]
const CAM = [
  [0.0, 46, 0.5, 0.62], [0.17, 31, 0.72, 0.38], [0.235, 38, 0.9, 0.45],
  [0.45, 31, 0.68, 0.34], [0.7, 27, 0.5, 0.27], [0.8, 30, 0.62, 0.2], [1.0, 33, 0.4, 0.16],
];

const limitar = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const rango = (x, a, b) => limitar((x - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);
const saleExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const atras = (x) => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const mezcla = (a, b, u) => a + (b - a) * u;

function iniciar() {
  if (!sec || !canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    sec.classList.add('sin-3d');
    return;
  }
  const movilInicio = esMovil();
  renderer.setPixelRatio(Math.min(devicePixelRatio, movilInicio ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;

  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.55;
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  const objetivo = new THREE.Vector3(0, 0, 0.2);

  escena.add(new THREE.HemisphereLight(0xcfc6b8, 0x1a1410, 0.5));
  const llave = new THREE.DirectionalLight(0xfff0dd, 2.4); llave.position.set(-10, 12, 16); escena.add(llave);
  const contra = new THREE.DirectionalLight(0xff7a33, 2.2); contra.position.set(12, 4, -14); escena.add(contra);
  const relleno = new THREE.DirectionalLight(0x7aa7ff, 0.5); relleno.position.set(8, -6, 10); escena.add(relleno);

  // ---------- planos de corte: el escáner muestra metal de un lado y líneas del otro ----------
  const planoSolido = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -999);
  const planoAristas = new THREE.Plane(new THREE.Vector3(1, 0, 0), 999);

  const metal = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, clippingPlanes: [planoSolido], ...extra });
  const M = {
    acero: metal(0x46474e, 0.75, 0.38),
    aluminio: metal(0x9c9ea5, 0.85, 0.3),
    oscuro: metal(0x1e1f23, 0.45, 0.55),
    naranja: metal(0xff5b1f, 0.3, 0.4),
    cobre: metal(0xa8643a, 0.85, 0.32, { emissive: new THREE.Color(0xff5a1a), emissiveIntensity: 0 }),
    cromo: metal(0xd9d6cf, 1, 0.16),
    pala: metal(0x232428, 0.5, 0.42),
  };

  // ---------- azar con semilla ----------
  let semilla = 137;
  const azar = () => {
    semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- piezas ----------
  const motor = new THREE.Group();
  escena.add(motor);
  const rotor = new THREE.Group();
  motor.add(rotor);
  const partes = [];
  const Y = new THREE.Vector3(0, 1, 0);

  function nueva(ola, nombre, contenedor = motor) {
    const aristaMat = new THREE.LineBasicMaterial({ color: 0xf1ece2, transparent: true, opacity: 0, depthWrite: false, clippingPlanes: [planoAristas] });
    return { ola, nombre, contenedor, interior: new THREE.Group(), aristaMat };
  }
  function agregar(pt, geo, mat, { pos = null, rz = null, quat = null, curva = null } = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    if (quat) m.quaternion.copy(quat);
    else if (rz !== null) m.rotation.z = rz;
    const lineas = curva
      ? new THREE.Line(new THREE.BufferGeometry().setFromPoints(curva.getPoints(40)), pt.aristaMat)
      : new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), pt.aristaMat);
    m.add(lineas);
    pt.interior.add(m);
    return m;
  }
  function cerrar(pt, explosion, { amp = 0.6, ejeGiro = null } = {}) {
    const caja = new THREE.Box3().setFromObject(pt.interior);
    const centro = caja.getCenter(new THREE.Vector3());
    pt.radio = caja.getSize(new THREE.Vector3()).length() / 2;
    pt.interior.position.copy(centro).multiplyScalar(-1);
    pt.exterior = new THREE.Group();
    pt.exterior.position.copy(centro);
    pt.exterior.add(pt.interior);
    pt.contenedor.add(pt.exterior);
    pt.centro = centro;
    pt.explosion = explosion;
    pt.giro = new THREE.Vector3((azar() * 2 - 1) * amp, (azar() * 2 - 1) * amp, (azar() * 2 - 1) * amp);
    pt.ejeGiro = ejeGiro;
    pt.k = 0; pt.kPrev = 0; pt.calor = 0; pt.fase = azar() * 6.28;
    partes.push(pt);
  }

  // geometría auxiliar
  const ejeZ = (g) => g.rotateX(Math.PI / 2);
  const ANG = (i) => Math.PI / 2 + (i * Math.PI * 2) / 9;
  const rad = (a) => new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  const tan = (a) => new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
  const P3 = (a, r, z, t = 0) => rad(a).multiplyScalar(r).addScaledVector(tan(a), t).setZ(z);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function aletado(rNucleo, largo, rAleta, nAletas, y0, y1, extra = []) {
    const gs = [new THREE.CylinderGeometry(rNucleo, rNucleo, largo, 28).translate(0, largo / 2, 0)];
    for (let i = 0; i < nAletas; i++) gs.push(new THREE.CylinderGeometry(rAleta, rAleta, 0.055, 28).translate(0, y0 + ((y1 - y0) * i) / (nAletas - 1), 0));
    return mergeGeometries([...gs, ...extra]);
  }
  function varilla(pt, a, b, r, mat) {
    const d = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, d.length(), 8);
    return agregar(pt, g, mat, { pos: a.clone().add(b).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()) });
  }
  function tubo(pt, puntos, r, mat, segs = 24) {
    const curva = new THREE.CatmullRomCurve3(puntos);
    return agregar(pt, new THREE.TubeGeometry(curva, segs, r, 8), mat, { curva });
  }

  const geoBarril = aletado(0.55, 2.3, 0.86, 14, 0.25, 2.15, [new THREE.CylinderGeometry(0.78, 0.78, 0.12, 28).translate(0, 0.06, 0)]);
  const geoCulata = aletado(0.74, 1.05, 1.06, 7, 0.12, 0.9, [new THREE.SphereGeometry(0.74, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, 1.05, 0)]);
  const geoBalancin = new THREE.BoxGeometry(0.36, 0.55, 0.52);
  const geoTuerca = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 6);
  const geoTuercaZ = ejeZ(geoTuerca.clone());
  const anchoPala = (t) => 0.55 + 0.75 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) - 0.4 * t;
  const torsion = (t) => 1.0 - t * 0.78;
  const geoPala = (() => {
    const g = new THREE.BoxGeometry(0.66, 4.3, 0.1, 1, 28, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      const y = p.getY(i) + 2.15;
      const t = y / 4.3;
      x *= anchoPala(t); z *= 1.3 - t * 0.7;
      const tw = torsion(t);
      p.setXYZ(i, x * Math.cos(tw) - z * Math.sin(tw), y + 0.5, x * Math.sin(tw) + z * Math.cos(tw));
    }
    g.computeVertexNormals();
    return g;
  })();

  // ola 0: cárter y bancada
  let pt = nueva(0, 'Cárter central');
  agregar(pt, ejeZ(new THREE.CylinderGeometry(2.1, 2.1, 1.6, 48)), M.acero);
  agregar(pt, new THREE.TorusGeometry(2.12, 0.07, 8, 64), M.oscuro, { pos: V(0, 0, 0.8) });
  agregar(pt, new THREE.TorusGeometry(2.12, 0.07, 8, 64), M.oscuro, { pos: V(0, 0, -0.8) });
  cerrar(pt, V(0, -9, 0));
  pt = nueva(0, 'Nariz');
  agregar(pt, ejeZ(new THREE.CylinderGeometry(1.15, 1.75, 1.5, 48)).translate(0, 0, 1.55), M.aluminio);
  cerrar(pt, V(0, 0, 8));
  pt = nueva(0, 'Cárter trasero');
  agregar(pt, ejeZ(new THREE.CylinderGeometry(1.9, 1.55, 1.3, 48)).translate(0, 0, -1.45), M.acero);
  cerrar(pt, V(0, 0, -8));
  pt = nueva(0, 'Bancada');
  agregar(pt, new THREE.TorusGeometry(2.8, 0.1, 8, 72), M.oscuro, { pos: V(0, 0, -3.7) });
  for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + Math.PI / 6; varilla(pt, P3(a, 2.8, -3.7), P3(a, 1.45, -2.0), 0.08, M.oscuro); }
  cerrar(pt, V(0, -3, -9));

  // ola 1: cilindros
  for (let i = 0; i < 9; i++) {
    const a = ANG(i);
    pt = nueva(1, `Cilindro ${i + 1}`);
    agregar(pt, geoBarril, M.acero, { pos: P3(a, 2.0, 0), rz: a - Math.PI / 2 });
    cerrar(pt, rad(a).multiplyScalar(5.5));
  }
  // ola 2: culatas
  for (let i = 0; i < 9; i++) {
    const a = ANG(i);
    pt = nueva(2, `Culata ${i + 1}`);
    agregar(pt, geoCulata, M.aluminio, { pos: P3(a, 4.3, 0), rz: a - Math.PI / 2 });
    cerrar(pt, rad(a).multiplyScalar(8.5).setZ(0.6));
  }
  // ola 3: balancines
  for (let i = 0; i < 9; i++) {
    const a = ANG(i);
    for (const [lado, t] of [['A', -0.42], ['B', 0.42]]) {
      pt = nueva(3, `Balancín ${i + 1}${lado}`);
      agregar(pt, geoBalancin, M.naranja, { pos: P3(a, 4.95, 0.55, t), rz: a - Math.PI / 2 });
      cerrar(pt, rad(a).multiplyScalar(9.5).addScaledVector(tan(a), t * 3).setZ(3));
    }
  }
  // ola 4: arnés, varillas y cables
  pt = nueva(4, 'Arnés de encendido');
  agregar(pt, new THREE.TorusGeometry(2.25, 0.07, 8, 72), M.cobre, { pos: V(0, 0, 0.95) });
  cerrar(pt, V(0, 0, 7));
  for (let i = 0; i < 9; i++) {
    const a = ANG(i);
    for (const [lado, s] of [['A', -1], ['B', 1]]) {
      pt = nueva(4, `Varilla ${i + 1}${lado}`);
      varilla(pt, P3(a, 1.98, 0.9, s * 0.17), P3(a, 4.88, 0.5, s * 0.42), 0.045, M.cromo);
      cerrar(pt, rad(a).multiplyScalar(4).setZ(5.5));
      pt = nueva(4, `Cable ${i + 1}${lado}`);
      tubo(pt, [P3(a + s * 0.12, 2.25, 0.95), P3(a, 3.6, 1.35, s * 0.35), P3(a, 4.85, 0.15, s * 0.62)], 0.028, M.oscuro, 16);
      cerrar(pt, rad(a).multiplyScalar(3).setZ(8));
    }
  }
  // ola 5: colector, escapes y admisión
  pt = nueva(5, 'Colector');
  agregar(pt, new THREE.TorusGeometry(3.3, 0.27, 12, 80), M.cobre, { pos: V(0, 0, -2.45) });
  tubo(pt, [V(0, -3.3, -2.45), V(0.1, -4.0, -2.9), V(0.3, -4.7, -3.6)], 0.27, M.cobre, 16);
  cerrar(pt, V(0, 0, -10));
  for (let i = 0; i < 9; i++) {
    const a = ANG(i);
    pt = nueva(5, `Escape ${i + 1}`);
    tubo(pt, [P3(a, 4.7, -0.5), P3(a, 4.35, -1.5), P3(a, 3.3, -2.35)], 0.15, M.cobre);
    cerrar(pt, rad(a).multiplyScalar(4).setZ(-5));
  }
  for (let i = 0; i < 9; i++) {
    const a = ANG(i);
    pt = nueva(5, `Admisión ${i + 1}`);
    tubo(pt, [P3(a, 1.6, -1.85), P3(a, 2.3, -1.4), P3(a, 2.45, -0.45)], 0.09, M.oscuro, 16);
    cerrar(pt, rad(a).multiplyScalar(2).setZ(-7));
  }
  // ola 6: hélice (dentro del rotor)
  pt = nueva(6, 'Cubo', rotor);
  agregar(pt, ejeZ(new THREE.CylinderGeometry(0.5, 0.62, 0.9, 32)).translate(0, 0, 2.75), M.cromo);
  cerrar(pt, V(0, 0, 7));
  for (let j = 0; j < 3; j++) {
    const b = Math.PI / 2 + (j * Math.PI * 2) / 3;
    pt = nueva(6, `Pala ${j + 1}`, rotor);
    agregar(pt, geoPala, M.pala, { pos: V(0, 0, 2.75), rz: b - Math.PI / 2 });
    const punta = new THREE.BoxGeometry(0.66 * anchoPala(0.96), 0.34, 0.1).rotateY(-torsion(0.96)).translate(0, 4.63, 0);
    agregar(pt, punta, M.naranja, { pos: V(0, 0, 2.75), rz: b - Math.PI / 2 });
    cerrar(pt, rad(b).multiplyScalar(6.5).setZ(4), { amp: 1.2 });
  }
  pt = nueva(6, 'Cono', rotor);
  const perfil = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; perfil.push(new THREE.Vector2(0.66 * Math.pow(1 - t, 0.55), t * 1.7)); }
  agregar(pt, ejeZ(new THREE.LatheGeometry(perfil, 32)).translate(0, 0, 3.2), M.naranja);
  cerrar(pt, V(0, 0, 12));
  // ola 7: tornillería
  for (let j = 0; j < 18; j++) {
    const a = (j * Math.PI * 2) / 18 + 0.17;
    pt = nueva(7, `Tuerca ${String(j + 1).padStart(2, '0')}`);
    agregar(pt, geoTuercaZ, M.cromo, { pos: P3(a, 1.82, 0.86) });
    cerrar(pt, rad(a).multiplyScalar(1.5).setZ(5), { amp: 0.2, ejeGiro: V(0, 0, 1) });
  }
  for (let i = 0; i < 9; i++) {
    const a = ANG(i);
    for (const t of [-0.62, 0.62]) {
      pt = nueva(7, `Tuerca ${String(partes.filter((x) => x.ola === 7).length + 1).padStart(2, '0')}`);
      agregar(pt, geoTuerca, M.cromo, { pos: P3(a, 2.06, 0, t), rz: a - Math.PI / 2 });
      cerrar(pt, rad(a).multiplyScalar(4).setZ(1), { amp: 0.2, ejeGiro: V(0, 1, 0) });
    }
  }
  const TOTAL = partes.length;
  if (hudPiezas) hudPiezas.textContent = `000/${TOTAL}`;

  // tiempos: cada ola reparte sus piezas en cascada
  OLAS.forEach((ola, n) => {
    const lista = partes.filter((x) => x.ola === n);
    const dur = limitar((ola.b - ola.a) * 0.45, 0.02, 0.04);
    lista.forEach((x, j) => {
      x.ini = ola.a + ((ola.b - ola.a - dur) * j) / Math.max(1, lista.length - 1);
      x.dur = dur;
    });
  });

  // ---------- holograma: puntos muestreados sobre las aristas del motor armado ----------
  motor.updateMatrixWorld(true);
  const segs = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  partes.forEach((x) => x.interior.traverse((o) => {
    if (!o.isLine) return;
    const pos = o.geometry.attributes.position;
    const paso = o.isLineSegments ? 2 : 1;
    for (let i = 0; i + 1 < pos.count; i += paso) {
      va.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      vb.fromBufferAttribute(pos, i + 1).applyMatrix4(o.matrixWorld);
      segs.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
    }
  }));
  const nSeg = segs.length / 6;
  const acumulado = new Float32Array(nSeg);
  let total = 0;
  for (let i = 0; i < nSeg; i++) {
    total += Math.hypot(segs[i * 6 + 3] - segs[i * 6], segs[i * 6 + 4] - segs[i * 6 + 1], segs[i * 6 + 5] - segs[i * 6 + 2]);
    acumulado[i] = total;
  }
  const NP = movilInicio ? 3500 : 7000;
  const destino = new Float32Array(NP * 3);
  const azares = new Float32Array(NP * 4);
  for (let n = 0; n < NP; n++) {
    const objetivoL = azar() * total;
    let lo = 0, hi = nSeg - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (acumulado[mid] < objetivoL) lo = mid + 1; else hi = mid; }
    const u = azar(), s = lo * 6;
    destino[n * 3] = mezcla(segs[s], segs[s + 3], u);
    destino[n * 3 + 1] = mezcla(segs[s + 1], segs[s + 4], u);
    destino[n * 3 + 2] = mezcla(segs[s + 2], segs[s + 5], u);
    for (let c = 0; c < 4; c++) azares[n * 4 + c] = azar();
  }
  const geoPuntos = new THREE.BufferGeometry();
  geoPuntos.setAttribute('position', new THREE.BufferAttribute(destino, 3));
  geoPuntos.setAttribute('aDestino', new THREE.BufferAttribute(destino, 3));
  geoPuntos.setAttribute('aAzar', new THREE.BufferAttribute(azares, 4));
  const matPuntos = new THREE.ShaderMaterial({
    uniforms: { uTiempo: { value: 0 }, uJunta: { value: 0 }, uOpacidad: { value: 1 }, uTam: { value: movilInicio ? 4.2 : 5.0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      uniform float uTiempo, uJunta, uOpacidad, uTam, uPx;
      attribute vec3 aDestino; attribute vec4 aAzar;
      varying float vAlfa; varying vec3 vColor;
      void main() {
        float r = 1.2 + pow(aAzar.x, 1.25) * 19.0;
        float brazo = floor(aAzar.y * 3.0) / 3.0 * 6.2831853;
        float ang = brazo + r * 0.32 + (aAzar.z - 0.5) * 0.9 + uTiempo * (0.35 / (0.4 + r * 0.08));
        vec3 galaxia = vec3(cos(ang) * r, sin(ang) * r, (aAzar.w - 0.5) * (1.0 + r * 0.12));
        float d = aAzar.w * 0.45;
        float g = smoothstep(d, d + 0.55, uJunta);
        float ge = 1.0 - pow(1.0 - g, 3.0);
        vec3 p = mix(galaxia, aDestino, ge);
        float tr = g * (1.0 - g) * 4.0;
        p.xy += vec2(-p.y, p.x) * tr * 0.25;
        p += sin(vec3(uTiempo * 1.3 + aAzar.x * 20.0, uTiempo * 1.1 + aAzar.y * 20.0, uTiempo * 0.9 + aAzar.z * 20.0)) * 0.04 * ge;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uTam * uPx * (0.6 + aAzar.x * 1.2) * (30.0 / -mv.z) * (1.0 - 0.45 * ge);
        vAlfa = uOpacidad * (0.55 + 0.95 * aAzar.z);
        vColor = mix(vec3(1.0, 0.36, 0.12), vec3(1.0, 0.86, 0.62), aAzar.y);
      }`,
    fragmentShader: /* glsl */`
      varying float vAlfa; varying vec3 vColor;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vColor * a * vAlfa, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const puntos = new THREE.Points(geoPuntos, matPuntos);
  puntos.frustumCulled = false;
  motor.add(puntos);

  // ---------- texturas de brillo ----------
  function texturaRadial(paradas) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    paradas.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const texChispa = texturaRadial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,200,140,.8)'], [1, 'rgba(255,120,40,0)']]);

  // ---------- chispas (también flamas) ----------
  const NC = movilInicio ? 450 : 1000;
  const cPos = new Float32Array(NC * 3).fill(9999);
  const cCol = new Float32Array(NC * 3);
  const cVel = new Float32Array(NC * 3);
  const cVida = new Float32Array(NC);
  const cMax = new Float32Array(NC).fill(1);
  const cBase = new Float32Array(NC * 3);
  const geoChispas = new THREE.BufferGeometry();
  geoChispas.setAttribute('position', new THREE.BufferAttribute(cPos, 3).setUsage(THREE.DynamicDrawUsage));
  geoChispas.setAttribute('color', new THREE.BufferAttribute(cCol, 3).setUsage(THREE.DynamicDrawUsage));
  const chispas = new THREE.Points(geoChispas, new THREE.PointsMaterial({ size: 0.11, map: texChispa, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  chispas.frustumCulled = false;
  escena.add(chispas);
  let cIdx = 0;
  function emitir(x, y, z, vx, vy, vz, vida, r, g, b) {
    const i = cIdx; cIdx = (cIdx + 1) % NC;
    cPos[i * 3] = x; cPos[i * 3 + 1] = y; cPos[i * 3 + 2] = z;
    cVel[i * 3] = vx; cVel[i * 3 + 1] = vy; cVel[i * 3 + 2] = vz;
    cVida[i] = vida; cMax[i] = vida;
    cBase[i * 3] = r; cBase[i * 3 + 1] = g; cBase[i * 3 + 2] = b;
  }
  const tmp = new THREE.Vector3();
  function rafaga(centro, n, fuerza = 4) {
    for (let k = 0; k < n; k++) {
      const th = azar() * Math.PI * 2, ph = Math.acos(azar() * 2 - 1);
      const v = fuerza * (0.4 + azar() * 0.9);
      const blanco = azar() < 0.3;
      emitir(centro.x, centro.y, centro.z, Math.sin(ph) * Math.cos(th) * v, Math.cos(ph) * v + 1.5, Math.sin(ph) * Math.sin(th) * v,
        0.35 + azar() * 0.5, 1.0, blanco ? 0.95 : 0.55 + azar() * 0.2, blanco ? 0.8 : 0.2);
    }
  }

  // ---------- onda expansiva, escáner, disco de la hélice ----------
  const onda = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 128), new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  motor.add(onda);
  let ondaT = 9;
  const disparaOnda = () => { ondaT = 0; };

  const escaner = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({
    map: texturaRadial([[0, 'rgba(255,150,80,.9)'], [0.35, 'rgba(255,91,31,.35)'], [1, 'rgba(255,91,31,0)']]),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  escena.add(escaner);

  const disco = new THREE.Mesh(new THREE.CircleGeometry(4.95, 64), new THREE.MeshBasicMaterial({
    map: texturaRadial([[0, 'rgba(255,255,255,0)'], [0.15, 'rgba(255,255,255,.05)'], [0.85, 'rgba(220,215,205,.35)'], [0.96, 'rgba(255,120,50,.7)'], [1, 'rgba(255,120,50,0)']]),
    transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  }));
  disco.position.z = 2.75;
  motor.add(disco);
  const brilloEscape = new THREE.PointLight(0xff5a1a, 0, 14, 2);
  brilloEscape.position.set(0, -3.3, -2.4);
  motor.add(brilloEscape);
  const salidaEscape = V(0.3, -4.7, -3.6);
  const dirEscape = V(0.25, -0.9, -0.9).normalize();

  // ---------- cota en HTML ----------
  const cota = document.createElement('div');
  cota.className = 'cota';
  cota.innerHTML = '<i></i><span></span><small></small>';
  capaEtiquetas.appendChild(cota);
  const cotaTxt = cota.querySelector('span'), cotaSpec = cota.querySelector('small');
  let cotaDe = null;

  // ---------- tamaño, encuadre ----------
  let ancho = 1, alto = 1, pS = 0;
  function encuadre(P) {
    const fin = rango(P, 0.84, 0.96);
    if (esMovil()) camara.setViewOffset(ancho, alto, 0, alto * (0.12 + fin * 0.08), ancho, alto);
    else camara.setViewOffset(ancho, alto, -ancho * (0.06 + 0.11 * rango(P, 0, 0.17) + 0.07 * fin), -alto * 0.04 * fin, ancho, alto);
    camara.updateProjectionMatrix();
  }
  function ajustar() {
    ancho = canvas.clientWidth; alto = canvas.clientHeight;
    if (!ancho || !alto) return;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    encuadre(pS);
  }
  ajustar();
  addEventListener('resize', ajustar);

  // ---------- puntero y arrastre ----------
  const puntero = { x: 0, y: 0, mx: 0, my: 0 };
  addEventListener('pointermove', (e) => { puntero.mx = e.clientX / innerWidth - 0.5; puntero.my = e.clientY / innerHeight - 0.5; }, { passive: true });
  let arrastrando = false, ultimoX = 0, velGiro = 0, giroUsuario = 0, giroAuto = 0;
  canvas.addEventListener('pointerdown', (e) => { arrastrando = true; ultimoX = e.clientX; canvas.setPointerCapture(e.pointerId); sec.classList.add('arrastrando'); });
  canvas.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const dx = e.clientX - ultimoX; ultimoX = e.clientX;
    velGiro = dx * 0.006; giroUsuario += velGiro;
  });
  const suelta = () => { arrastrando = false; sec.classList.remove('arrastrando'); };
  canvas.addEventListener('pointerup', suelta);
  canvas.addEventListener('pointercancel', suelta);

  // ---------- progreso ----------
  const progresoScroll = () => {
    const r = sec.getBoundingClientRect();
    const tot = sec.offsetHeight - innerHeight;
    return tot > 0 ? limitar(-r.top / tot) : 1;
  };
  pS = reducir ? 1 : progresoScroll();
  let pPrev = pS;
  const reloj = new THREE.Clock();
  let t = 0, rpm = 0, temp = 21, flash = 0, sacudida = 0, fase = '';
  const PAPEL = new THREE.Color(0xf1ece2), NARANJA = new THREE.Color(0xff5b1f), BLANCO = new THREE.Color(0xfff4e0);
  const cTmp = new THREE.Color();
  const muestra = new THREE.Vector3();

  function camaraEn(P) {
    for (let i = 0; i < CAM.length - 1; i++) {
      const [a0, r0, g0, e0] = CAM[i], [a1, r1, g1, e1] = CAM[i + 1];
      if (P <= a1) { const u = suave(rango(P, a0, a1)); return [mezcla(r0, r1, u), mezcla(g0, g1, u), mezcla(e0, e1, u)]; }
    }
    const u = CAM[CAM.length - 1];
    return [u[1], u[2], u[3]];
  }

  function cuadro() {
    const dt = Math.min(reloj.getDelta(), 0.05);
    t += dt;
    const p = reducir ? 1 : progresoScroll();
    pS += (p - pS) * (reducir ? 1 : 0.085);
    const P = pS;
    const adelante = P > pPrev + 1e-5;

    const junta = suave(rango(P, T.juntaA, T.juntaB));
    const lineas = suave(rango(P, T.lineasA, T.lineasB));
    const boom = saleExpo(rango(P, T.boomA, T.boomB));
    const barrido = suave(rango(P, T.barridoA, T.barridoB));

    // disparadores al cruzar umbrales hacia adelante
    if (adelante && pPrev < T.boomA && P >= T.boomA) { disparaOnda(); flash = 0.55; sacudida = 0.5; rafaga(V(0, 0, 0), 160, 9); }
    if (adelante && pPrev < T.encA + 0.012 && P >= T.encA + 0.012) { disparaOnda(); flash = 0.75; sacudida = 0.9; }

    // piezas
    let colocadas = 0, lider = null;
    for (const x of partes) {
      const k = rango(P, x.ini, x.ini + x.dur);
      if (k >= 1 && x.kPrev < 1 && adelante) {
        x.calor = 1.7;
        x.exterior.getWorldPosition(tmp);
        rafaga(tmp, Math.round(limitar(x.radio * 9, 5, 36)), 3.2);
      }
      x.kPrev = k;
      x.k = k;
      if (k >= 1) colocadas++;
      else if (!lider) lider = x;
      const f = boom * (1 - atras(k));
      x.exterior.position.copy(x.centro).addScaledVector(x.explosion, f);
      x.exterior.position.y += Math.sin(t * 0.8 + x.fase) * 0.18 * f;
      x.exterior.rotation.set(x.giro.x * f + Math.sin(t * 0.4 + x.fase) * 0.05 * f, x.giro.y * f, x.giro.z * f);
      if (x.ejeGiro) x.exterior.rotateOnAxis(x.ejeGiro, (1 - k) * 14 * boom);
      const moviendo = k > 0 && k < 1 ? 1 : 0;
      x.calor = Math.max(moviendo, x.calor - dt * 2.2);
      const c = x.calor;
      if (c > 1) cTmp.copy(NARANJA).lerp(BLANCO, c - 1); else cTmp.copy(PAPEL).lerp(NARANJA, c);
      x.aristaMat.color.copy(cTmp);
      x.aristaMat.opacity = lineas * (0.4 + 0.5 * Math.min(1, c));
    }

    // holograma de puntos
    matPuntos.uniforms.uTiempo.value = t;
    matPuntos.uniforms.uJunta.value = junta;
    matPuntos.uniforms.uOpacidad.value = P < 0.17 ? 1 : P < 0.2 ? mezcla(1, 0.22, rango(P, 0.17, 0.2)) : 0.22 * (1 - barrido);
    puntos.visible = matPuntos.uniforms.uOpacidad.value > 0.002;

    // escáner: de líneas a metal
    const s = barrido <= 0 ? -999 : barrido >= 1 ? 999 : mezcla(-8.5, 8.5, barrido);
    planoSolido.constant = s;
    planoAristas.constant = -s;
    const enBarrido = barrido > 0 && barrido < 1;
    escaner.visible = enBarrido;
    if (enBarrido) {
      escaner.position.x = s;
      escaner.material.opacity = 0.55 * Math.sin(Math.PI * barrido) + 0.15;
      for (let k = 0; k < 70; k++) {
        const n = Math.floor(azar() * NP);
        muestra.set(destino[n * 3], destino[n * 3 + 1], destino[n * 3 + 2]).applyMatrix4(motor.matrixWorld);
        if (Math.abs(muestra.x - s) < 0.35) emitir(muestra.x, muestra.y, muestra.z, (azar() - 0.3) * 2, azar() * 2.5, (azar() - 0.5) * 2, 0.3 + azar() * 0.4, 1, 0.65 + azar() * 0.3, 0.3);
      }
    }

    // encendido
    const objetivoRpm = P >= T.encA ? suave(rango(P, T.encA, T.encB)) * 2400 : 0;
    rpm += (objetivoRpm - rpm) * Math.min(1, dt * (objetivoRpm > rpm ? 1.3 : 2.5));
    const marcha = rpm / 2400;
    temp += (21 + marcha * 164 - temp) * Math.min(1, dt * 0.8);
    rotor.rotation.z -= (rpm / 60) * Math.PI * 2 * dt * 0.08;
    disco.material.opacity = limitar((rpm - 500) / 1500) * 0.3;
    const parpadeo = 0.85 + 0.15 * Math.sin(t * 31) * Math.sin(t * 17);
    M.cobre.emissiveIntensity = marcha * 1.7 * parpadeo;
    brilloEscape.intensity = marcha * 40 * parpadeo;
    if (marcha > 0.05 && !reducir) {
      const nF = Math.round(marcha * 4);
      tmp.copy(salidaEscape).applyMatrix4(motor.matrixWorld);
      const dir = dirEscape.clone().transformDirection(motor.matrixWorld);
      for (let k = 0; k < nF; k++) {
        const v = 5 + azar() * 4;
        emitir(tmp.x, tmp.y, tmp.z, dir.x * v + (azar() - 0.5), dir.y * v + (azar() - 0.5), dir.z * v + (azar() - 0.5), 0.18 + azar() * 0.2, 1, 0.45 + azar() * 0.4, 0.1);
      }
    }

    // onda expansiva
    if (ondaT < 2) {
      ondaT += dt;
      const u = ondaT / 1.5;
      onda.scale.setScalar(1 + u * 15);
      onda.material.opacity = Math.max(0, Math.pow(1 - Math.min(1, u), 2)) * 0.9;
    } else onda.material.opacity = 0;

    // chispas
    for (let i = 0; i < NC; i++) {
      if (cVida[i] <= 0) continue;
      cVida[i] -= dt;
      if (cVida[i] <= 0) { cPos[i * 3] = 9999; cCol[i * 3] = cCol[i * 3 + 1] = cCol[i * 3 + 2] = 0; continue; }
      cVel[i * 3 + 1] -= 6 * dt;
      cPos[i * 3] += cVel[i * 3] * dt; cPos[i * 3 + 1] += cVel[i * 3 + 1] * dt; cPos[i * 3 + 2] += cVel[i * 3 + 2] * dt;
      const vida = cVida[i] / cMax[i];
      cCol[i * 3] = cBase[i * 3] * vida; cCol[i * 3 + 1] = cBase[i * 3 + 1] * vida; cCol[i * 3 + 2] = cBase[i * 3 + 2] * vida;
    }
    geoChispas.attributes.position.needsUpdate = true;
    geoChispas.attributes.color.needsUpdate = true;

    // giro del motor: arrastre + tornamesa cuando ya está en marcha
    if (!arrastrando) { velGiro *= 0.94; giroUsuario += velGiro; }
    if (marcha > 0.3 && !arrastrando && !reducir) giroAuto += dt * 0.12 * marcha;
    motor.rotation.y = giroUsuario + giroAuto;
    motor.position.set((Math.random() - 0.5) * 0.025 * marcha, (Math.random() - 0.5) * 0.025 * marcha, 0);

    // cámara
    puntero.x += (puntero.mx - puntero.x) * 0.05;
    puntero.y += (puntero.my - puntero.y) * 0.05;
    let [dist, giro, elev] = camaraEn(P);
    if (esMovil()) dist *= mezcla(mezcla(1.25, 2.05, rango(P, 0.1, 0.22)), 1.75, rango(P, 0.8, 1));
    giro += puntero.x * 0.16 + (reducir ? 0 : Math.sin(t * 0.13) * 0.03);
    elev += puntero.y * 0.1;
    camara.position.set(Math.sin(giro) * Math.cos(elev), Math.sin(elev), Math.cos(giro) * Math.cos(elev)).multiplyScalar(dist).add(objetivo);
    sacudida = Math.max(0, sacudida - dt * 1.4);
    if (sacudida > 0) camara.position.add(tmp.set(azar() - 0.5, azar() - 0.5, azar() - 0.5).multiplyScalar(sacudida * 0.8));
    camara.lookAt(objetivo);
    encuadre(P);

    renderer.render(escena, camara);

    // destello en pantalla
    flash = Math.max(0, flash - dt * 1.6);
    if (destello) destello.style.opacity = flash.toFixed(3);

    // cota de la pieza que va llegando
    const verCota = lider && P >= T.boomB && P < OLAS[OLAS.length - 1].b && P > lider.ini - 0.03;
    cota.classList.toggle('ver', !!verCota);
    if (verCota) {
      if (cotaDe !== lider) {
        cotaDe = lider;
        const li = pasosLi[lider.ola + 1];
        cotaTxt.textContent = `${String(partes.indexOf(lider) + 1).padStart(3, '0')} · ${lider.nombre}`;
        cotaSpec.textContent = li?.dataset.spec ?? '';
      }
      lider.exterior.getWorldPosition(tmp).project(camara);
      cota.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * ancho).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * alto).toFixed(1)}px)`;
    }

    // HUD
    hudPct.textContent = String(Math.round(limitar(P / T.final) * 100)).padStart(3, '0') + '%';
    hudPiezas.textContent = `${String(colocadas).padStart(3, '0')}/${TOTAL}`;
    hudRpm.textContent = String(Math.round(rpm)).padStart(4, '0');
    hudTemp.textContent = `${String(Math.round(temp)).padStart(3, '0')} °C`;
    if (barra) barra.style.transform = `scaleX(${P})`;

    // pasos
    const activo = P < T.boomA ? 0 : lider && P < OLAS[OLAS.length - 1].b ? lider.ola + 1 : 9;
    pasosLi.forEach((li, i) => { li.classList.toggle('activo', i === activo); li.classList.toggle('hecho', i < activo); });
    const nuevaFase = P < T.juntaA ? 'intro' : P < T.final ? 'armando' : 'final';
    if (nuevaFase !== fase) { fase = nuevaFase; sec.dataset.fase = fase; }

    pPrev = P;
    if (corriendo) requestAnimationFrame(cuadro);
  }

  let corriendo = false;
  const arrancar = () => { if (corriendo) return; corriendo = true; reloj.getDelta(); requestAnimationFrame(cuadro); };
  const parar = () => { corriendo = false; };

  if (reducir) {
    sec.classList.add('quieto');
    cuadro();
    addEventListener('resize', () => { ajustar(); cuadro(); });
    return;
  }
  const enVista = () => { const r = sec.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? arrancar() : parar())).observe(sec);
  addEventListener('scroll', () => { if (!corriendo && !document.hidden && enVista()) arrancar(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); else if (enVista()) arrancar(); });
  cuadro();
  if (enVista()) arrancar();
  sec.classList.add('listo');
}

iniciar();
