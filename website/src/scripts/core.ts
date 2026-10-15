import { sim } from '../lib/sim';
import { fanFill, fanOutline } from '../lib/icons';
import { FAN_RANGE, fmtInt, modeForFan, modeSummary, percentFor, rpmFor, rpmText } from '../lib/control';
import { $, $$, heatCSS, isTyping, setAttr, setStyle, setText } from './util';

/* ───────────── Live accent + text bindings ───────────── */
export function initBindings() {
  const root = document.documentElement;
  const bind = (name: string) => $$(`[data-bind="${name}"]`);
  const els = {
    avgRpm: [...bind('avgRpm'), ...bind('avgRpmBar')],
    avgRpmGrouped: bind('avgRpmWl'),
    cpuLine: bind('cpuLine'),
    cpuAvg: bind('cpuAvg'),
    hintStep: bind('hintStep'),
    helperStatus: bind('helperStatus'),
    activeName: [...bind('activeName'), ...bind('activeName2')],
    speedDetail: bind('speedDetail'),
  };
  let heatT = -1;
  let frame = 0;

  sim.on('frame', () => {
    // Accent follows fan speed, smoothed so it breathes rather than flickers.
    const target = sim.heat;
    heatT = heatT < 0 ? target : heatT + (target - heatT) * 0.06;
    if (frame++ % 3 === 0) {
      setStyle(root, '--heat', heatCSS(heatT));
      setStyle(root, '--heat-t', heatT.toFixed(3));
    }
    if (frame % 6 !== 0) return;
    const avg = sim.averageRPM;
    els.avgRpm.forEach((el) => setText(el, String(Math.round(avg))));
    els.avgRpmGrouped.forEach((el) => setText(el, fmtInt(avg)));
    els.cpuLine.forEach((el) => setText(el, `${sim.avg.toFixed(0)} °C avg · ${sim.max.toFixed(0)} °C max`));
    els.cpuAvg.forEach((el) => setText(el, sim.avg.toFixed(1)));
    els.activeName.forEach((el) => setText(el, sim.activeName));
    let detail: string;
    if (sim.active.kind === 'manual') detail = `≈ ${rpmText(rpmFor(sim.active.percent))}`;
    else if (avg < 1) detail = 'Fans stopped';
    else detail = `${rpmText(avg)} now`;
    els.speedDetail.forEach((el) => setText(el, detail));
  });

  const discrete = () => {
    els.hintStep.forEach((el) => setText(el, `fn F4 / fn F5 — slower / faster by ${sim.step}%`));
    const status = { ready: 'Helper: running', notInstalled: 'Helper: not installed', needsApproval: 'Helper: waiting for approval' }[sim.helper];
    els.helperStatus.forEach((el) => setText(el, status));
  };
  sim.on('change', discrete);
  discrete();
}

/* ───────────── Spinning fan glyphs ───────────── */
export function initSpinners() {
  const menubar = $$('[data-menubar-fan]');
  let wasAuto: boolean | null = null;
  const spinTargets = () =>
    [
      ...menubar.map((el) => ({ el, fan: -1 })),
      ...$$('[data-spin]').map((el) => ({ el, fan: el.dataset.spin === 'avg' ? -1 : Number(el.dataset.spin) })),
      ...$$('[data-hud-fan]').map((el) => ({ el, fan: -1 })),
      ...$$('[data-spin-icon]').map((el) => ({ el, fan: -1 })),
    ].map((t) => ({ ...t, g: () => t.el.querySelector('[data-blades]') }));
  let targets = spinTargets();

  sim.on('frame', () => {
    const auto = sim.isAutomatic;
    if (auto !== wasAuto) {
      wasAuto = auto;
      menubar.forEach((el) => (el.innerHTML = auto ? fanOutline : fanFill));
      targets = spinTargets();
    }
    for (const t of targets) {
      const g = t.g();
      if (!g) continue;
      const a = t.fan < 0 ? (sim.angle[0] + sim.angle[1]) / 2 : sim.angle[t.fan];
      g.setAttribute('transform', `rotate(${a.toFixed(1)} 50 50)`);
    }
  });
}

/* ───────────── HUD ───────────── */
export function initHud() {
  const hud = $('[data-hud]');
  if (!hud) return;
  const title = $('[data-hud-title]', hud);
  const detail = $('[data-hud-detail]', hud);
  const bar = $('[data-hud-bar]', hud);
  const segs = bar ? $$('i', bar) : [];
  let timer = 0;
  sim.on<{ title: string; detail: string; fraction: number | null }>('hud', (h) => {
    setText(title, h.title);
    setText(detail, h.detail);
    if (bar) bar.hidden = h.fraction === null;
    if (h.fraction !== null) segs.forEach((s, i) => s.style.setProperty('--f', String(Math.min(1, Math.max(0, h.fraction! * 10 - i)))));
    hud.classList.add('is-on');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => hud.classList.remove('is-on'), 1400);
  });
}

/* ───────────── Keyboard: real keys and the drawn keycaps ───────────── */
export type KeyAction = 'faster' | 'slower' | 'auto' | 'next';

let stickyShift = false;
const keyEls = (name: string) => $$(`[data-key="${name}"]`);

export function flashKeys(names: string[]) {
  for (const name of names) {
    for (const el of keyEls(name)) {
      el.classList.add('is-down', 'is-lit');
      window.setTimeout(() => el.classList.remove('is-down'), 170);
      const prev = Number(el.dataset.litTimer || 0);
      window.clearTimeout(prev);
      el.dataset.litTimer = String(window.setTimeout(() => el.classList.remove('is-lit'), 1100));
    }
  }
}

export function runAction(action: KeyAction) {
  switch (action) {
    case 'faster':
      flashKeys(['fn', 'F5']);
      sim.nudge(+1);
      break;
    case 'slower':
      flashKeys(['fn', 'F4']);
      sim.nudge(-1);
      break;
    case 'auto':
      flashKeys(['fn', 'shift', 'F4']);
      sim.resetToAutomatic();
      break;
    case 'next':
      flashKeys(['fn', 'shift', 'F5']);
      sim.cycleProfile();
      break;
  }
  $$(`[data-shortcut="${action}"]`).forEach((el) => {
    el.classList.add('is-fired');
    window.setTimeout(() => el.classList.remove('is-fired'), 450);
  });
}

const actionFor = (key: 'F4' | 'F5', shift: boolean): KeyAction =>
  key === 'F5' ? (shift ? 'next' : 'faster') : shift ? 'auto' : 'slower';

export function initKeys() {
  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') {
      keyEls('shift').forEach((el) => el.classList.add('is-lit'));
      return;
    }
    if (e.key !== 'F4' && e.key !== 'F5') return;
    e.preventDefault();
    runAction(actionFor(e.key, e.shiftKey));
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && !stickyShift) keyEls('shift').forEach((el) => el.classList.remove('is-lit'));
  });

  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
    if (el && el.tagName === 'BUTTON') {
      const key = el.dataset.key!;
      if (key === 'F4' || key === 'F5') {
        runAction(actionFor(key, e.shiftKey || stickyShift));
      } else if (key === 'shift') {
        stickyShift = !stickyShift;
        keyEls('shift').forEach((k) => {
          k.setAttribute('aria-pressed', String(stickyShift));
          k.classList.toggle('is-lit', stickyShift);
        });
      } else {
        flashKeys([key]);
      }
      return;
    }
    const sc = (e.target as HTMLElement).closest<HTMLElement>('[data-shortcut]');
    if (sc) runAction(sc.dataset.shortcut as KeyAction);
  });
}

/* ───────────── Workload controls (several places on the page) ───────────── */
export function initLoadControls() {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-load]');
    if (b) sim.setLoad(b.dataset.load as any);
  });
  const sync = () => $$('[data-load]').forEach((b) => setAttr(b, 'aria-pressed', String(b.dataset.load === sim.load)));
  sim.on('change', sync);
  sync();
}

/* ───────────── Nav ───────────── */
export function initNav() {
  const nav = $('[data-nav]');
  const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const links = $$<HTMLAnchorElement>('.nav__links a');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${entry.target.id}`)));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  links.forEach((a) => {
    const target = document.querySelector(a.hash);
    if (target) io.observe(target);
  });
}

/* ───────────── Copy buttons ───────────── */
export function initCopy() {
  document.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.copy || '');
      b.classList.add('is-done');
      const label = b.getAttribute('aria-label') || '';
      b.setAttribute('aria-label', 'Copied');
      window.setTimeout(() => {
        b.classList.remove('is-done');
        b.setAttribute('aria-label', label);
      }, 1400);
    } catch {
      /* Clipboard blocked: the text stays selectable in the block. */
    }
  });
}

/* ───────────── Shortcuts section readout ───────────── */
export function initSpeedReadout() {
  const bar = $('[data-speed-bar]');
  const segs = bar ? $$('i', bar) : [];
  let f = 0;
  sim.on('frame', () => {
    if (f++ % 3) return;
    const avg = sim.averageRPM;
    const pct = avg < 1 ? 0 : percentFor(avg);
    // An idle stopped fan reads as empty; a fan at its minimum shows a sliver so "on" is visible.
    const fill = avg < 1 ? 0 : Math.max(pct, 1.5);
    segs.forEach((s, i) => setStyle(s, '--f', Math.min(1, Math.max(0, (fill / 100) * 10 - i)).toFixed(3)));
  });
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-step]');
    if (b) sim.setStep(Number(b.dataset.step));
  });
  const sync = () => $$('[data-step]').forEach((b) => setAttr(b, 'aria-pressed', String(Number(b.dataset.step) === sim.step)));
  sim.on('change', sync);
  sync();
}

export { FAN_RANGE, modeForFan, modeSummary };
