// "Channel Jump": a tilting canvas window in the hero shows a live reel of the OTHER collection.
// Activating it expands the window to fill the screen, switches Websites <-> Apps through the
// page's own mode buttons, then irises open onto the catalog.
//
// Technique adapted from the Planet Jumping reference: a screen-locked media layer seen through a
// clipped, fake-perspective rounded rectangle. Here the "media" is generated from the catalog
// itself (local logo marks, initials tiles), so there is no remote video to fail or wait for.
import { state, clamp } from './state.js';

const root = document.documentElement;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // easeInOutCubic
const lerp = (a, b, t) => a + (b - a) * t;
const LABEL = { sites: 'Websites', apps: 'Apps' };
const FOCAL = 850;

export function initPortal() {
  const btn = document.getElementById('portal');
  const canvas = document.getElementById('portal-canvas');
  const wrap = document.querySelector('.portal-wrap');
  const nameEl = document.getElementById('portalName');
  const countEl = document.getElementById('portalCount');
  if (!btn || !canvas || !wrap) return;

  const modeNow = () => (document.querySelector('.mode.active') || {}).dataset?.mode || 'sites';
  const otherMode = () => (modeNow() === 'sites' ? 'apps' : 'sites');
  const catalog = m => (window.MAHIFLIX_CATALOG && window.MAHIFLIX_CATALOG[m]) || [];

  root.classList.add('portal-on');
  const ctx = canvas.getContext('2d');
  let canvasOk = !!ctx;
  if (!canvasOk) root.classList.add('no-portal-gl');

  // ---------------------------------------------------------------- state
  let iw = innerWidth, ih = innerHeight;
  let rotX = 0, rotY = 0, tX = 0, tY = 0, hover = 0, hovering = false;
  let expansion = 0, iris = 0, maskScale = 0, busy = false, lockReel = false;
  let visible = false, raf = 0, last = 0;
  let reelMode = otherMode(), tiles = [], tileSize = 96;
  const imgs = new Map();

  // ---------------------------------------------------------------- reel content
  const hue = n => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return h; };
  const initials = n => n.replace(/[^a-z0-9 ]/gi, '').split(/\s+/).map(x => x[0] || '').join('').slice(0, 2).toUpperCase();
  function imageFor(src) {
    if (!src) return null;
    if (!imgs.has(src)) {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => kick();
      im.src = src; imgs.set(src, im);
    }
    return imgs.get(src);
  }
  function buildReel(mode) {
    reelMode = mode;
    const items = catalog(mode);
    tiles = (items.length ? items : [{ name: 'MahiFlix', domain: '' }]).map(it => ({
      name: it.name, h: hue(it.name), ini: initials(it.name),
      img: imageFor((window.MAHIFLIX_LOGOS || {})[it.domain]),
    }));
    kick();
  }
  function syncLabels() {
    const next = otherMode(), n = catalog(next).length;
    if (nameEl) nameEl.textContent = LABEL[next];
    if (countEl) countEl.textContent = '[' + String(n).padStart(2, '0') + ']';
    btn.setAttribute('aria-label', 'Jump to ' + LABEL[next]);
    btn.dataset.label = LABEL[next];
    if (!lockReel && reelMode !== next) buildReel(next);
  }

  // ---------------------------------------------------------------- canvas plumbing
  function resize() {
    iw = innerWidth; ih = innerHeight;
    if (!canvasOk) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(iw * d); canvas.height = Math.round(ih * d);
    canvas.style.width = iw + 'px'; canvas.style.height = ih + 'px';
    ctx.setTransform(d, 0, 0, d, 0, 0);
    kick();
  }
  function sizeTiles() {
    const w = btn.getBoundingClientRect().width || 200;
    tileSize = clamp(w * .46, 64, 150);
  }

  // ---------------------------------------------------------------- reel drawing
  function drawTile(t, x, y, s) {
    const r = s * .2;
    if (t.img && t.img.complete && t.img.naturalWidth) {
      ctx.drawImage(t.img, x, y, s, s);
      return;
    }
    const g = ctx.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, `hsl(${t.h} 55% 34%)`); g.addColorStop(1, '#0d0d0d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, s, s, r) : ctx.rect(x, y, s, s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = `400 ${s * .42}px "Bebas Neue", Impact, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.ini, x + s / 2, y + s / 2 + s * .03);
  }
  // `box` = screen-space bounds worth painting (cull everything else)
  function drawReel(time, zoom, box) {
    const s = tileSize, gap = Math.max(8, s * .1), pitch = s + gap;
    const cols = Math.ceil(iw / pitch) + 2, rows = Math.ceil(ih / pitch) + 3, span = rows * pitch;
    const cx = iw / 2, cy = ih / 2, n = tiles.length, still = state.reduced;
    const x0 = (iw - (cols - 2) * pitch) / 2;
    for (let c = 0; c < cols; c++) {
      const speed = still ? 0 : (c % 2 ? 1 : -1) * (12 + (c * 7) % 19);
      const off = c * pitch * 1.7 + time / 1000 * speed;
      const x = x0 + (c - 1) * pitch, sx = cx + (x - cx) * zoom;
      if (sx + s * zoom < box.l || sx > box.r) continue;
      for (let r = 0; r < rows; r++) {
        const y = ((((r * pitch + off) % span) + span) % span) - pitch, sy = cy + (y - cy) * zoom;
        if (sy + s * zoom < box.t || sy > box.b) continue;
        drawTile(tiles[(c * 3 + r) % n], x, y, s);
      }
    }
  }
  function drawShade() {
    const g = ctx.createLinearGradient(0, ih * .52, 0, ih);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.88)');
    ctx.fillStyle = g; ctx.fillRect(0, ih * .52, iw, ih * .48);
  }

  // ---------------------------------------------------------------- fake-3D rounded rectangle
  function outline(w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const pts = [], arcs = [
      [w / 2 - r, -h / 2 + r, -Math.PI / 2, 0], [w / 2 - r, h / 2 - r, 0, Math.PI / 2],
      [-w / 2 + r, h / 2 - r, Math.PI / 2, Math.PI], [-w / 2 + r, -h / 2 + r, Math.PI, Math.PI * 1.5]];
    for (const [ax, ay, a0, a1] of arcs)
      for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; pts.push([ax + Math.cos(a) * r, ay + Math.sin(a) * r]); }
    return pts;
  }
  function project(pts, cx, cy, rx, ry) {
    const ax = rx * Math.PI / 180, ay = ry * Math.PI / 180, ca = Math.cos(ay), cb = Math.cos(ax), sa = Math.sin(ay), sb = Math.sin(ax);
    return pts.map(([x, y]) => {
      const xx = x * ca, yy = y * cb, z = x * sa - y * sb, p = FOCAL / (FOCAL + z);
      return [cx + xx * p, cy + yy * p];
    });
  }

  function draw(now) {
    ctx.clearRect(0, 0, iw, ih);
    if (maskScale <= 0 && !expansion && !iris) return;
    const rect = btn.getBoundingClientRect();
    if (!busy && (rect.bottom < 0 || rect.top > ih)) return;
    const rcx = rect.left + rect.width / 2, rcy = rect.top + rect.height / 2;
    let e = expansion, scale = e ? 1 : maskScale * (1 + hover * .04);
    if (iris > 0) { e = 1; scale = 1 - iris; }
    const cx = lerp(rcx, iw / 2, e), cy = lerp(rcy, ih / 2, e);
    const w = lerp(rect.width, iw, e) * scale, h = lerp(rect.height, ih, e) * scale;
    const baseR = Math.min(rect.width, rect.height) * .28;
    const r = iris > 0 ? Math.min(w, h) / 2 * iris : baseR * (1 - e) * scale;
    if (w <= 1 || h <= 1) return;

    const heroAlpha = busy ? 1 : clamp(1 - state.hero * 1.2) * (1 - .84 * state.dim);
    if (heroAlpha <= 0.01) return;
    const pts = project(outline(w, h, r), cx, cy, rotX * (1 - e), rotY * (1 - e));
    const zoom = 1 + e * .55 + (iris > 0 ? iris * .1 : 0);
    const box = e || iris ? { l: -50, t: -50, r: iw + 50, b: ih + 50 }
      : { l: cx - w / 2 - 40, r: cx + w / 2 + 40, t: cy - h / 2 - 40, b: cy + h / 2 + 40 };

    ctx.save();
    ctx.globalAlpha = heroAlpha;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, iw, ih);
    ctx.save();
    ctx.translate(iw / 2, ih / 2); ctx.scale(zoom, zoom); ctx.translate(-iw / 2, -ih / 2);
    drawReel(now, zoom, box);
    ctx.restore();
    // vignette + a warm top glint, so the window reads as glass over a screen
    const v = ctx.createRadialGradient(cx, cy, Math.min(w, h) * .2, cx, cy, Math.max(w, h) * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.62)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, iw, ih);
    if (e > 0 || iris > 0) drawShade();
    ctx.restore();
    // hairline edge on the projected shape
    ctx.save();
    ctx.globalAlpha = heroAlpha * (1 - e) * .5; ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- loop (runs only when needed)
  const needRun = () => !document.hidden && (busy || (visible && !state.reduced));
  function frame(now) {
    raf = 0;
    const dt = Math.min(40, now - (last || now)); last = now;
    const k = Math.min(1, dt * .009);
    rotX += (tX - rotX) * k; rotY += (tY - rotY) * k;
    hover += ((hovering ? 1 : 0) - hover) * Math.min(1, dt * .012);
    if (canvasOk) draw(now);
    if (needRun()) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && canvasOk) raf = requestAnimationFrame(frame); }
  function animate(set, ms) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const t = clamp((now - t0) / ms); set(ease(t)); kick();
        t < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  }
  const revealMask = () => {
    if (state.reduced || !canvasOk) { maskScale = 1; root.classList.add('portal-in'); kick(); return Promise.resolve(); }
    maskScale = 0; root.classList.remove('portal-in'); void root.offsetWidth; root.classList.add('portal-in');
    return animate(v => { maskScale = v; }, 1050);
  };

  // ---------------------------------------------------------------- travel
  function commit(mode, byKeyboard) {
    const b = document.querySelector('.mode[data-mode="' + mode + '"]');
    if (b && !b.classList.contains('active')) b.click();
    const hero = document.getElementById('top');
    scrollTo({ top: Math.max(0, (hero ? hero.offsetHeight : 0) - 72), behavior: 'instant' });
    if (byKeyboard) { const a = document.querySelector('.mode.active'); a && a.focus({ preventScroll: true }); }
  }
  async function travel(byKeyboard) {
    if (busy) return;
    const target = otherMode();
    if (state.reduced || !canvasOk) { commit(target, byKeyboard); syncLabels(); return; }
    busy = true; lockReel = true; if (reelMode !== target) buildReel(target);
    canvas.style.pointerEvents = 'auto';               // block clicks reaching hidden cards mid-transition
    tX = tY = 0; root.classList.add('portal-travel');
    try {
      await animate(v => { expansion = v; }, 1100);
      commit(target, byKeyboard);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // let the new catalog paint
      await animate(v => { iris = v; }, 800);
    } catch (_) {
      try { commit(target, byKeyboard); } catch (__) { /* nothing more to do */ }
    } finally {
      expansion = 0; iris = 0; maskScale = 0;
      if (canvasOk) ctx.clearRect(0, 0, iw, ih);       // never leave a stale frame behind if the next paint is late
      canvas.style.pointerEvents = ''; root.classList.remove('portal-travel');
      busy = false; lockReel = false; syncLabels();
      revealMask();
    }
  }

  // ---------------------------------------------------------------- wiring
  btn.addEventListener('click', e => travel(e.detail === 0));
  btn.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovering = true; kick(); } });
  btn.addEventListener('pointerleave', () => { hovering = false; kick(); });
  btn.addEventListener('focus', () => { hovering = true; kick(); });
  btn.addEventListener('blur', () => { hovering = false; kick(); });
  addEventListener('pointermove', e => {
    if (busy || state.reduced || e.pointerType !== 'mouse' || !visible) return;
    tY = (e.clientX / iw - .5) * 37.4; tX = (e.clientY / ih - .5) * -33; kick();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { tX = tY = 0; kick(); });
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { resize(); sizeTiles(); }, { passive: true });
  document.addEventListener('visibilitychange', kick);
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; kick(); }, { rootMargin: '40px' }).observe(btn);
  else visible = true;

  // keep the label/reel honest when the user switches collection by any other route
  document.querySelectorAll('.mode').forEach(m => m.addEventListener('click', () => setTimeout(syncLabels, 0)));
  const sw = document.querySelector('.mode-switch');
  if (sw && 'MutationObserver' in window)
    new MutationObserver(() => { if (!busy) syncLabels(); }).observe(sw, { attributes: true, attributeFilter: ['class'], subtree: true });

  // ---------------------------------------------------------------- boot
  resize(); sizeTiles(); buildReel(otherMode()); syncLabels();
  const start = () => setTimeout(revealMask, 500);
  root.classList.contains('intro-on') ? document.addEventListener('mahiflix:intro-end', start, { once: true }) : start();
  return { travel };
}
