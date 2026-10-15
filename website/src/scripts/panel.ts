import { sim } from '../lib/sim';
import { icons } from '../lib/icons';
import { FAN_RANGE, modeForFan, modeSummary, percentFor, rpmText } from '../lib/control';
import { $, $$, fitCanvas, heatCSS, setAttr, setStyle, setText, visibility } from './util';

/** The menu-bar panel (MenuContentView) and the desktop around it. */
export function initPanel() {
  const panel = $('[data-panel]');
  const wrap = $('[data-panel-wrap]');
  const item = $('[data-menubar-item]');
  if (!panel || !wrap || !item) return;

  /* Fan rows, also used by the safety window. */
  const fanRows = $$('[data-fan], [data-watch-fan]').map((row) => ({
    index: Number(row.dataset.fan ?? row.dataset.watchFan),
    badge: $('[data-badge]', row),
    rpm: $('[data-rpm]', row),
    bar: $('[data-bar]', row),
    sub: $('[data-sub]', row),
  }));
  let f = 0;
  sim.on('frame', () => {
    if (f++ % 4) return;
    for (const r of fanRows) {
      const fan = sim.fans[r.index];
      setText(r.badge, fan.manual ? 'Manual' : 'Auto');
      r.badge?.classList.toggle('is-manual', fan.manual);
      setText(r.rpm, rpmText(fan.actual));
      setStyle(r.bar, 'width', `${percentFor(fan.actual).toFixed(1)}%`);
      setText(r.sub, `${FAN_RANGE.min}–${FAN_RANGE.max} RPM · target ${Math.round(fan.target)}`);
    }
  });

  /* Profiles list */
  const list = $('[data-profile-list]', panel)!;
  const renderList = () => {
    list.innerHTML = '';
    for (const p of sim.profiles) {
      const on = sim.active.kind === 'profile' && sim.active.id === p.id;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mp__item';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      b.dataset.select = p.id;
      b.innerHTML = `<span class="mp__radio">${on ? `<span class="icon">${icons.check}</span>` : ''}</span><span></span><small></small>`;
      b.children[1].textContent = p.name;
      b.children[2].textContent = modeSummary(modeForFan(p, 0));
      list.append(b);
    }
  };
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-select]');
    if (b) sim.select(b.dataset.select!);
  });

  /* Manual speed */
  const range = $<HTMLInputElement>('[data-manual-range]', panel)!;
  const pctLabel = $('[data-manual-pct]', panel);
  let dragging = false;
  range.addEventListener('pointerdown', () => (dragging = true));
  window.addEventListener('pointerup', () => (dragging = false));
  range.addEventListener('input', () => {
    sim.setManualPercent(Number(range.value));
  });
  range.addEventListener('change', () => sim.showHUD());
  sim.on('frame', () => {
    if (f % 4) return;
    const pct = sim.currentPercent;
    if (!dragging && document.activeElement !== range) range.value = String(Math.round(pct));
    setStyle(range, '--fill', `${range.value}%`);
    setText(pctLabel, sim.active.kind === 'manual' ? `${Math.round(sim.active.percent)}%` : '');
  });
  $$('[data-nudge]', panel).forEach((b) => b.addEventListener('click', () => sim.nudge(Number(b.dataset.nudge))));

  /* Save as Profile… */
  const save = $('[data-save-area]', panel)!;
  let saving = false;
  const renderSave = () => {
    if (sim.active.kind !== 'manual') {
      saving = false;
      save.innerHTML = '';
      return;
    }
    if (saving) {
      if ($('input', save)) return;
      save.innerHTML = `<input class="mac-input" type="text" aria-label="Profile name" /><button class="mac-btn" type="button" data-save-go>Save</button>`;
      const input = $<HTMLInputElement>('input', save)!;
      input.value = sim.activeName;
      input.focus();
      input.select();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          saving = false;
          renderSave();
        }
      });
    } else {
      if ($('[data-save-start]', save)) return;
      save.innerHTML = `<button class="mac-btn" type="button" data-save-start>Save as Profile…</button>`;
    }
  };
  const commit = () => {
    const input = $<HTMLInputElement>('input', save);
    saving = false;
    sim.saveManualAsProfile(input?.value ?? '');
  };
  save.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-save-start]')) {
      saving = true;
      renderSave();
    } else if (t.closest('[data-save-go]')) commit();
  });

  /* Status banner */
  const banner = $('[data-banner]', panel)!;
  const bannerText = $('[data-banner-text]', panel);
  const bannerActions = $('[data-banner-actions]', panel)!;
  const renderBanner = () => {
    const msg = sim.statusMessage();
    banner.hidden = !msg;
    if (!msg) return;
    setText(bannerText, msg);
    const actions: [string, () => void][] = [];
    if (sim.mfcRunning) actions.push(['Quit Macs Fan Control', () => sim.setMacsFanControl(false)]);
    if (sim.helper === 'notInstalled') actions.push(['Install Helper…', () => sim.setHelper('needsApproval')]);
    if (sim.helper === 'needsApproval') actions.push(['Open Login Items', () => sim.setHelper('ready')]);
    bannerActions.innerHTML = '';
    for (const [label, fn] of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mac-btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      bannerActions.append(b);
    }
  };

  /* Helper status menu */
  const menuBtn = $('[data-helper-menu-btn]', panel)!;
  const menu = $('[data-helper-menu]', panel)!;
  const closeMenu = () => {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  };
  const renderMenu = () => {
    const check = `<span class="icon">${icons.check}</span>`;
    menu.innerHTML = `
      <button type="button" role="menuitem" data-m="helper">${sim.helper === 'notInstalled' ? 'Install Helper…' : 'Uninstall Helper'}</button>
      <button type="button" role="menuitemcheckbox" aria-checked="${sim.launchAtLogin}" data-m="login">${sim.launchAtLogin ? check : ''}Launch at Login</button>
      <hr />
      <span class="mp__pop-label">Hotkey Step</span>
      ${[5, 10, 15, 20, 25].map((s) => `<button type="button" role="menuitemradio" aria-checked="${s === sim.step}" data-m="step" data-v="${s}">${s === sim.step ? check : ''}${s}%</button>`).join('')}`;
  };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!menu.hidden) return closeMenu();
    renderMenu();
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    ($('button', menu) as HTMLElement | null)?.focus();
  });
  menu.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-m]');
    if (!b) return;
    if (b.dataset.m === 'helper') sim.setHelper(sim.helper === 'notInstalled' ? 'needsApproval' : 'notInstalled');
    if (b.dataset.m === 'login') {
      sim.launchAtLogin = !sim.launchAtLogin;
      sim.emit('change');
    }
    if (b.dataset.m === 'step') sim.setStep(Number(b.dataset.v));
    closeMenu();
    menuBtn.focus();
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node)) closeMenu();
  });
  menu.addEventListener('keydown', (e) => {
    const items = $$<HTMLButtonElement>('button', menu);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      closeMenu();
      menuBtn.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    }
  });

  $('[data-open-profiles]', panel)?.addEventListener('click', () => document.querySelector('#curves')?.scrollIntoView({ behavior: 'smooth' }));
  $('[data-quit]', panel)?.addEventListener('click', () => sim.quit('quit'));

  /* Menu-bar item opens and closes the panel */
  let open = true;
  const setOpen = (v: boolean) => {
    open = v;
    wrap.classList.toggle('is-closed', !v);
    item.classList.toggle('is-open', v);
    item.setAttribute('aria-expanded', String(v));
    wrap.inert = !v;
  };
  item.addEventListener('click', () => setOpen(!open));

  /* Quit / crash notice */
  const note = $('[data-quit-note]');
  const noteTitle = $('[data-quit-title]');
  const noteDetail = $('[data-quit-detail]');
  $('[data-relaunch]')?.addEventListener('click', () => {
    sim.relaunch();
    setOpen(true);
  });
  const renderRunning = () => {
    item.hidden = !sim.running;
    if (!sim.running) {
      wrap.classList.add('is-closed');
      wrap.inert = true;
    } else {
      setOpen(open);
    }
    if (note) {
      note.hidden = sim.running;
      if (sim.stopReason === 'crash') {
        setText(noteTitle, 'FanPilot quit unexpectedly');
        setText(noteDetail, 'Its helper set both fans back to Automatic.');
      } else {
        setText(noteTitle, 'FanPilot quit');
        setText(noteDetail, 'Both fans went back to Automatic before it exited.');
      }
    }
  };

  const onChange = () => {
    renderList();
    renderSave();
    renderBanner();
    renderRunning();
  };
  sim.on('change', onChange);
  sim.on('profiles', renderList);
  onChange();

  /* Clock in the menu bar */
  const clock = $('[data-clock]');
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const tick = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
    if (clock) clock.innerHTML = `${fmt.format(now).replace(',', '')}&nbsp;&nbsp;${time}`;
  };
  tick();
  window.setInterval(tick, 20000);
}

/** Workload window chart: CPU temperature and fan speed over the last minute. */
export function initHistory() {
  const canvas = $<HTMLCanvasElement>('[data-history]');
  if (!canvas) return;
  const vis = visibility(canvas);
  const draw = () => {
    if (!vis.visible) return;
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (h * i) / 4);
      ctx.lineTo(w, (h * i) / 4);
      ctx.stroke();
    }
    const data = sim.history.slice(-120);
    if (data.length < 2) return;
    const x = (i: number) => (i / 119) * w + (120 - data.length) * (w / 119);
    const line = (val: (s: (typeof data)[number]) => number, color: string, width: number) => {
      ctx.beginPath();
      data.forEach((s, i) => (i ? ctx.lineTo(x(i), val(s)) : ctx.moveTo(x(i), val(s))));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    line((s) => h - ((s.avg - 30) / 75) * (h - 8) - 4, heatCSS(sim.heat), 2);
    line((s) => h - (s.rpm / FAN_RANGE.max) * (h - 8) - 4, 'rgba(245,245,247,0.85)', 1.5);
  };
  sim.on('sample', draw);
  window.addEventListener('resize', draw);
}

export { setAttr };
