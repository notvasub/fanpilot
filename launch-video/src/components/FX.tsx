import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { easeIn, easeOut } from '../theme';

export const useLayout = () => {
  const { width: W, height: H } = useVideoConfig();
  return { W, H, isV: H > W };
};

/** Film grain + vignette, drawn over everything. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.075 }) => {
  const frame = useCurrentFrame();
  const { W, H } = useLayout();
  const seed = frame % 9;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={W / 2}
        height={H / 2}
        style={{ position: 'absolute', left: 0, top: 0, transform: 'scale(2)', transformOrigin: '0 0', opacity, mixBlendMode: 'overlay' }}
      >
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};

/** Horizontal motion blur via an inline SVG filter (CSS blur can't do one axis). */
const HBlur: React.FC<{ id: string; amount: number }> = ({ id, amount }) => (
  <svg width={0} height={0} style={{ position: 'absolute' }}>
    <filter id={id} x="-20%" y="0" width="140%" height="100%">
      <feGaussianBlur stdDeviation={`${amount} 0`} />
    </filter>
  </svg>
);

/**
 * Whip-pan in/out wrapper. `enter`/`exit` give the direction the content travels
 * (+1 = from right to left). Frames are local to the enclosing Sequence.
 */
export const Whip: React.FC<{
  id: string;
  duration: number;
  enter?: number;
  exit?: number;
  frames?: number;
  zoomIn?: boolean;
  children: React.ReactNode;
}> = ({ id, duration, enter, exit, frames = 8, zoomIn, children }) => {
  const frame = useCurrentFrame();
  const { W } = useLayout();
  let x = 0;
  let blur = 0;
  let scale = 1;
  if (enter !== undefined && frame < frames) {
    const t = interpolate(frame, [0, frames], [1, 0], { extrapolateRight: 'clamp', easing: easeOut });
    x = enter * W * 0.45 * t;
    blur = 60 * t;
  }
  if (zoomIn && frame < frames) {
    const t = interpolate(frame, [0, frames], [1, 0], { extrapolateRight: 'clamp', easing: easeOut });
    scale = 1 + 0.18 * t;
  }
  if (exit !== undefined && frame > duration - frames) {
    const t = interpolate(frame, [duration - frames, duration], [0, 1], { extrapolateLeft: 'clamp', easing: easeIn });
    x = -exit * W * 0.45 * t;
    blur = 60 * t;
  }
  const fid = `whip-${id}`;
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}px) scale(${scale})`, filter: blur > 0.5 ? `url(#${fid})` : undefined }}>
      {blur > 0.5 ? <HBlur id={fid} amount={blur} /> : null}
      {children}
    </AbsoluteFill>
  );
};

/** Decaying camera shake starting at `at` (local frames). */
export const useShake = (at: number, strength = 14, length = 10) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > length) return { x: 0, y: 0 };
  const k = 1 - local / length;
  return {
    x: (random(`sx${frame}`) * 2 - 1) * strength * k,
    y: (random(`sy${frame}`) * 2 - 1) * strength * k,
  };
};

/** Expanding ring for impacts. */
export const Shockwave: React.FC<{ at: number; size: number; color: string; length?: number }> = ({ at, size, color, length = 34 }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > length) return null;
  const t = local / length;
  const s = interpolate(t, [0, 1], [0.4, 2.6], { easing: easeOut });
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: '50%',
        border: `${Math.max(1, 10 * (1 - t))}px solid ${color}`,
        opacity: 1 - t,
        transform: `scale(${s})`,
        boxShadow: `0 0 40px ${color}`,
      }}
    />
  );
};

/** Full-frame flash on a hit. */
export const Flash: React.FC<{ at: number; color?: string; length?: number; peak?: number }> = ({ at, color = '#fff', length = 8, peak = 0.85 }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > length) return null;
  return <AbsoluteFill style={{ background: color, opacity: peak * (1 - local / length) }} />;
};
