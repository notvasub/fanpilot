import { $, $$, clamp, reducedMotion } from './util';

/**
 * Depth planes. data-plane="k": the element moves k × (distance between the viewport centre and its
 * section's centre). Negative k is nearer and faster; positive k is farther and slower. data-soft adds
 * a little blur as the nearest plane leaves, like a lens racking past it.
 */
export function initMotion() {
  if (reducedMotion()) return;
  const planes = $$('[data-plane]').map((el) => ({
    el,
    k: Number(el.dataset.plane),
    soft: el.hasAttribute('data-soft'),
    host: (el.closest('section') ?? el.parentElement!) as HTMLElement,
  }));
  const desk = $('[data-desk]');
  const kb = $('[data-kb]');
  const kbWrap = $('[data-kb-wrap]');

  let queued = false;
  const update = () => {
    queued = false;
    const vh = window.innerHeight;
    const vc = vh / 2;
    for (const p of planes) {
      const r = p.host.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      const hc = p.host.id === 'top' ? vc - window.scrollY : r.top + r.height / 2;
      const off = (vc - hc) * p.k;
      p.el.style.translate = `0 ${off.toFixed(1)}px`;
      if (p.soft) {
        const s = clamp(window.scrollY / (vh * 0.9));
        p.el.style.filter = s > 0.02 ? `blur(${(s * 5).toFixed(2)}px)` : '';
        p.el.style.opacity = (1 - s * 0.7).toFixed(3);
      }
    }
    // The hero Mac starts tipped back and settles flat as you scroll toward it.
    if (desk) desk.style.setProperty('--tilt', `${(14 * (1 - clamp(window.scrollY / (vh * 0.6)))).toFixed(2)}deg`);
    // The keyboard rises from flat on the desk to facing you.
    if (kb && kbWrap) {
      const r = kbWrap.getBoundingClientRect();
      const p = clamp((vh - r.top) / (vh * 0.75));
      kb.style.setProperty('--kb-tilt', `${(52 * (1 - p) + 6).toFixed(2)}deg`);
    }
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
}
