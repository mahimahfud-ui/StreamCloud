// UI interactions layered on top of the original page logic (which is untouched):
// card light/tilt, pointer parallax, mode-switch pulse, cinematic search.
import { state } from './state.js';

export function initInteractions({ invalidate, refresh }) {
  const root = document.documentElement;
  const fine = matchMedia('(hover:hover) and (pointer:fine)');

  // ---- pointer → scene parallax + card lighting/tilt (one rAF-batched handler) ----
  let pe = null, raf = 0, hovered = null, hoveredRect = null;
  function apply() {
    raf = 0; if (!pe) return;
    state.px = (pe.clientX / innerWidth) * 2 - 1;
    state.py = (pe.clientY / innerHeight) * 2 - 1;
    const card = pe.target.closest && pe.target.closest('.card.live');
    if (hovered && hovered !== card) release(hovered);
    if (hovered !== card) hoveredRect = null;
    hovered = card;
    if (!card || state.reduced) return;
    if (!hoveredRect) hoveredRect = card.getBoundingClientRect();
    const r = hoveredRect;
    const nx = (pe.clientX - r.left) / r.width, ny = (pe.clientY - r.top) / r.height;
    // Keep the moving light, but avoid per-frame 3D card rotation: it causes
    // extra compositing work and can feel laggy on integrated GPUs.
    card.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
    card.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
  }
  function release(c) {
    c.style.removeProperty('rotate');
    c.style.removeProperty('--mx');
    c.style.removeProperty('--my');
  }
  if (fine.matches) {
    addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; pe = e; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
    document.addEventListener('pointerleave', () => { if (hovered) release(hovered); hovered = null; hoveredRect = null; state.px = state.py = 0; });
    addEventListener('scroll', () => { hoveredRect = null; }, { passive: true });
    addEventListener('resize', () => { hoveredRect = null; }, { passive: true });
  }

  // ---- mode switch: shift the scene's mood and fire a light pulse ----
  document.querySelectorAll('.mode').forEach(btn => btn.addEventListener('click', () => {
    state.mood = btn.dataset.mode === 'sites' ? 0 : 1;
    state.pulseAt = performance.now();
    invalidate(); refresh();
  }));

  // ---- search: sync with the original toggle (observed, not replaced) ----
  const sb = document.getElementById('search'), q = document.getElementById('q'), main = document.querySelector('main');
  const sync = () => {
    const open = sb.classList.contains('open');
    document.body.classList.toggle('searching', open);
    state.dim = open ? 1 : 0; invalidate();
    if (open && main.getBoundingClientRect().top > innerHeight * .5) {        // bring results into view
      scrollTo({ top: scrollY + main.getBoundingClientRect().top - 130, behavior: state.reduced ? 'auto' : 'smooth' });
    }
  };
  new MutationObserver(sync).observe(sb, { attributes: true, attributeFilter: ['class'] });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && sb.classList.contains('open')) {
      q.value = ''; q.dispatchEvent(new Event('input')); sb.classList.remove('open'); q.blur();
    }
  });
  // Search results are re-rendered by the original catalog logic. Avoid forcing
  // a synchronous layout/reflow on every keystroke; new cards animate on insertion.
}