// Scroll choreography: scroll → shared state, section reveals, hero exit, per-column card depth.
import { state, clamp } from './state.js';

export function initChoreography({ invalidate }) {
  const root = document.documentElement;
  const hero = document.getElementById('top');
  const finale = document.getElementById('finale');
  let vh = innerHeight, queued = false, scrolling = false, scrollIdleTimer = 0;

  // ---- reveals: add `.in` once when something first enters the viewport ----
  // The catalog re-renders (mode switch, filters, search), so new nodes are picked up by a MutationObserver.
  const hasIO = 'IntersectionObserver' in window;
  const revealIO = hasIO ? new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
  }), { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }) : null;

  // ---- per-column depth: cards drift slightly at different rates (desktop only) ----
  const onScreen = new Set();
  const depthIO = hasIO ? new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) onScreen.add(en.target);
    else {
      onScreen.delete(en.target);
      en.target.style.translate = '';
      lastShift.set(en.target, 0);
    }
    queue();                                  // recompute depth when the visible set changes
  }), { rootMargin: '10% 0px' }) : null;

  const seen = new WeakSet();
  function watch(scope) {
    scope.querySelectorAll('.row-head, .card, .finale-in > *').forEach(el => {
      if (seen.has(el)) return; seen.add(el);
      revealIO ? revealIO.observe(el) : el.classList.add('in');
      if (depthIO && el.classList.contains('card')) depthIO.observe(el);
    });
  }
  watch(document);
  const main = document.querySelector('main');
  if (main && 'MutationObserver' in window) {
    new MutationObserver(muts => {
      muts.forEach(m => m.removedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        const removedCards = [];
        if (n.matches?.('.card')) removedCards.push(n);
        removedCards.push(...(n.querySelectorAll?.('.card') || []));
        removedCards.forEach(c => {
          onScreen.delete(c);
          if (depthIO) depthIO.unobserve(c);
          c.style.translate = '';
        });
      }));
      watch(main);
    }).observe(main, { childList: true, subtree: true });
  }
  const lastShift = new WeakMap(), colIdx = new WeakMap();
  const FACTOR = [0, -.55, -1.1];
  function depth() {
    if (state.reduced || innerWidth <= 760) {            // no drift on phones: clear anything left from a wider layout
      onScreen.forEach(c => { if (c.style.translate) { c.style.translate = ''; lastShift.set(c, 0); } });
      return;
    }
    if (!onScreen.size) return;
    const reads = [];
    onScreen.forEach(c => {
      if (!c.offsetParent) return;
      const r = c.getBoundingClientRect(), prev = lastShift.get(c) || 0;
      let idx = colIdx.get(c);
      if (idx === undefined) { idx = [].indexOf.call(c.parentNode.children, c) % 3; colIdx.set(c, idx); }
      const norm = clamp(((r.top + r.height / 2 - prev) - vh / 2) / vh, -1, 1);
      reads.push([c, norm * FACTOR[idx] * 34]);
    });
    reads.forEach(([c, y]) => {
      const prev = lastShift.get(c) || 0;
      if (Math.abs(y - prev) < .75) return;  // avoid tiny per-frame style writes that cause scroll jank
      lastShift.set(c, y);
      c.style.translate = `0 ${y.toFixed(1)}px`;
    });
  }

  // ---- main scroll step (rAF-throttled, passive) ----
  function step() {
    queued = false;
    const y = scrollY, docH = root.scrollHeight;
    state.scroll = y;
    state.hero = clamp(y / (vh * .9));
    state.finale = clamp((vh - finale.getBoundingClientRect().top) / (vh * .85));
    state.pageP = clamp(y / Math.max(1, docH - vh));
    hero.style.setProperty('--hp', state.hero.toFixed(3));
    root.classList.toggle('at-finale', state.finale > .2);
    // Visible-card geometry reads are the most expensive part of scroll choreography.
    // Keep subtle desktop depth motion, but cap those reads/writes during active scrolling.
    // Skip card geometry reads/writes while the user is actively scrolling.
    // The final position is recalculated once the scroll settles.
    if (!scrolling) depth();
    if (state.reduced) invalidate();
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(step); } };
  const onScroll = () => {
    scrolling = true;
    root.classList.add('is-scrolling');
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(() => {
      scrolling = false;
      root.classList.remove('is-scrolling');
      queue(); // final depth pass after scrolling stops
    }, 120);
    queue();
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { vh = innerHeight; queue(); });
  step();
  return { refresh: queue };
}