const loading = document.querySelector('#loading');
const dock = document.querySelector('.control-dock');
const header = document.querySelector('header');
const canvas = document.querySelector('#scene-canvas');
const restore = document.querySelector('#restore-ui');
const speed = document.querySelector('#speed');
const fullscreen = document.querySelector('#fullscreen');
const compact = matchMedia('(max-width:700px)');
const syncDensity = () => { document.querySelector('#advanced-controls').open = !compact.matches; };
compact.addEventListener('change', syncDensity);
syncDensity();

function syncInterface() {
  const pending = !loading.classList.contains('hidden');
  const clean = document.body.classList.contains('clean');
  const focusWasHidden = (clean || pending) && (dock.contains(document.activeElement) || header.contains(document.activeElement));
  dock.inert = pending || clean;
  header.inert = pending || clean;
  canvas.inert = pending;
  loading.inert = !pending;
  loading.setAttribute('aria-hidden', String(!pending));
  restore.hidden = !clean || pending;
  if (focusWasHidden && !restore.hidden) restore.focus();
}

new MutationObserver(syncInterface).observe(document.body, {attributes: true, attributeFilter: ['class']});
new MutationObserver(syncInterface).observe(loading, {attributes: true, attributeFilter: ['class']});
restore.addEventListener('click', () => {
  document.body.classList.remove('clean');
  syncInterface();
  document.querySelector('#hud').focus();
});
document.querySelector('#retry-scene').addEventListener('click', () => location.reload());
speed.addEventListener('input', () => {
  document.querySelector('#speed-value').value = `${speed.value}×`;
  speed.setAttribute('aria-valuetext', `${speed.value} times normal speed`);
});
if (!document.fullscreenEnabled) fullscreen.hidden = true;
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreen.textContent = active ? 'Exit fullscreen ↙' : 'Fullscreen ↗';
  fullscreen.setAttribute('aria-pressed', String(active));
});
window.addEventListener('valley:error', event => {
  loading.classList.remove('hidden');
  loading.dataset.state = 'error';
  document.querySelector('#loading-text').textContent = event.detail?.message || 'The scene could not load. Reload to retry, or return to the workshop.';
});
canvas.addEventListener('webglcontextlost', () => {
  window.dispatchEvent(new CustomEvent('valley:error', {detail: {message: 'The graphics connection was lost. Reload the scene to reconnect.'}}));
});
syncInterface();
