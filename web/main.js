import { selectStudy } from './process.js';
import { separationAt, REPLAY_DURATION } from './assembly-motion.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (selector) => document.querySelector(selector);
const asset = (path) => `${import.meta.env.BASE_URL}generated/${path}`;
const models = {
  heritage: { title: 'North Star No. 07', heading: 'North Star<br>No. 07', description: 'Forest green, warm brass, and an open running gear. A tribute to the age of steam.', wheels: '2-6-0', edition: 'HERITAGE / 01' },
  commodore: { title: 'Commodore Vanderbilt', heading: 'Commodore<br>Vanderbilt', description: 'A midnight-blue silhouette, swept wheel arches, and silver trim. Steam, dressed for the future.', wheels: '4-6-4', edition: 'STREAMLINED / 02' },
};
const offsets = {
  '01': [0, 3.8, 0], '02': [0, 1.5, 0], '03': [0, 0, 2],
  '04': [0, 1, 3.7], '05': [0, 3.2, -1.5], '06': [-1.2, 2, 1],
  '07': [1.1, 2.5, 0], '08': [1.1, 0, 2], '09': [1.1, 1, 0],
};
const cache = new Map();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let selected = 'heritage';
let active = null;
let sequence = 0;
let desiredExplosion = 0;
let currentExplosion = 0;
let renderer, scene, camera, controls, platform;
let dirty = true;
let busy = false;
let renderAvailable = false;
let previousFrame = performance.now();
let replaying = false;
let replayPosition = 0;
let wireframe = false;
function setWireframe(value) {
  wireframe = value;
  active?.root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.wireframe = value;
  });
  $('#wireframe').setAttribute('aria-pressed', String(value));
  dirty = true;
}
function pauseReplay() {
  replaying = false;
  $('#replay').textContent = 'Play sequence';
  $('#replay').setAttribute('aria-pressed', 'false');
}
function seekReplay(seconds) {
  replayPosition = seconds;
  setExplosion(separationAt(seconds), true);
  currentExplosion = desiredExplosion;
  if (active) for (const [key, entry] of active.assemblies) entry.group.position.fromArray(offsets[key]).multiplyScalar(currentExplosion);
  $('#replay-position').value = seconds;
  $('#replay-status').textContent = `${seconds.toFixed(1)} / 12s`;
  dirty = true;
}
function playReplay() {
  if (!active || !renderAvailable) return;
  if (replaying) { pauseReplay(); return; }
  if (replayPosition >= REPLAY_DURATION) replayPosition = 0;
  showAll();
  replaying = true;
  $('#replay').textContent = 'Pause sequence';
  $('#replay').setAttribute('aria-pressed', 'true');
}

function setBusy(value) {
  busy = value;
  for (const id of ['explosion', 'assembled', 'exploded', 'show-all', 'side-view', 'reset-view', 'replay', 'replay-position', 'wireframe']) $("#" + id).disabled = value || !renderAvailable;
}

function resize() {
  if (!renderer) return;
  const { width, height } = $('#viewport').getBoundingClientRect();
  const aspect = width / Math.max(height, 1);
  const span = Math.max(11, 18 / aspect);
  camera.left = -span * aspect / 2;
  camera.right = span * aspect / 2;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  dirty = true;
}

function resetCamera(side = false) {
  if (!controls) return;
  const e = desiredExplosion;
  camera.position.set(side ? 1.5 : -11, side ? 2.5 + e * 2 : 10 + e * 2, side ? 23 : 17);
  controls.target.set(1.5, 1.5 + e * 1.5, 0);
  camera.zoom = e > 0 ? 0.84 : 1;
  camera.updateProjectionMatrix();
  controls.update();
  dirty = true;
}

function addDisplayTrack() {
  platform = new THREE.Group();
  const block = (size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position); mesh.receiveShadow = true; platform.add(mesh);
  };
  const dark = new THREE.MeshStandardMaterial({ color: '#1c2e32', metalness: 0.4, roughness: 0.5 });
  const oak = new THREE.MeshStandardMaterial({ color: '#644731', roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: '#9aaeb3', metalness: 0.8, roughness: 0.3 });
  block([14.6, 0.3, 3.25], [2.15, -0.25, 0], dark);
  for (let x = -4.7; x < 9.3; x += 0.45) block([0.2, 0.13, 2.64], [x, 0.015, 0], oak);
  for (const z of [-0.92, 0.92]) block([14.25, 0.1, 0.075], [2.15, 0.13, z], steel);
  scene.add(platform);
}

function initViewer() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    $('#viewport').append(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-9, 9, 6, -6, 0.1, 150);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    scene.environment = pmrem.fromScene(environment, 0.04).texture;
    environment.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xd6e9ff, 0x2c3429, 2));
    const light = new THREE.DirectionalLight(0xffe2b8, 3); light.position.set(-5, 10, 7); scene.add(light);
    const rim = new THREE.DirectionalLight(0xbadfff, 2); rim.position.set(5, 8, -6); scene.add(rim);
    addDisplayTrack();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minZoom = 0.4; controls.maxZoom = 3;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.addEventListener('change', () => { dirty = true; });
    new ResizeObserver(resize).observe($('#viewport'));
    resetCamera(); resize();
    renderAvailable = true;
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); renderAvailable = false; setBusy(false);
      $('#poster').classList.remove('hidden');
      $('#load-status').textContent = '3D was interrupted. Reload to resume; the rendered model is shown.';
    });
    renderer.setAnimationLoop((time) => {
      const delta = Math.min((time - previousFrame) / 1000, 0.1); previousFrame = time;
      if (replaying && active && !document.hidden) {
        seekReplay(Math.min(REPLAY_DURATION, replayPosition + delta));
        if (replayPosition >= REPLAY_DURATION) pauseReplay();
      }
      const moving = Math.abs(currentExplosion - desiredExplosion) > 0.001;
      if (moving && active) {
        currentExplosion = reduceMotion ? desiredExplosion : THREE.MathUtils.damp(currentExplosion, desiredExplosion, 8, delta);
        for (const [key, entry] of active.assemblies) entry.group.position.fromArray(offsets[key]).multiplyScalar(currentExplosion);
        dirty = true;
      }
      controls.update();
      if (dirty && renderAvailable) { renderer.render(scene, camera); dirty = false; }
    });
  } catch (error) {
    console.error('3D initialization failed', error);
    renderer?.dispose(); renderer?.domElement.remove();
    renderer = null; renderAvailable = false;
  }
}

async function loadModel(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const promise = (async () => {
    const response = await fetch(asset(`models/${slug}/manifest.json`));
    if (!response.ok) throw new Error('The model manifest could not be loaded.');
    const manifest = await response.json();
    const root = new THREE.Group(); root.name = slug; root.visible = false;
    const assemblies = new Map();
    const loader = new GLTFLoader();
    await Promise.all(Object.entries(manifest.assemblies).map(async ([name, count]) => {
      const [key, title] = name.split(' • ');
      const filename = title.toLowerCase().replaceAll(' ', '-');
      const gltf = await loader.loadAsync(asset(`models/${slug}/${filename}.glb`));
      const group = new THREE.Group(); group.name = title; group.add(gltf.scene); root.add(group);
      assemblies.set(key, { group, title, count });
    }));
    scene.add(root);
    return { root, manifest, assemblies: new Map([...assemblies].sort(([a], [b]) => a.localeCompare(b))) };
  })();
  cache.set(slug, promise);
  try { return await promise; } catch (error) { cache.delete(slug); throw error; }
}

function renderAssemblyList() {
  const list = $('#assembly-list'); list.replaceChildren();
  if (!active) return;
  for (const [key, entry] of active.assemblies) {
    const label = document.createElement('label'); label.className = 'assembly-row';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = entry.group.visible;
    checkbox.dataset.assembly = key;
    checkbox.addEventListener('change', () => { entry.group.visible = checkbox.checked; dirty = true; });
    const title = document.createElement('span'); title.textContent = entry.title;
    const count = document.createElement('span'); count.textContent = entry.count;
    label.append(checkbox, title, count); list.append(label);
  }
}

async function selectModel(slug) {
  if (!(slug in models)) throw new Error('Unknown locomotive.');
  pauseReplay(); replayPosition = 0; $('#replay-position').value = 0; $('#replay-status').textContent = 'Ready';
  setWireframe(false);
  const token = ++sequence;
  selected = slug;
  void selectStudy(slug);
  const info = models[slug];
  if (active) active.root.visible = false;
  active = null; desiredExplosion = 0; currentExplosion = 0;
  $('#model-title').innerHTML = info.heading;
  $('#model-description').textContent = info.description;
  $('#wheel-spec').textContent = info.wheels;
  $('#edition').textContent = info.edition;
  $('#part-count').textContent = '—';
  $('#assembly-list').replaceChildren();
  $('#download-model').href = asset(`models/${slug}/${slug}.blend`);
  $('#poster').src = asset(`previews/${slug}.png`);
  $('#poster').alt = info.title + ', assembled locomotive and tender';
  $('#poster').classList.remove('hidden');
  document.querySelectorAll('[data-model]').forEach((button) => {
    const chosen = button.dataset.model === slug; button.classList.toggle('active', chosen); button.setAttribute('aria-pressed', String(chosen));
  });
  setExplosion(0); resetCamera(); setBusy(true); dirty = true;
  if (!renderAvailable) {
    $('#load-status').textContent = '3D is unavailable in this browser. Rendered model shown; downloads are available.';
    setBusy(false); return;
  }
  $('#load-status').textContent = 'Loading nine assemblies…';
  try {
    const model = await loadModel(slug);
    if (token !== sequence) return;
    active = model; active.root.visible = true;
    for (const entry of active.assemblies.values()) { entry.group.visible = true; entry.group.position.set(0, 0, 0); }
    $('#part-count').textContent = active.manifest.object_count.toLocaleString();
    renderAssemblyList(); setBusy(false); resize(); resetCamera(); dirty = true;
    renderer.render(scene, camera);
    $('#poster').classList.add('hidden'); $('#load-status').textContent = '';
  } catch (error) {
    if (token !== sequence) return;
    console.error(error);
    setBusy(false);
    for (const id of ['explosion', 'assembled', 'exploded', 'show-all', 'replay', 'replay-position', 'wireframe']) $('#' + id).disabled = true;
    $('#load-status').textContent = 'The 3D model could not load. Choose the model again to retry. Downloads are still available.';
  }
}

function setExplosion(percent, fromReplay = false) {
  if (!fromReplay) pauseReplay();
  desiredExplosion = percent / 100;
  $('#explosion').value = percent;
  $('#explosion-value').textContent = Math.round(percent) + '%';
  $('#assembled').setAttribute('aria-pressed', String(percent === 0));
  $('#exploded').setAttribute('aria-pressed', String(percent > 0));
  $('#view-label').textContent = percent === 0 ? 'ASSEMBLED VIEW' : 'EXPLODED VIEW';
  if (platform) platform.visible = percent === 0;
  if (controls) { controls.target.y = 1.5 + desiredExplosion * 1.5; camera.zoom = 1 - desiredExplosion * 0.16; camera.updateProjectionMatrix(); }
  dirty = true;
}

function showAll() {
  if (!active) return;
  for (const entry of active.assemblies.values()) entry.group.visible = true;
  renderAssemblyList(); dirty = true;
}

function getState() {
  return {
    model: selected, ready: Boolean(active), webglAvailable: renderAvailable, loading: busy,
    replay: { playing: replaying, seconds: replayPosition, duration: REPLAY_DURATION }, wireframe,
    separation: Math.round(desiredExplosion * 100), objectCount: active?.manifest.object_count ?? 0,
    assemblies: active ? [...active.assemblies].map(([id, e]) => ({ id, name: e.title, visible: e.group.visible, objects: e.count })) : [],
  };
}

for (const button of document.querySelectorAll('[data-study]')) button.addEventListener('click', () => { void selectModel(button.dataset.study); });
for (const button of document.querySelectorAll('[data-model]')) button.addEventListener('click', () => { void selectModel(button.dataset.model); });
$('#explosion').addEventListener('input', (event) => setExplosion(Number(event.target.value)));
$('#assembled').addEventListener('click', () => setExplosion(0));
$('#exploded').addEventListener('click', () => setExplosion(100));
$('#replay').addEventListener('click', playReplay);
$('#wireframe').addEventListener('click', () => setWireframe(!wireframe));
$('#replay-position').addEventListener('input', event => { pauseReplay(); seekReplay(Number(event.target.value)); });
$('#story-replay').addEventListener('click', () => { pauseReplay(); replayPosition = 0; playReplay(); });
$('#show-all').addEventListener('click', showAll);
$('#reset-view').addEventListener('click', () => resetCamera());
$('#side-view').addEventListener('click', () => resetCamera(true));
$('#viewport').addEventListener('keydown', (event) => {
  if (!controls) return;
  if (event.key === '+' || event.key === '=') camera.zoom = Math.min(3, camera.zoom * 1.15);
  else if (event.key === '-') camera.zoom = Math.max(0.4, camera.zoom / 1.15);
  else if (event.key.toLowerCase() === 'r') resetCamera();
  else return;
  event.preventDefault(); camera.updateProjectionMatrix(); dirty = true;
});

const rootPath = import.meta.env.BASE_URL.replace(/(?:dev|nightly)\/$/, '');
for (const branch of ['main', 'dev', 'nightly']) {
  const link = $('#' + branch + '-link');
  link.href = `${rootPath}${branch === 'main' ? '' : branch + '/'}`;
  const current = /\/(dev|nightly)\/$/.exec(import.meta.env.BASE_URL)?.[1] || 'main';
  if (branch === current) link.setAttribute('aria-current', 'page');
}

initViewer();
void selectModel('heritage');

const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool) => {
    try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); } catch (error) { console.error(error); }
  };
  register({
    name: 'get_locomotive_view', title: 'Read locomotive view',
    description: 'Read the selected locomotive, 3D readiness, separation, and assembly visibility.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: getState,
  });
  register({
    name: 'configure_locomotive_view', title: 'Inspect locomotive assemblies',
    description: 'Select a locomotive, set separation from 0 to 100, and optionally show only specified assembly IDs 01 through 09. An empty visibleAssemblies list hides every assembly.',
    inputSchema: { type: 'object', properties: { model: { type: 'string', enum: ['heritage', 'commodore'] }, separation: { type: 'number', minimum: 0, maximum: 100 }, visibleAssemblies: { type: 'array', items: { type: 'string', enum: ['01','02','03','04','05','06','07','08','09'] }, uniqueItems: true } }, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).some((key) => !['model', 'separation', 'visibleAssemblies'].includes(key))) throw new Error('Invalid view configuration.');
      if (input.model !== undefined && !(input.model in models)) throw new Error('Unknown model.');
      if (input.separation !== undefined && (!Number.isFinite(input.separation) || input.separation < 0 || input.separation > 100)) throw new Error('Separation must be between 0 and 100.');
      if (input.visibleAssemblies !== undefined && (!Array.isArray(input.visibleAssemblies) || input.visibleAssemblies.some((id) => !(id in offsets)))) throw new Error('Unknown assembly ID.');
      if (input.model && (selected !== input.model || !active)) await selectModel(input.model);
      if (!active) throw new Error('The 3D model is not ready.');
      if (input.separation !== undefined) setExplosion(input.separation);
      if (input.visibleAssemblies) {
        for (const [id, e] of active.assemblies) e.group.visible = input.visibleAssemblies.includes(id);
        renderAssemblyList();
      }
      currentExplosion = desiredExplosion;
      for (const [id, e] of active.assemblies) e.group.position.fromArray(offsets[id]).multiplyScalar(currentExplosion);
      controls.update(); renderer.render(scene, camera); dirty = true;
      return getState();
    },
  });
  register({
    name: 'configure_build_walkthrough', title: 'Explore the build walkthrough',
    description: 'Choose the drawing and source study, seek the assembly replay from 0 to 12 seconds, toggle wireframe, or play/pause the replay.',
    inputSchema: { type: 'object', properties: { study: { type: 'string', enum: ['heritage', 'commodore'] }, seconds: { type: 'number', minimum: 0, maximum: 12 }, wireframe: { type: 'boolean' }, playing: { type: 'boolean' } }, additionalProperties: false },
    async execute(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).some(key => !['study', 'seconds', 'wireframe', 'playing'].includes(key))) throw new Error('Invalid walkthrough configuration.');
      if (input.study !== undefined && !Object.hasOwn(models, input.study)) throw new Error('Unknown study.');
      if (input.seconds !== undefined && (!Number.isFinite(input.seconds) || input.seconds < 0 || input.seconds > 12)) throw new Error('Replay position must be between 0 and 12.');
      for (const key of ['playing', 'wireframe']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error('Expected a boolean.');
      if (input.study) { await selectStudy(input.study); await selectModel(input.study); }
      if (!active) throw new Error('The 3D model is not ready.');
      if (input.seconds !== undefined) { pauseReplay(); seekReplay(input.seconds); }
      if (input.wireframe !== undefined) setWireframe(input.wireframe);
      if (input.playing === false) pauseReplay();
      if (input.playing === true && !replaying) playReplay();
      controls.update(); renderer.render(scene, camera);
      return getState();
    },
  });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
