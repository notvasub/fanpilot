// Port of Sources/FanCore/ControlLogic.swift and Profiles.swift.
// The page runs the same rules the app runs; only the SMC and the sensors are simulated.

export const FAN_RANGE = { min: 2317, max: 7826 } as const;
export type Range = { min: number; max: number };

export type Source = 'cpuAverage' | 'cpuMax';
export const SOURCE_LABEL: Record<Source, string> = { cpuAverage: 'CPU average', cpuMax: 'CPU hottest' };

export type FanMode =
  | { kind: 'automatic' }
  | { kind: 'fixed'; percent: number }
  | { kind: 'curve'; source: Source; from: number; to: number };

export interface Profile {
  id: string;
  name: string;
  modes: FanMode[];
  builtIn: boolean;
}

export type Active = { kind: 'profile'; id: string } | { kind: 'manual'; percent: number };

export type FanCommand = { kind: 'automatic' } | { kind: 'manual'; rpm: number };

export const AUTOMATIC_ID = '00000000-0000-0000-0000-000000000001';

export const BUILT_INS: Profile[] = [
  { id: AUTOMATIC_ID, name: 'Automatic', modes: [{ kind: 'automatic' }], builtIn: true },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Quiet', modes: [{ kind: 'curve', source: 'cpuAverage', from: 60, to: 90 }], builtIn: true },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Balanced', modes: [{ kind: 'curve', source: 'cpuAverage', from: 50, to: 80 }], builtIn: true },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Performance', modes: [{ kind: 'curve', source: 'cpuMax', from: 45, to: 75 }], builtIn: true },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Full Speed', modes: [{ kind: 'fixed', percent: 100 }], builtIn: true },
];

export const clampPercent = (p: number) => (Number.isFinite(p) ? Math.min(Math.max(p, 0), 100) : 0);

export const rpmFor = (percent: number, range: Range = FAN_RANGE) =>
  range.min + ((range.max - range.min) * clampPercent(percent)) / 100;

export const percentFor = (rpm: number, range: Range = FAN_RANGE) =>
  range.max > range.min ? clampPercent(((rpm - range.min) / (range.max - range.min)) * 100) : 0;

export function modeSummary(mode: FanMode): string {
  switch (mode.kind) {
    case 'automatic':
      return 'Automatic';
    case 'fixed':
      return `Fixed ${Math.round(mode.percent)}%`;
    case 'curve':
      return `${SOURCE_LABEL[mode.source]} ${Math.trunc(mode.from)}–${Math.trunc(mode.to)} °C`;
  }
}

export function modeForFan(profile: Profile, fan: number): FanMode {
  if (profile.modes.length === 0) return { kind: 'automatic' };
  return profile.modes[Math.min(Math.max(fan, 0), profile.modes.length - 1)];
}

/** 0 at or below `from`, 1 at or above `to`, linear in between. */
export function curveFraction(temperature: number, from: number, to: number) {
  if (!(to > from)) return temperature >= to ? 1 : 0;
  return Math.min(Math.max((temperature - from) / (to - from), 0), 1);
}

export const TUNING = { upStepRPM: 800, downStepRPM: 200, deadbandRPM: 100 } as const;

export function smooth(previous: number | null, desired: number) {
  if (previous === null) return desired;
  if (desired > previous) return Math.min(desired, previous + TUNING.upStepRPM);
  if (previous - desired < TUNING.deadbandRPM) return previous;
  return Math.max(desired, previous - TUNING.downStepRPM);
}

export function modeFor(active: Active, fan: number, profiles: Profile[]): FanMode {
  if (active.kind === 'manual') return { kind: 'fixed', percent: active.percent };
  const profile = profiles.find((p) => p.id === active.id);
  return profile ? modeForFan(profile, fan) : { kind: 'automatic' };
}

export type Temps = { average: number; maximum: number };

/** Desired RPM before smoothing, for a curve; used by the page's charts. */
export function curveDesired(mode: Extract<FanMode, { kind: 'curve' }>, temps: Temps, range: Range = FAN_RANGE) {
  const t = mode.source === 'cpuAverage' ? temps.average : temps.maximum;
  return rpmFor(curveFraction(t, mode.from, mode.to) * 100, range);
}

export function command(mode: FanMode, temps: Temps | null, previousTarget: number | null, range: Range = FAN_RANGE): FanCommand {
  switch (mode.kind) {
    case 'automatic':
      return { kind: 'automatic' };
    case 'fixed':
      return { kind: 'manual', rpm: Math.round(rpmFor(mode.percent, range)) };
    case 'curve': {
      if (!temps) return { kind: 'automatic' };
      const desired = curveDesired(mode, temps, range);
      const smoothed = smooth(previousTarget, desired);
      return { kind: 'manual', rpm: Math.round(Math.min(Math.max(smoothed, range.min), range.max)) };
    }
  }
}

export function effectivePercent(range: Range, actualRPM: number, targetRPM: number, isManual: boolean) {
  return percentFor(isManual ? targetRPM : actualRPM, range);
}

/** Steps to the next multiple of `step`, so repeated presses land on 10%, 20%, … */
export function nudged(current: number, step: number, direction: number): Active {
  if (!(step > 0) || direction === 0) return { kind: 'manual', percent: clampPercent(current) };
  const position = clampPercent(current) / step;
  const epsilon = 1e-6;
  const next = direction > 0 ? Math.floor(position + epsilon) + 1 : Math.ceil(position - epsilon) - 1;
  return { kind: 'manual', percent: clampPercent(next * step) };
}

export function nextProfile(active: Active, profiles: Profile[]): Active {
  if (profiles.length === 0) return { kind: 'profile', id: AUTOMATIC_ID };
  const index = active.kind === 'profile' ? profiles.findIndex((p) => p.id === active.id) : -1;
  if (index < 0) return { kind: 'profile', id: profiles[0].id };
  return { kind: 'profile', id: profiles[(index + 1) % profiles.length].id };
}

export function uniqueName(base: string, profiles: Profile[]) {
  const trimmed = base.trim();
  const root = trimmed === '' ? 'Custom' : trimmed;
  const names = new Set(profiles.map((p) => p.name));
  if (!names.has(root)) return root;
  let index = 2;
  while (names.has(`${root} ${index}`)) index += 1;
  return `${root} ${index}`;
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const rpmText = (rpm: number) => `${fmtInt(rpm)} RPM`;
