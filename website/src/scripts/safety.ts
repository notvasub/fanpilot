import { sim, type Write } from '../lib/sim';
import { AUTOMATIC_ID } from '../lib/control';
import { $, $$, mmss, setText } from './util';

/** Five ways FanPilot can stop, each run against the simulated Mac with a log of what happened. */
export function initSafety() {
  const log = $('[data-safety-log]');
  const appState = $('[data-watch-app]');
  if (!log) return;
  const entries: string[] = [];
  const add = (html: string) => {
    entries.push(`<li><time>${mmss(sim.time)}</time><span>${html}</span></li>`);
    while (entries.length > 7) entries.shift();
    log.innerHTML = entries.join('');
  };
  const fanName = (i: number) => (i === 0 ? 'Left fan' : 'Right fan');
  sim.on<Write>('write', (w) => {
    if (!watching) return;
    if (w.key.endsWith('md')) add(w.value === '0' ? `${fanName(w.fan)} back to <b>Automatic</b>` : `${fanName(w.fan)} under FanPilot's control`);
    else add(`${fanName(w.fan)} set to <b>${Number(w.value).toLocaleString('en-US')} RPM</b>`);
  });
  let watching = false;
  let busy = false;

  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
  const ensureManual = async () => {
    if (!sim.running) {
      sim.relaunch();
      add('FanPilot relaunched.');
      await wait(300);
    }
    if (sim.mfcRunning) sim.setMacsFanControl(false);
    if (sim.fans.every((f) => f.manual)) return;
    sim.setManualPercent(70);
    add('Fans set to <b>Manual 70%</b> first, so there is something to hand back.');
    await wait(1100);
  };

  const scenarios: Record<string, () => Promise<void>> = {
    quit: async () => {
      await ensureManual();
      add('You chose Quit.');
      sim.quit('quit');
      add('Both fans on <b>Automatic</b>. FanPilot closed.');
    },
    sleep: async () => {
      await ensureManual();
      add('The Mac is going to sleep.');
      sim.sleep();
      add('Fans handed back to macOS before sleep.');
      await wait(3700);
      add('Awake. FanPilot took over again after a short pause.');
    },
    crash: async () => {
      await ensureManual();
      add('FanPilot crashed.');
      sim.quit('crash');
      add('The helper noticed and reset both fans to <b>Automatic</b>.');
    },
    mfc: async () => {
      if (sim.mfcRunning) {
        sim.setMacsFanControl(false);
        add('Macs Fan Control quit. FanPilot takes over again.');
        return;
      }
      await ensureManual();
      sim.setMacsFanControl(true);
      add('Macs Fan Control is running. FanPilot paused until it quits.');
    },
    floor: async () => {
      if (!sim.running) sim.relaunch();
      sim.setManualPercent(0);
      add('Manual 0% still means <b>2,317 RPM</b>, the slowest these fans are built to run.');
    },
  };

  document.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-safety]');
    if (!b || busy) return;
    busy = true;
    watching = true;
    const id = b.dataset.safety!;
    $$('[data-rule]').forEach((r) => r.classList.toggle('is-active', r.dataset.rule === id));
    try {
      await scenarios[id]?.();
    } finally {
      busy = false;
      window.setTimeout(() => (watching = false), 4000);
    }
  });

  $('[data-safety-reset]')?.addEventListener('click', () => {
    sim.relaunch();
    sim.setMacsFanControl(false);
    if (sim.helper !== 'ready') sim.setHelper('ready');
    sim.select(AUTOMATIC_ID);
    entries.length = 0;
    add('FanPilot running on Automatic.');
    $$('[data-rule]').forEach((r) => r.classList.remove('is-active'));
  });

  const mfcBtn = $('[data-safety="mfc"]');
  const sync = () => {
    if (appState) {
      const paused = sim.running && (sim.mfcRunning || sim.sleeping || sim.helper !== 'ready');
      setText(appState, !sim.running ? 'FanPilot not running' : sim.sleeping ? 'Mac asleep' : paused ? 'FanPilot paused' : 'FanPilot running');
      appState.classList.toggle('is-off', !sim.running);
      appState.classList.toggle('is-paused', paused || sim.sleeping);
    }
    setText(mfcBtn, sim.mfcRunning ? 'Quit Macs Fan Control' : 'Open Macs Fan Control');
  };
  sim.on('change', sync);
  sync();
}
