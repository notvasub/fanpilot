import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { CheckCircle, ShieldIcon } from '../components/Icons';
import { MacWindow, Vibrancy, Wallpaper } from '../components/Mac';
import { Whip, useLayout } from '../components/FX';
import { C, FONT, FPS, MONO, T, f, ramp } from '../theme';

// Same format as `fanctl temps`: "%-40@ %6.1f °C", sorted by sensor name.
const SENSORS: Array<[string, number]> = [
  ['NAND CH0 temp', 41.0],
  ['PMU tdev1', 44.8],
  ['PMU tdie1', 53.2],
  ['PMU tdie2', 54.9],
  ['PMU tdie3', 52.6],
  ['PMU tdie4', 55.3],
  ['PMU tdie5', 53.8],
  ['PMU tdie6', 52.1],
  ['gas gauge battery', 31.4],
];
const COMMAND = 'fanctl temps';
const CHIPS = ['Returns to auto on quit.', 'Never below SMC minimum.', 'Signed helper, XPC-verified.'];

export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, isV } = useLayout();
  const S = T.scenes.terminal[0];
  const tType = f(T.terminal.typeStart - S);
  const tTypeEnd = f(T.terminal.typeEnd - S);
  const tOut = f(T.terminal.output - S);
  const tShield = f(T.terminal.shield - S);
  const chips = T.terminal.chips.map((c) => f(c - S));
  const dur = f(T.scenes.terminal[1] - S);

  const typed = Math.max(0, Math.min(COMMAND.length, Math.floor(((frame - tType) / (tTypeEnd - tType)) * COMMAND.length)));
  const lines = frame < tOut ? 0 : Math.min(SENSORS.length, Math.floor((frame - tOut) / 1.5) + 1);
  const done = lines === SENSORS.length && frame > tOut + 16;
  const cursorOn = Math.floor(frame / 16) % 2 === 0 || (frame >= tType && frame < tTypeEnd);

  const aside = spring({ frame: frame - tShield, fps: FPS, config: { damping: 16, stiffness: 180, mass: 0.8 } });
  const termW = isV ? 980 : 1120;
  const termH = isV ? 640 : 620;
  const termX = isV ? 0 : interpolate(aside, [0, 1], [0, -W * 0.215]);
  const termY = isV ? interpolate(aside, [0, 1], [0, -H * 0.2]) : 0;
  const termK = interpolate(aside, [0, 1], [1, isV ? 0.95 : 0.84]);
  const fs = isV ? 25 : 25;

  const shieldDraw = ramp(frame, tShield + 2, tShield + 16);
  const shieldFill = ramp(frame, tShield + 10, tShield + 20);
  const check = ramp(frame, tShield + 14, tShield + 24);
  const shieldPop = spring({ frame: frame - tShield, fps: FPS, config: { damping: 10, stiffness: 260, mass: 0.6 } });

  return (
    <Whip id="terminal" duration={dur} enter={1} frames={8}>
      <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
        <Wallpaper />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: `translate(${termX}px, ${termY}px) scale(${termK})` }}>
            <MacWindow title="zsh — 96×28" width={termW} height={termH} bg="rgba(13,13,15,0.94)">
              <div style={{ padding: '22px 28px', fontFamily: MONO, fontSize: fs, lineHeight: 1.5, color: '#E6E6E9', whiteSpace: 'pre' }}>
                <div style={{ color: C.dim }}>Last login: Wed Oct 14 09:41:07 on ttys001</div>
                <div>
                  <span style={{ color: C.cyan }}>~</span> <span style={{ color: C.dim }}>%</span> {COMMAND.slice(0, typed)}
                  {!done && lines === 0 && cursorOn ? <span style={{ background: '#E6E6E9', color: '#000' }}> </span> : null}
                </div>
                {SENSORS.slice(0, lines).map(([name, c]) => (
                  <div key={name}>
                    {name.padEnd(isV ? 26 : 40)}
                    <span style={{ color: c > 50 ? '#F5B13D' : C.cyan }}>{c.toFixed(1).padStart(6)} °C</span>
                  </div>
                ))}
                {done ? (
                  <div>
                    <span style={{ color: C.cyan }}>~</span> <span style={{ color: C.dim }}>%</span> {cursorOn ? <span style={{ background: '#E6E6E9' }}> </span> : null}
                  </div>
                ) : null}
              </div>
            </MacWindow>
          </div>
        </AbsoluteFill>
        {frame >= tShield ? (
          <div
            style={{
              position: 'absolute',
              left: isV ? W / 2 - 440 : W * 0.585,
              top: isV ? H * 0.53 : H * 0.2,
              width: isV ? 880 : W * 0.37,
              display: 'flex',
              flexDirection: 'column',
              alignItems: isV ? 'center' : 'flex-start',
              gap: 26,
            }}
          >
            <div style={{ transform: `scale(${0.6 + 0.4 * shieldPop})`, filter: `drop-shadow(0 0 ${30 * shieldFill}px rgba(56,189,248,0.7))` }}>
              <ShieldIcon
                size={isV ? 200 : 170}
                color={C.cyan}
                draw={shieldDraw}
                check={check}
                fill={`rgba(56,189,248,${0.55 * shieldFill})`}
              />
            </div>
            {CHIPS.map((text, i) => {
              if (frame < chips[i]) return <div key={text} style={{ height: isV ? 92 : 84 }} />;
              const s = spring({ frame: frame - chips[i], fps: FPS, config: { damping: 11, stiffness: 300, mass: 0.5 } });
              return (
                <div key={text} style={{ transform: `translateX(${(1 - s) * 80}px) scale(${0.7 + 0.3 * s})`, transformOrigin: 'left center', opacity: Math.min(1, s * 2) }}>
                  <Vibrancy radius={44} tint="rgba(36,36,40,0.7)" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: isV ? '20px 34px 20px 22px' : '18px 30px 18px 20px' }}>
                    <CheckCircle size={isV ? 46 : 42} color={C.cyan} />
                    <span style={{ fontFamily: FONT, fontSize: isV ? 44 : 40, fontWeight: 700, letterSpacing: '-0.02em', color: C.white }}>{text}</span>
                  </Vibrancy>
                </div>
              );
            })}
          </div>
        ) : null}
      </AbsoluteFill>
    </Whip>
  );
};
