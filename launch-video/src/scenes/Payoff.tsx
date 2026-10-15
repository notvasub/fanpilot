import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { FanPilotPanel, MenuBar, Wallpaper } from '../components/Mac';
import { Slam } from '../components/Text';
import { useLayout } from '../components/FX';
import { C, FONT, T, expoOut, f, rpmFor } from '../theme';

// Virtual laptop screen, drawn at 1440×900 and scaled into the frame.
const SW = 1440;
const SH = 900;
const BAR = 30;
// FanPilot menu-bar item and the CPU item sit just left of the system items.
const FOCUS = { x: SW - 340, y: BAR / 2 };

const Laptop: React.FC<{ frame: number }> = ({ frame }) => {
  const rpm = rpmFor(40);
  return (
    <div style={{ position: 'relative', width: SW + 60, height: SH + 90 }}>
      {/* Lid */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SW + 60,
          height: SH + 60,
          borderRadius: 44,
          background: 'linear-gradient(180deg, #2a2a2e, #161618)',
          boxShadow: '0 60px 160px rgba(0,0,0,0.7), inset 0 0 0 2px #3a3a3f',
        }}
      />
      {/* Screen */}
      <div style={{ position: 'absolute', left: 30, top: 30, width: SW, height: SH, borderRadius: 16, overflow: 'hidden', background: '#000' }}>
        <Wallpaper />
        <MenuBar width={SW} height={BAR} temp={54} tempColor={C.cyan} rpm={rpm} fanAngle={frame * 3.2} highlightFan appName="Finder" />
        <div style={{ position: 'absolute', left: FOCUS.x - 200, top: BAR + 6, transform: 'scale(1.18)', transformOrigin: '0 0' }}>
          <FanPilotPanel
            cpuAvg={54}
            cpuMax={58}
            fans={[
              { name: 'Left fan', manual: true, rpm: rpm + Math.sin(frame / 9) * 6, percent: 40, target: rpm },
              { name: 'Right fan', manual: true, rpm: rpm - 23 + Math.sin(frame / 7) * 6, percent: 40, target: rpm },
            ]}
            active="—"
            accent={C.cyan}
            manualPercent={40}
          />
        </div>
        {/* Notch */}
        <div style={{ position: 'absolute', left: SW / 2 - 100, top: 0, width: 200, height: BAR + 2, background: '#000', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }} />
      </div>
      {/* Base lip */}
      <div
        style={{
          position: 'absolute',
          left: -70,
          top: SH + 58,
          width: SW + 200,
          height: 30,
          borderRadius: '6px 6px 30px 30px',
          background: 'linear-gradient(180deg, #47474c, #1d1d20)',
        }}
      />
    </div>
  );
};

export const Payoff: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, isV } = useLayout();
  const S = T.scenes.payoff[0];
  const tPull = f(T.payoff.pullEnd - S);
  const words = T.payoff.words.map((w) => f(w - S));

  // Final framing of the laptop.
  const k = isV ? (W * 0.92) / (SW + 60) : (W * 0.57) / (SW + 60);
  const final = isV ? { x: W / 2 - ((SW + 60) * k) / 2, y: H * 0.1 } : { x: W * 0.37, y: H / 2 - ((SH + 90) * k) / 2 };
  const focusFinal = { x: final.x + k * (FOCUS.x + 30), y: final.y + k * (FOCUS.y + 30) };

  // Pull back from a tight shot on the menu bar.
  const z = interpolate(frame, [0, tPull], [5.2, 1], { extrapolateRight: 'clamp', easing: expoOut });
  const t = interpolate(frame, [0, tPull], [0, 1], { extrapolateRight: 'clamp', easing: expoOut });
  const cx = W / 2 + (focusFinal.x - W / 2) * t;
  const cy = H * 0.42 + (focusFinal.y - H * 0.42) * t;
  const scale = k * z;
  const tx = cx - scale * (FOCUS.x + 30);
  const ty = cy - scale * (FOCUS.y + 30);

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 60% at 60% 50%, rgba(56,189,248,0.12), transparent 70%)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        <Laptop frame={frame} />
      </div>
      <div
        style={{
          position: 'absolute',
          ...(isV ? { left: 0, right: 0, top: H * 0.56, alignItems: 'center' } : { left: W * 0.055, top: H * 0.25, alignItems: 'flex-start' }),
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          fontFamily: FONT,
        }}
      >
        {['Cool.', 'Quiet.', 'Yours.'].map((w, i) =>
          frame >= words[i] ? (
            <Slam
              key={w}
              text={i === 2 ? `*${w}*` : w}
              at={words[i]}
              size={isV ? 190 : 170}
              align={isV ? 'center' : 'left'}
              accent={C.cyan}
              from={1.5}
              lineHeight={1.0}
            />
          ) : (
            <div key={w} style={{ height: (isV ? 190 : 170) * 1.0 }} />
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};
