import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { AppIcon, Keycap } from '../components/Mac';
import { Slam } from '../components/Text';
import { Flash, useLayout } from '../components/FX';
import { C, T, easeIn, f, ramp } from '../theme';
import { spinTurn } from '../spin';

const U = 120;
const G = 12;

type Key = { name: string; x: number; y: number; w: number; h: number };

const ROWS: Array<{ h: number; keys: Array<[string, number]> }> = [
  { h: 0.62, keys: [['esc', 1.45], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1]] },
  { h: 1, keys: [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1]] },
  { h: 1, keys: [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1]] },
  { h: 1, keys: [['caps lock', 1.8], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1]] },
  { h: 1, keys: [['shift', 2.3], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1]] },
  { h: 1, keys: [['fn', 1], ['control', 1], ['option', 1], ['command', 1.3], [' ', 5]] },
];

const KEYS: Key[] = (() => {
  const out: Key[] = [];
  let y = 0;
  for (const row of ROWS) {
    let x = 0;
    for (const [name, w] of row.keys) {
      out.push({ name, x, y, w: w * U + (w - 1) * 0, h: row.h * U });
      x += w * U + G;
    }
    y += row.h * U + G;
  }
  return out;
})();

const PLANE_W = 10 * U + 9 * G;
const PLANE_H = KEYS[KEYS.length - 1].y + U;
const fnKey = KEYS.find((k) => k.name === 'fn')!;
const f5Key = KEYS.find((k) => k.name === 'F5')!;
const center = (k: Key) => ({ x: k.x + k.w / 2, y: k.y + k.h / 2 });

const Plane: React.FC<{ fnPressed: number; f5Pressed: number; fnLit: number; f5Lit: number }> = ({ fnPressed, f5Pressed, fnLit, f5Lit }) => {
  const fc = center(fnKey);
  const f5 = center(f5Key);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Aluminium deck */}
      <div
        style={{
          position: 'absolute',
          inset: -80,
          borderRadius: 40,
          background: 'radial-gradient(120% 90% at 40% 30%, #2a2b30, #141518 70%)',
        }}
      />
      {/* Light pools under the two keys */}
      {[
        { p: fc, lit: fnLit },
        { p: f5, lit: f5Lit },
      ].map(({ p, lit }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x - 260,
            top: p.y - 260,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(56,189,248,${0.75 * lit}), rgba(56,189,248,${0.2 * lit}) 55%, transparent)`,
          }}
        />
      ))}
      {KEYS.map((k) => {
        const isFn = k.name === 'fn';
        const isF5 = k.name === 'F5';
        return (
          <div key={k.name + k.x + k.y} style={{ position: 'absolute', left: k.x, top: k.y }}>
            <Keycap
              name={k.name}
              unit={U}
              w={k.w / U}
              h={k.h / U}
              pressed={isFn ? fnPressed : isF5 ? f5Pressed : 0}
              lit={isFn ? fnLit : isF5 ? f5Lit : 0}
              accent={C.cyan}
            />
          </div>
        );
      })}
    </div>
  );
};

export const Turn: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, isV } = useLayout();
  const S = T.scenes.turn[0];
  const tFn = f(T.turn.fn - S);
  const tF5 = f(T.turn.f5 - S);
  const tText = f(T.turn.untilNow - S);
  const tPush = f(T.turn.push - S);
  const end = f(T.scenes.turn[1] - S);

  const press = (at: number, hold: number) => {
    const l = frame - at;
    if (l < 0) return 0;
    if (l < 3) return l / 3;
    if (l < hold) return 1;
    return Math.max(0, 1 - (l - hold) / 6);
  };
  const fnPressed = press(tFn, tF5 - tFn + 10);
  const f5Pressed = press(tF5, 9);
  const fnLit = 0.45 + 0.55 * ramp(frame, tFn, tFn + 4);
  const f5Lit = 0.45 + 0.55 * ramp(frame, tF5, tF5 + 4);

  // Rack focus from fn to F5 between the two presses.
  const rack = ramp(frame, tFn + 2, tF5 + 2);
  const fc = center(fnKey);
  const f5 = center(f5Key);
  const focus = { x: fc.x + (f5.x - fc.x) * rack, y: fc.y + (f5.y - fc.y) * rack };
  const mask = `radial-gradient(circle at ${focus.x}px ${focus.y}px, #000 0px, #000 210px, transparent 520px)`;

  // Slow drift, then a push into F5.
  const push = interpolate(frame, [tPush, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeIn });
  const tilt = 52 - 10 * push;
  const scale = (isV ? 0.82 : 1.0) * (1.06 + frame * 0.0008) * (1 + 5 * push);
  const planeBlur = 2 + 16 * push;
  const glyphIn = ramp(frame, tPush + 6, end, 0, 1, easeIn);
  const iconSize = isV ? 440 : 400;

  const plane = (blurred: boolean) => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: PLANE_W,
        height: PLANE_H,
        filter: blurred ? `blur(${7 + planeBlur}px)` : push > 0 ? `blur(${planeBlur * 0.6}px)` : undefined,
        WebkitMaskImage: blurred ? undefined : mask,
        maskImage: blurred ? undefined : mask,
      }}
    >
      <Plane fnPressed={fnPressed} f5Pressed={f5Pressed} fnLit={fnLit} f5Lit={f5Lit} />
    </div>
  );

  return (
    <AbsoluteFill style={{ background: '#050506', overflow: 'hidden' }}>
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: '50% 30%' }}>
        <div
          style={{
            position: 'absolute',
            left: W / 2 - PLANE_W / 2 + (isV ? 60 : 170),
            top: H / 2 - PLANE_H / 2 + (isV ? 0 : -60),
            width: PLANE_W,
            height: PLANE_H,
            transformOrigin: `${f5.x + (fc.x - f5.x) * 0.55 * (1 - push)}px ${f5.y + (fc.y - f5.y) * 0.55 * (1 - push)}px`,
            transform: `rotateX(${tilt}deg) rotateZ(${-16 + 6 * push}deg) scale(${scale})`,
            opacity: 1 - 0.75 * push,
          }}
        >
          {plane(true)}
          {plane(false)}
        </div>
      </AbsoluteFill>
      {/* Cool key light falloff */}
      <AbsoluteFill style={{ background: 'radial-gradient(70% 60% at 50% 55%, transparent 40%, rgba(5,5,6,0.85) 100%)' }} />
      {frame >= tText && frame < tPush + 20 ? (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: isV ? H * 0.16 : H * 0.12 }}>
          <div
            style={{
              transform: `scale(${1 + push * 2.2})`,
              opacity: frame > tPush + 10 ? Math.max(0, 1 - (frame - tPush - 10) / 6) : 1,
            }}
          >
            <Slam text="Until *now.*" at={tText} size={isV ? 190 : 200} accent={C.cyan} from={1.7} />
          </div>
        </AbsoluteFill>
      ) : null}
      {glyphIn > 0 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              transform: `scale(${0.15 + 0.85 * glyphIn})`,
              opacity: Math.min(1, glyphIn * 3),
              filter: `drop-shadow(0 0 ${30 + 60 * glyphIn}px rgba(56,189,248,0.9))`,
            }}
          >
            <AppIcon size={iconSize} angle={spinTurn(frame)} bare />
          </div>
        </AbsoluteFill>
      ) : null}
      <Flash at={end - 5} color="#BDEBFF" length={5} peak={0.0} />
      {frame >= end - 5 ? (
        <AbsoluteFill style={{ background: '#CFF1FF', opacity: ((frame - (end - 5)) / 5) * 0.55, mixBlendMode: 'screen' }} />
      ) : null}
    </AbsoluteFill>
  );
};
