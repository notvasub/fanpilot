// A FanPilot that runs in the browser. Control decisions come from control.ts (the app's own
// logic); the SMC, the fans and the CPU temperature are simulated so the page has something to drive.

import {
  AUTOMATIC_ID,
  BUILT_INS,
  FAN_RANGE,
  command,
  effectivePercent,
  modeFor,
  modeForFan,
  modeSummary,
  nextProfile,
  nudged,
  percentFor,
  rpmFor,
  rpmText,
  uniqueName,
  type Active,
  type FanCommand,
  type FanMode,
  type Profile,
} from './control';

export type Load = 'idle' | 'browse' | 'build' | 'render';
export const LOADS: Record<Load, { label: string; heat: number }> = {
  idle: { label: 'Idle', heat: 16 },
  browse: { label: 'Browsing', heat: 30 },
  build: { label: 'Xcode build', heat: 78 },
  render: { label: 'Render', heat: 104 },
};

export type HelperState = 'ready' | 'notInstalled' | 'needsApproval';

export interface Fan {
  index: number;
  name: string;
  actual: number;
  target: number;
  manual: boolean;
  /** Last command FanPilot sent for this fan. */
  sent: FanCommand | null;
}

export interface Write {
  key: string;
  value: string;
  fan: number;
  t: number;
}

export interface Sample {
  t: number;
  avg: number;
  max: number;
  rpm: number;
  /** Curve speed before smoothing, when fan 0 follows a curve. */
  desired: number | null;
  /** What FanPilot last sent for fan 0, when it is manual. */
  target: number | null;
}

type Listener<T> = (payload: T) => void;

const TICK = 2; // seconds, AppModel.tickInterval
const AMBIENT = 30;

class Emitter {
  private map = new Map<string, Set<Listener<any>>>();
  on<T = void>(event: string, fn: Listener<T>) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(fn);
    return () => this.map.get(event)!.delete(fn);
  }
  emit<T>(event: string, payload?: T) {
    this.map.get(event)?.forEach((fn) => fn(payload));
  }
}

export class FanPilotSim extends Emitter {
  custom: Profile[] = [
    { id: 'custom-1', name: 'Custom', modes: [{ kind: 'curve', source: 'cpuAverage', from: 50, to: 80 }], builtIn: false },
  ];
  active: Active = { kind: 'profile', id: AUTOMATIC_ID };
  step = 10;
  load: Load = 'idle';
  avg = 44;
  max = 47;
  fans: Fan[] = [
    { index: 0, name: 'Left fan', actual: 0, target: 0, manual: false, sent: null },
    { index: 1, name: 'Right fan', actual: 0, target: 0, manual: false, sent: null },
  ];
  running = true;
  sleeping = false;
  mfcRunning = false;
  helper: HelperState = 'ready';
  launchAtLogin = true;
  stopReason: string | null = null;
  writes: Write[] = [];
  history: Sample[] = [];
  /** Accumulated blade angle per fan, degrees. */
  angle = [0, 40];
  time = 0;

  private firmwareOn = false;
  private sinceTick = 0;
  private sinceSample = 0;
  private needsResync = true;
  private maxNoise = 0;

  get profiles(): Profile[] {
    return [...BUILT_INS, ...this.custom];
  }

  profile(id: string) {
    return this.profiles.find((p) => p.id === id);
  }

  get activeName(): string {
    if (this.active.kind === 'manual') return `Manual ${Math.round(this.active.percent)}%`;
    return this.profile(this.active.id)?.name ?? 'Automatic';
  }

  get isAutomatic() {
    return this.active.kind === 'profile' && this.active.id === AUTOMATIC_ID;
  }

  get averageRPM() {
    return this.fans.reduce((s, f) => s + f.actual, 0) / this.fans.length;
  }

  /** First fan's speed as a percentage of its range (target when manual, actual otherwise). */
  get currentPercent() {
    if (this.active.kind === 'manual') return this.active.percent;
    const f = this.fans[0];
    return effectivePercent(FAN_RANGE, f.actual, f.target, f.manual);
  }

  get controlling() {
    return this.running && !this.sleeping && !this.mfcRunning && this.helper === 'ready';
  }

  statusMessage(): string | null {
    if (!this.running) return null;
    if (this.mfcRunning) return "Macs Fan Control is running. Quit it so the two apps don't fight over the fans.";
    if (this.helper === 'notInstalled') return 'Install the fan helper to change fan speeds.';
    if (this.helper === 'needsApproval') return 'Allow FanPilot under System Settings → General → Login Items.';
    return null;
  }

  // ───────────── user actions (mirror AppModel) ─────────────

  select(id: string) {
    this.apply({ kind: 'profile', id });
    this.showHUD();
  }

  setManualPercent(percent: number) {
    this.apply({ kind: 'manual', percent: Math.min(Math.max(percent, 0), 100) });
  }

  nudge(direction: number) {
    this.apply(nudged(this.currentPercent, this.step, direction));
    this.showHUD();
  }

  resetToAutomatic() {
    this.apply({ kind: 'profile', id: AUTOMATIC_ID });
    this.showHUD();
  }

  cycleProfile() {
    this.apply(nextProfile(this.active, this.profiles));
    this.showHUD();
  }

  setLoad(load: Load) {
    this.load = load;
    this.emit('change');
  }

  setStep(step: number) {
    this.step = step;
    this.emit('change');
  }

  saveManualAsProfile(name: string) {
    if (this.active.kind !== 'manual') return null;
    const profile = this.addProfile(name, [{ kind: 'fixed', percent: this.active.percent }]);
    this.active = { kind: 'profile', id: profile.id };
    this.emit('change');
    return profile;
  }

  addProfile(name: string, modes: FanMode[]) {
    const profile: Profile = { id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: uniqueName(name, this.profiles), modes, builtIn: false };
    this.custom.push(profile);
    this.emit('profiles');
    this.emit('change');
    return profile;
  }

  updateProfile(profile: Profile) {
    const i = this.custom.findIndex((p) => p.id === profile.id);
    if (i < 0) return;
    this.custom[i] = profile;
    this.emit('profiles');
    if (this.active.kind === 'profile' && this.active.id === profile.id) {
      this.needsResync = true;
      this.tick();
    }
    this.emit('change');
  }

  deleteProfile(id: string) {
    this.custom = this.custom.filter((p) => p.id !== id);
    if (this.active.kind === 'profile' && this.active.id === id) this.apply({ kind: 'profile', id: AUTOMATIC_ID });
    this.emit('profiles');
    this.emit('change');
  }

  // ───────────── things the safety section does to it ─────────────

  quit(reason = 'quit') {
    if (!this.running) return;
    this.resetAll();
    this.running = false;
    this.stopReason = reason;
    this.emit('change');
  }

  relaunch() {
    this.running = true;
    this.stopReason = null;
    this.needsResync = true;
    this.tick();
    this.emit('change');
  }

  sleep() {
    if (this.sleeping) return;
    this.sleeping = true;
    if (this.fans.some((f) => f.sent && f.sent.kind !== 'automatic')) this.resetAll();
    this.emit('change');
    // Give the SMC a moment after wake before taking control again (AppModel waits 3 s).
    window.setTimeout(() => {
      this.sleeping = false;
      this.needsResync = true;
      this.tick();
      this.emit('change');
    }, 3600);
  }

  setMacsFanControl(running: boolean) {
    this.mfcRunning = running;
    this.needsResync = true;
    if (!running) window.setTimeout(() => this.tick(), 600);
    this.emit('change');
  }

  setHelper(state: HelperState) {
    if (state !== 'ready' && this.helper === 'ready') this.resetAll();
    this.helper = state;
    this.needsResync = true;
    this.tick();
    this.emit('change');
  }

  // ───────────── control loop ─────────────

  private apply(control: Active) {
    this.active = control;
    this.needsResync = true;
    this.tick();
    this.emit('change');
  }

  private temps() {
    return { average: this.avg, maximum: this.max };
  }

  tick() {
    this.sinceTick = 0;
    if (!this.controlling) {
      if (this.helper !== 'ready') this.fans.forEach((f) => (f.sent = null));
      this.needsResync = true;
      return;
    }
    for (const fan of this.fans) {
      const mode = modeFor(this.active, fan.index, this.profiles);
      const previous = fan.sent && fan.sent.kind === 'manual' ? fan.sent.rpm : null;
      this.send(command(mode, this.temps(), previous), fan);
    }
    this.needsResync = false;
  }

  private send(cmd: FanCommand, fan: Fan) {
    if (cmd.kind === 'manual') {
      const drifted = !fan.manual || Math.abs(fan.target - cmd.rpm) > 25;
      const same = fan.sent?.kind === 'manual' && fan.sent.rpm === cmd.rpm;
      if (!(this.needsResync || !same || drifted)) return;
      fan.sent = cmd;
      const wasManual = fan.manual;
      fan.manual = true;
      fan.target = Math.min(Math.max(cmd.rpm, FAN_RANGE.min), FAN_RANGE.max); // the helper clamps too
      if (!wasManual) this.write(fan.index, `F${fan.index}md`, '1');
      this.write(fan.index, `F${fan.index}Tg`, fan.target.toFixed(1));
    } else {
      if (!fan.manual) {
        fan.sent = cmd;
        return;
      }
      fan.sent = cmd;
      fan.manual = false;
      this.write(fan.index, `F${fan.index}md`, '0');
    }
  }

  private resetAll() {
    for (const fan of this.fans) {
      if (fan.manual) this.write(fan.index, `F${fan.index}md`, '0');
      fan.manual = false;
      fan.sent = null;
    }
    this.needsResync = true;
  }

  private write(fan: number, key: string, value: string) {
    const w = { key, value, fan, t: this.time };
    this.writes.push(w);
    if (this.writes.length > 40) this.writes.shift();
    this.emit('write', w);
  }

  showHUD() {
    let detail: string;
    let fraction: number | null = null;
    if (this.active.kind === 'manual') {
      fraction = this.active.percent / 100;
      detail = `≈ ${rpmText(rpmFor(this.active.percent))}`;
    } else {
      const profile = this.profile(this.active.id);
      detail = profile ? modeSummary(modeForFan(profile, 0)) : '';
    }
    const blocked = this.mfcRunning || (this.helper !== 'ready' && !this.isAutomatic) || !this.running;
    this.emit('hud', { title: this.activeName, detail: blocked ? 'Not applied: see menu' : detail, fraction, percent: this.currentPercent });
  }

  /** Desired curve RPM for fan 0 before smoothing, or null when fan 0 is not on a curve. */
  desiredForChart(): number | null {
    const mode = modeFor(this.active, 0, this.profiles);
    if (mode.kind !== 'curve') return null;
    const t = mode.source === 'cpuAverage' ? this.avg : this.max;
    const from = mode.from, to = mode.to;
    const frac = to > from ? Math.min(Math.max((t - from) / (to - from), 0), 1) : t >= to ? 1 : 0;
    return rpmFor(frac * 100);
  }

  step_(dt: number) {
    this.time += dt;
    // Apple's own controller when a fan is not manual: off when cool (fans stop at idle on this Mac), ramps with the hottest die.
    if (this.max > 63) this.firmwareOn = true;
    else if (this.max < 56) this.firmwareOn = false;
    const firmwarePct = Math.min(Math.max(((this.max - 60) / 36) * 100, 0), 100) * 0.92;
    const firmwareTarget = this.firmwareOn ? rpmFor(firmwarePct) : 0;

    for (const fan of this.fans) {
      if (!fan.manual) fan.target = firmwareTarget;
      const diff = fan.target - fan.actual;
      const rate = diff > 0 ? 2400 : 1500;
      fan.actual += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
      this.angle[fan.index] = (this.angle[fan.index] + fan.actual * 0.11 * dt) % 360;
    }

    // Lumped thermal model: more airflow, lower equilibrium.
    const air = this.averageRPM / FAN_RANGE.max;
    const eq = AMBIENT + LOADS[this.load].heat / (1 + 1.25 * air);
    this.avg += (eq - this.avg) * (1 - Math.exp(-dt / 4.5));
    this.avg = Math.min(this.avg, 104);
    this.maxNoise += (Math.random() - 0.5) * dt * 4 - this.maxNoise * dt * 0.8;
    const spread = 2.4 + { idle: 0, browse: 1.2, build: 3.8, render: 5.2 }[this.load];
    this.max = Math.min(this.avg + spread + this.maxNoise, 108);

    this.sinceTick += dt;
    if (this.sinceTick >= TICK) this.tick();

    this.sinceSample += dt;
    if (this.sinceSample >= 0.5) {
      this.sinceSample = 0;
      const sent = this.fans[0].sent;
      this.history.push({
        t: this.time,
        avg: this.avg,
        max: this.max,
        rpm: this.averageRPM,
        desired: sent && sent.kind === 'manual' ? this.desiredForChart() : null,
        target: this.fans[0].manual ? this.fans[0].target : null,
      });
      if (this.history.length > 240) this.history.shift();
      this.emit('sample');
    }
    this.emit('frame', dt);
  }

  /** Fan speed as 0–1 heat, used for the page accent (cool at 40%, hot at 85%, like the film). */
  get heat() {
    const pct = this.averageRPM <= 0 ? 0 : percentFor(this.averageRPM);
    return Math.min(Math.max((pct - 25) / 60, 0), 1);
  }
}

export const sim = new FanPilotSim();

let started = false;
export function startSim() {
  if (started) return;
  started = true;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    sim.step_(dt);
    requestAnimationFrame(loop);
  };
  sim.tick();
  requestAnimationFrame(loop);
}
