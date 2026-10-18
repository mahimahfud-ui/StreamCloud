// Preloader: the existing intro overlay gains a REAL progress counter. Progress is the share of
// things that actually finished loading (fonts, window load, local logo marks the portal paints,
// the WebGL scene). It never waits on remote media: every task has a timeout and the inline
// failsafe in index.html ends the intro regardless. When done, the logo glides into the nav slot.
const root = document.documentElement;

export function initPreloader() {
  const intro = document.getElementById('intro');
  if (!intro || !root.classList.contains('intro-on')) return;
  const valEl = document.getElementById('introVal'), countEl = document.getElementById('introCount');
  if (!valEl || !countEl) return;

  const t0 = performance.now(), MIN = 1700, MAX = 4000;
  const parts = { fonts: 0, load: 0, logos: 0, scene: 0 };
  const W = { fonts: .2, load: .3, logos: .3, scene: .2 };
  const settle = k => { parts[k] = 1; };

  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => settle('fonts'), () => settle('fonts'));
  document.readyState === 'complete' ? settle('load') : addEventListener('load', () => settle('load'), { once: true });

  const logos = [...new Set(Object.values(window.MAHIFLIX_LOGOS || {}))];
  if (!logos.length) settle('logos');
  else {
    let n = 0; const one = () => { if (++n >= logos.length) settle('logos'); else parts.logos = n / logos.length; };
    logos.forEach(src => { const im = new Image(); im.onload = im.onerror = one; im.src = src; });
  }
  const sceneDone = () => root.classList.contains('gl-ready') || root.classList.contains('no-webgl');

  let shown = 0, finished = false;
  function fly() {
    const logo = intro.querySelector('.intro-logo'), dest = document.querySelector('nav .logo img');
    if (!logo || !dest || !logo.animate) return;
    const a = logo.getBoundingClientRect(), b = dest.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const el = document.createElement('div');
    el.className = 'fly-logo';
    Object.assign(el.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    document.body.appendChild(el);
    logo.style.visibility = 'hidden';
    const end = `translate(${b.left - a.left}px,${b.top - a.top}px) scale(${b.width / a.width},${b.height / a.height})`;
    const anim = el.animate(
      [{ transform: 'none', opacity: 1 }, { opacity: 1, offset: .82 }, { transform: end, opacity: 0 }],
      { duration: 1100, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    const clean = () => el.remove();
    anim.finished.then(clean, clean);
  }
  function finish() {
    if (finished) return; finished = true;
    valEl.textContent = '100';
    countEl.classList.add('is-leaving');
    try { fly(); } catch (_) { /* decorative */ }
    setTimeout(() => window.__introEnd && window.__introEnd(), 140);
  }
  (function tick(now) {
    if (finished || !root.classList.contains('intro-on')) return;
    if (sceneDone()) settle('scene');
    const elapsed = now - t0;
    let real = 0; for (const k in parts) real += parts[k] * W[k];
    if (elapsed > MAX) real = 1;
    const goal = Math.min(real, elapsed / MIN);
    shown += (goal - shown) * .14;
    valEl.textContent = String(Math.min(99, Math.round(shown * 100)));
    if (shown > .985 && real >= 1) return finish();
    requestAnimationFrame(tick);
  })(t0);
}
