import { Easing, interpolate, interpolateColors, spring } from 'remotion';
import timeline from './timeline.json';

export const T = timeline;
export const FPS = T.fps;
export const BEAT = 60 / T.bpm;

/** Seconds → frame index. */
export const f = (sec: number) => Math.round(sec * FPS);

export const C = {
  bg: '#0A0A0B',
  bg2: '#111114',
  cyan: '#38BDF8',
  orange: '#FF6A3D',
  white: '#F5F5F7',
  dim: 'rgba(245,245,247,0.55)',
  faint: 'rgba(245,245,247,0.12)',
  panel: 'rgba(36,36,40,0.62)',
  panelBorder: 'rgba(255,255,255,0.10)',
};

export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

/** Accent that runs cool cyan → hot orange; t in [0,1]. */
export const heat = (t: number) => interpolateColors(Math.max(0, Math.min(1, t)), [0, 0.5, 1], [C.cyan, '#EEEAF4', C.orange]);
/** Accent for a temperature in °C (cool at 45, hot at 80). */
export const heatC = (celsius: number) => heat((celsius - 45) / 35);
/** Accent for a fan percentage (cool at 40%, hot at 85%). */
export const heatP = (percent: number) => heat((percent - 40) / 45);

export const rpmFor = (percent: number) => T.fanRange.minRPM + (percent / 100) * (T.fanRange.maxRPM - T.fanRange.minRPM);
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Snappy slam spring with slight overshoot. */
export const slam = (frame: number, at: number, fps = FPS) =>
  spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 260, mass: 0.6 } });

/** Ease value between two frames (clamped). */
export const ramp = (frame: number, from: number, to: number, a = 0, b = 1, ease = Easing.inOut(Easing.cubic)) =>
  interpolate(frame, [from, to], [a, b], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

export const easeOut = Easing.out(Easing.cubic);
export const easeIn = Easing.in(Easing.cubic);
export const expoOut = Easing.out(Easing.exp);
