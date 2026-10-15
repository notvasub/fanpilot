import { sim } from '../lib/sim';
import { BUILT_INS, curveFraction, fmtInt, rpmFor, SOURCE_LABEL } from '../lib/control';
import { $, $$, clamp, reducedMotion, setAttr, setText } from './util';

const CW = 520, CH = 200, T0 = 30, T1 = 100;
const x = (t: number) => ((clamp(t, T0, T1) - T0) / (T1 - T0)) * CW;
const y = (p: number) => CH - (p / 100) * (CH - 8) - 4;

/** Sticky card stack: scroll flips through the five built-in profiles. */
export function initProfiles() {
  const section = $('[data-prof]');
  if (!section) return;
  const cards = $$('[data-pcard]', section);
  const jumps = $$('[data-prof-jump]', section);
  const n = cards.length;
  const reduce = reducedMotion();
  const mobile = window.matchMedia('(max-width: 900px)');

  const layout = () => {
    if (mobile.matches) return;
    const r = section.getBoundingClientRect();
    const span = section.offsetHeight - window.innerHeight;
    const p = clamp(-r.top / Math.max(1, span));
    const pos = p * (n - 1);
    const current = Math.round(pos);
    cards.forEach((card, i) => {
      const d = i - pos;
      let t: string, o: number, b = 1;
      if (d < -1) {
        t = 'translateY(-30%) rotateX(70deg)';
        o = 0;
      } else if (d < 0) {
        // Leaving: flips up and away like the film's card flip, gone before the next card is fully forward.
        t = `translateY(${(d * 26).toFixed(2)}%) rotateX(${(-d * 70).toFixed(2)}deg) scale(${(1 + d * 0.05).toFixed(3)})`;
        o = 1 + d * 2.4;
      } else {
        // Waiting: an opaque stack, each card peeking out below the one in front and a little darker.
        t = `translateY(${(d * 22).toFixed(1)}px) scale(${(1 - d * 0.045).toFixed(3)})`;
        o = d < 3 ? 1 : 0;
        b = 1 - Math.min(d, 1.6) * 0.3;
      }
      if (reduce) {
        t = 'none';
        o = i === current ? 1 : 0;
        b = 1;
      }
      card.style.transform = t;
      card.style.opacity = clamp(o).toFixed(3);
      card.style.filter = b < 0.999 ? `brightness(${b.toFixed(3)})` : '';
      card.style.zIndex = String(100 - i);
      card.style.pointerEvents = i === current ? 'auto' : 'none';
      card.setAttribute('aria-hidden', String(i !== current));
    });
    jumps.forEach((j, i) => setAttr(j, 'aria-current', String(i === current)));
  };
  window.addEventListener('scroll', () => requestAnimationFrame(layout), { passive: true });
  window.addEventListener('resize', layout);
  layout();

  jumps.forEach((j) =>
    j.addEventListener('click', () => {
      const i = Number(j.dataset.profJump);
      const top = section.getBoundingClientRect().top + window.scrollY;
      const span = section.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (i / (n - 1)) * span + 2, behavior: reduce ? 'auto' : 'smooth' });
    }),
  );

  section.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-use-profile]');
    if (b) sim.select(b.dataset.useProfile!);
  });

  /* Live dot: where each profile would put the fans at the current temperature. */
  const live = cards.map((card) => {
    const id = card.dataset.profileId!;
    return { id, card, profile: BUILT_INS.find((p) => p.id === id)!, dot: $('[data-pcard-dot]', card), now: $('[data-pcard-now]', card), badge: $('[data-pcard-active]', card) };
  });
  let f = 0;
  sim.on('frame', () => {
    if (f++ % 5) return;
    for (const l of live) {
      const mode = l.profile.modes[0];
      let t = sim.max, pct = 0, text = '';
      if (mode.kind === 'curve') {
        t = mode.source === 'cpuAverage' ? sim.avg : sim.max;
        pct = curveFraction(t, mode.from, mode.to) * 100;
        text = `Now: ${t.toFixed(0)} °C ${SOURCE_LABEL[mode.source] === 'CPU average' ? 'average' : 'hottest'}, so ${Math.round(pct)}% (${fmtInt(rpmFor(pct))} RPM)`;
      } else if (mode.kind === 'fixed') {
        t = sim.avg;
        pct = mode.percent;
        text = `Now: ${Math.round(pct)}% (${fmtInt(rpmFor(pct))} RPM) at any temperature`;
      } else {
        pct = sim.max > 60 ? clamp((sim.max - 60) / 36) * 92 : 0;
        text = `Now: ${t.toFixed(0)} °C hottest. macOS decides.`;
      }
      l.dot?.setAttribute('transform', `translate(${x(t).toFixed(1)} 0)`);
      l.dot?.querySelector('circle')?.setAttribute('cy', y(pct).toFixed(1));
      setText(l.now, text);
    }
  });
  const syncActive = () => {
    for (const l of live) {
      const on = sim.active.kind === 'profile' && sim.active.id === l.id;
      if (l.badge) l.badge.hidden = !on;
    }
  };
  sim.on('change', syncActive);
  syncActive();
}
