import { sim } from '../lib/sim';
import { icons } from '../lib/icons';
import { curveFraction, fmtInt, modeForFan, modeSummary, rpmFor, SOURCE_LABEL, type FanMode, type Profile, type Source } from '../lib/control';
import { $, $$, clamp, fitCanvas, heatCSS, setText, visibility } from './util';

const W = 640, H = 340, T0 = 30, T1 = 105;
const X = (t: number) => ((clamp(t, T0, T1) - T0) / (T1 - T0)) * W;
const Y = (p: number) => H - (clamp(p, 0, 100) / 100) * H;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Profiles window (ProfilesWindow.swift) plus the draggable curve it edits. */
export function initCurves() {
  const pw = $('[data-pw]');
  const chart = $('.cchart');
  if (!pw || !chart) return;
  const list = $('[data-pw-list]', pw)!;
  const editor = $('[data-pw-editor]', pw)!;
  const svg = $<SVGSVGElement>('[data-cc-svg]', chart)!;
  const line = $('[data-cc-line]', svg)!;
  const area = $('[data-cc-area]', svg)!;
  const hFrom = $<SVGGElement>('[data-cc-handle="from"]', svg)!;
  const hTo = $<SVGGElement>('[data-cc-handle="to"]', svg)!;
  const live = $<SVGGElement>('[data-cc-live]', svg)!;
  const tip = $<SVGGElement>('[data-cc-tip]', svg)!;
  const tipText = $('[data-cc-tiptext]', svg)!;
  const tipRect = tip.querySelector('rect')!;
  const xlabel = $('[data-cc-xlabel]', svg)!;
  const nameEl = $('[data-cc-name]', chart);
  const sumEl = $('[data-cc-summary]', chart);
  const lockNote = $('[data-cc-lock]', chart)!;
  const flatNote = $('[data-cc-flat]', chart)!;
  const fanSeg = $('[data-cc-fan]', chart)!;

  let selected = sim.custom[0]?.id ?? sim.profiles[0].id;
  let fan = 0;
  const profile = () => sim.profile(selected) ?? sim.profiles[0];
  const mode = () => modeForFan(profile(), fan);

  const commit = (next: Profile) => {
    if (next.builtIn) return;
    sim.updateProfile(next);
  };
  const setMode = (fanIndex: number, m: FanMode) => {
    const p = structuredClone(profile());
    if (p.modes.length === 0) p.modes = [m];
    else p.modes[Math.min(fanIndex, p.modes.length - 1)] = m;
    commit(p);
  };

  /* Sidebar */
  const renderList = () => {
    const row = (p: Profile) =>
      `<button type="button" role="option" class="pw__row" data-pw-select="${p.id}" aria-selected="${p.id === selected}">${esc(p.name)}</button>`;
    list.innerHTML =
      `<div class="pw__section">Built-in</div>` +
      sim.profiles.filter((p) => p.builtIn).map(row).join('') +
      `<div class="pw__section">Custom</div>` +
      sim.custom.map(row).join('');
    $<HTMLButtonElement>('[data-pw-remove]', pw)!.disabled = profile().builtIn;
  };
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pw-select]');
    if (!b) return;
    selected = b.dataset.pwSelect!;
    fan = 0;
    renderAll();
  });
  $('[data-pw-add]', pw)!.addEventListener('click', () => {
    const p = sim.addProfile('Custom', [{ kind: 'curve', source: 'cpuAverage', from: 50, to: 80 }]);
    selected = p.id;
    renderAll();
  });
  $('[data-pw-remove]', pw)!.addEventListener('click', () => {
    if (profile().builtIn) return;
    sim.deleteProfile(selected);
    selected = sim.custom[0]?.id ?? sim.profiles[0].id;
    renderAll();
  });

  /* Editor form */
  const stepper = (key: string, label: string) =>
    `<div class="pw__field"><span>${label}</span><span class="pw__stepper"><button type="button" data-step-k="${key}" data-d="-1" aria-label="Lower">${icons.minus}</button><button type="button" data-step-k="${key}" data-d="1" aria-label="Higher">${icons.plus}</button></span></div>`;
  const modeFields = (m: FanMode, i: number, ro: boolean) => {
    const kind = m.kind === 'automatic' ? 'automatic' : m.kind === 'fixed' ? 'fixed' : 'curve';
    let out = `<div class="pw__field"><label for="pw-mode-${i}">Mode</label><select class="mac-select" id="pw-mode-${i}" data-mode-fan="${i}" ${ro ? 'disabled' : ''}>
      <option value="automatic" ${kind === 'automatic' ? 'selected' : ''}>Automatic</option>
      <option value="fixed" ${kind === 'fixed' ? 'selected' : ''}>Fixed speed</option>
      <option value="curve" ${kind === 'curve' ? 'selected' : ''}>Follow temperature</option></select></div>`;
    if (m.kind === 'automatic') out += `<div class="pw__field"><span class="pw__note">The Mac's own thermal management controls this fan.</span></div>`;
    if (m.kind === 'fixed')
      out += `<div class="pw__field"><span>Speed</span><span style="display:flex;align-items:center;gap:8px"><input class="mac-range" type="range" min="0" max="100" step="1" value="${Math.round(m.percent)}" data-fixed-fan="${i}" aria-label="Fixed speed" style="--fill:${m.percent}%" ${ro ? 'disabled' : ''}/><span class="tnum" style="width:38px;text-align:right" data-fixed-label="${i}">${Math.round(m.percent)}%</span></span></div>`;
    if (m.kind === 'curve') {
      out += `<div class="pw__field"><label for="pw-src-${i}">Sensor</label><select class="mac-select" id="pw-src-${i}" data-src-fan="${i}" ${ro ? 'disabled' : ''}>
        ${(['cpuAverage', 'cpuMax'] as Source[]).map((s) => `<option value="${s}" ${m.source === s ? 'selected' : ''}>${SOURCE_LABEL[s]}</option>`).join('')}</select></div>`;
      out += stepper(`from:${i}`, `Start ramping at <b class="tnum">${Math.trunc(m.from)} °C</b>`);
      out += stepper(`to:${i}`, `Full speed at <b class="tnum">${Math.trunc(m.to)} °C</b>`);
    }
    return out;
  };
  const renderEditor = () => {
    const p = profile();
    const ro = p.builtIn;
    const separate = p.modes.length > 1;
    const sections = separate ? [0, 1] : [0];
    editor.innerHTML = `
      <div class="pw__group">
        <div class="pw__field"><label for="pw-name">Name</label><input class="mac-input" id="pw-name" type="text" value="${esc(p.name)}" data-pw-name ${ro ? 'disabled' : ''}/></div>
        <div class="pw__field"><span id="pw-sep">Separate settings per fan</span><button type="button" class="mac-toggle" role="switch" aria-labelledby="pw-sep" aria-checked="${separate}" data-pw-sep ${ro ? 'disabled' : ''}></button></div>
      </div>
      ${sections
        .map(
          (i) => `<span class="pw__group-title">${separate ? `Fan ${i + 1}` : 'All fans'}</span>
        <div class="pw__group" ${ro ? 'aria-disabled="true"' : ''}>${modeFields(modeForFan(p, i), i, ro)}</div>`,
        )
        .join('')}
      <div class="pw__actions">
        <button type="button" class="mac-btn" data-pw-use>Use This Profile</button>
        <button type="button" class="mac-btn" data-pw-dup>Duplicate</button>
        ${ro ? '<span class="pw__note">Built-in profiles are read-only.</span>' : ''}
      </div>`;
    $$<HTMLButtonElement>('.pw__stepper button', editor).forEach((b) => (b.disabled = ro));
  };

  editor.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const p = profile();
    if (p.builtIn) return;
    if (t.matches('[data-pw-name]')) {
      commit({ ...structuredClone(p), name: t.value });
      renderList();
      setText(nameEl, t.value || 'Untitled');
    }
    if (t.matches('[data-fixed-fan]')) {
      const i = Number(t.dataset.fixedFan);
      t.style.setProperty('--fill', `${t.value}%`);
      setText($(`[data-fixed-label="${i}"]`, editor), `${t.value}%`);
      setMode(i, { kind: 'fixed', percent: Number(t.value) });
      renderChart();
    }
  });
  editor.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    const p = profile();
    if (p.builtIn) return;
    if (t.matches('[data-mode-fan]')) {
      const i = Number(t.dataset.modeFan);
      const next: FanMode =
        t.value === 'automatic' ? { kind: 'automatic' } : t.value === 'fixed' ? { kind: 'fixed', percent: 50 } : { kind: 'curve', source: 'cpuAverage', from: 50, to: 80 };
      setMode(i, next);
      renderAll(`#pw-mode-${i}`);
    }
    if (t.matches('[data-src-fan]')) {
      const i = Number(t.dataset.srcFan);
      const m = modeForFan(p, i);
      if (m.kind === 'curve') setMode(i, { ...m, source: t.value as Source });
      renderAll(`#pw-src-${i}`);
    }
  });
  editor.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const p = profile();
    if (t.closest('[data-pw-use]')) {
      sim.select(p.id);
      return;
    }
    if (t.closest('[data-pw-dup]')) {
      const copy = sim.addProfile(p.name, structuredClone(p.modes));
      selected = copy.id;
      renderAll();
      return;
    }
    if (p.builtIn) return;
    if (t.closest('[data-pw-sep]')) {
      const first = modeForFan(p, 0);
      commit({ ...structuredClone(p), modes: p.modes.length > 1 ? [first] : [structuredClone(first), structuredClone(first)] });
      fan = 0;
      renderAll('[data-pw-sep]');
      return;
    }
    const st = t.closest<HTMLElement>('[data-step-k]');
    if (st) {
      const [k, i] = st.dataset.stepK!.split(':');
      const d = Number(st.dataset.d);
      const m = modeForFan(p, Number(i));
      if (m.kind !== 'curve') return;
      if (k === 'from') setCurve(Number(i), m.from + d, m.to, 'from');
      else setCurve(Number(i), m.from, m.to + d, 'to');
      renderAll(`[data-step-k="${k}:${i}"][data-d="${d}"]`);
    }
  });

  /** Same bounds as the steppers in ProfilesWindow.swift: start 30–95, full 35–105, at least 5 °C apart. */
  const setCurve = (i: number, from: number, to: number, moved: 'from' | 'to') => {
    const m = modeForFan(profile(), i);
    if (m.kind !== 'curve') return;
    let f = Math.round(from), t = Math.round(to);
    if (moved === 'from') f = clamp(Math.min(f, t - 5), 30, 95);
    else t = clamp(Math.max(t, f + 5), 35, 105);
    setMode(i, { ...m, from: f, to: t });
  };

  /* Chart */
  const renderChart = () => {
    const p = profile();
    const m = mode();
    chart.classList.toggle('is-locked', p.builtIn);
    lockNote.hidden = !p.builtIn;
    setText(nameEl, p.name);
    setText(sumEl, p.modes.length > 1 ? `Fan ${fan + 1}: ${modeSummary(m)}` : modeSummary(m));
    fanSeg.hidden = p.modes.length < 2;
    $$('[data-cc-fanbtn]', fanSeg).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.ccFanbtn) === fan)));
    const isCurve = m.kind === 'curve';
    flatNote.hidden = isCurve || p.builtIn;
    hFrom.style.display = hTo.style.display = isCurve ? '' : 'none';
    xlabel.textContent = `${m.kind === 'curve' ? SOURCE_LABEL[m.source] : 'CPU average'}, °C`;
    if (m.kind === 'automatic') {
      line.setAttribute('d', '');
      area.setAttribute('d', '');
      return;
    }
    const pts: [number, number][] =
      m.kind === 'fixed'
        ? [
            [T0, m.percent],
            [T1, m.percent],
          ]
        : [
            [T0, 0],
            [m.from, 0],
            [m.to, 100],
            [T1, 100],
          ];
    const d = pts.map(([t, pc], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(pc).toFixed(1)}`).join('');
    line.setAttribute('d', d);
    area.setAttribute('d', `${d}L${W},${H}L0,${H}Z`);
    if (m.kind === 'curve') {
      hFrom.setAttribute('transform', `translate(${X(m.from).toFixed(1)} ${Y(0)})`);
      hTo.setAttribute('transform', `translate(${X(m.to).toFixed(1)} ${Y(100)})`);
      hFrom.querySelector('text')!.textContent = `${m.from} °C`;
      hTo.querySelector('text')!.textContent = `${m.to} °C`;
      hFrom.setAttribute('aria-valuenow', String(m.from));
      hTo.setAttribute('aria-valuenow', String(m.to));
      hFrom.setAttribute('aria-valuetext', `Start ramping at ${m.from} degrees`);
      hTo.setAttribute('aria-valuetext', `Full speed at ${m.to} degrees`);
    }
  };
  fanSeg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cc-fanbtn]');
    if (!b) return;
    fan = Number(b.dataset.ccFanbtn);
    renderChart();
  });

  /* Dragging the handles */
  const tempAt = (clientX: number) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return T0 + (loc.x / W) * (T1 - T0);
  };
  const drag = (handle: SVGGElement, which: 'from' | 'to') => {
    handle.addEventListener('pointerdown', (e) => {
      if (profile().builtIn) {
        lockNote.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 260 });
        return;
      }
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('is-drag');
      const move = (ev: PointerEvent) => {
        const m = mode();
        if (m.kind !== 'curve') return;
        const t = tempAt(ev.clientX);
        if (which === 'from') setCurve(fan, t, m.to, 'from');
        else setCurve(fan, m.from, t, 'to');
        renderChart();
      };
      const up = () => {
        handle.classList.remove('is-drag');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        renderEditor();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
    handle.addEventListener('keydown', (e) => {
      const m = mode();
      if (m.kind !== 'curve' || profile().builtIn) return;
      const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 }[e.key];
      if (!d) return;
      e.preventDefault();
      if (which === 'from') setCurve(fan, m.from + d, m.to, 'from');
      else setCurve(fan, m.from, m.to + d, 'to');
      renderChart();
      renderEditor();
    });
  };
  drag(hFrom, 'from');
  drag(hTo, 'to');

  /* Live temperature dot rides the line */
  let f = 0;
  sim.on('frame', () => {
    if (f++ % 3) return;
    const m = mode();
    if (m.kind === 'automatic') {
      live.style.display = 'none';
      return;
    }
    live.style.display = '';
    const t = m.kind === 'curve' ? (m.source === 'cpuAverage' ? sim.avg : sim.max) : sim.avg;
    const pct = m.kind === 'curve' ? curveFraction(t, m.from, m.to) * 100 : m.percent;
    live.setAttribute('transform', `translate(${X(t).toFixed(1)} 0)`);
    live.querySelector('circle')!.setAttribute('cy', Y(pct).toFixed(1));
    const label = `${t.toFixed(0)} °C → ${Math.round(pct)}%, ${fmtInt(rpmFor(pct))} RPM`;
    if (tipText.textContent !== label) {
      tipText.textContent = label;
      const w = label.length * 7.4 + 22;
      tipRect.setAttribute('width', w.toFixed(0));
      tipRect.setAttribute('x', (-w / 2).toFixed(0));
    }
    const ty = Y(pct);
    const flip = ty < 60;
    tip.setAttribute('transform', `translate(0 ${flip ? ty + 72 : ty})`);
  });

  /* Smoothing chart: what the curve asks for vs. what FanPilot sends */
  const canvas = $<HTMLCanvasElement>('[data-smooth]')!;
  const vis = visibility(canvas);
  const draw = () => {
    if (!vis.visible) return;
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const data = sim.history.slice(-120);
    const yR = (rpm: number) => h - 6 - ((rpm - 2317) / (7826 - 2317)) * (h - 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 6 + (i * (h - 12)) / 4);
      ctx.lineTo(w, 6 + (i * (h - 12)) / 4);
      ctx.stroke();
    }
    const hasCurve = data.some((s) => s.desired !== null);
    if (!hasCurve) {
      ctx.fillStyle = 'rgba(245,245,247,0.55)';
      ctx.font = '500 13px "Inter Variable", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pick a profile with a curve, then change the workload.', w / 2, h / 2 + 4);
      return;
    }
    const x = (i: number) => w - (data.length - 1 - i) * (w / 119);
    const path = (get: (s: (typeof data)[number]) => number | null, stepped: boolean) => {
      ctx.beginPath();
      let started = false;
      let prevY = 0;
      data.forEach((s, i) => {
        const v = get(s);
        if (v === null) {
          started = false;
          return;
        }
        const yy = yR(v);
        if (!started) ctx.moveTo(x(i), yy);
        else if (stepped) {
          ctx.lineTo(x(i), prevY);
          ctx.lineTo(x(i), yy);
        } else ctx.lineTo(x(i), yy);
        started = true;
        prevY = yy;
      });
    };
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(245,245,247,0.6)';
    ctx.lineWidth = 1.5;
    path((s) => s.desired, false);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = heatCSS(sim.heat);
    ctx.lineWidth = 2.5;
    path((s) => s.target, true);
    ctx.stroke();
  };
  sim.on('sample', draw);

  const renderAll = (focusSel?: string) => {
    renderList();
    renderEditor();
    renderChart();
    if (focusSel) ($(focusSel, editor) as HTMLElement | null)?.focus();
  };
  sim.on('profiles', () => {
    if (!sim.profile(selected)) selected = sim.profiles[0].id;
    renderList();
    renderChart();
  });
  renderAll();
}
