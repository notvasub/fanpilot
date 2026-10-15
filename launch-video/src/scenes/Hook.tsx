import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FanGlyph, CpuIcon } from '../components/Icons';
import { MenuBar, Wallpaper } from '../components/Mac';
import { Slam } from '../components/Text';
import { useLayout } from '../components/FX';
import { C, FONT, T, f, fmtInt, heatC, ramp, slam } from '../theme';

const H0 = T.scenes.hook[0];

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, isV } = useLayout();
  const tTitle = f(T.hook.title - H0);
  const tPunch = f(T.hook.hotPunch - H0);
  const tMenu = f(T.hook.menubar - H0);
  const tClimbEnd = f(T.hook.climbEnd - H0);
  const tLineA = f(T.hook.line2a - H0);
  const tLineB = f(T.hook.line2b - H0);

  if (frame < tMenu) {
    // Black → title slam, then a heat punch on "hot."
    const punch = frame >= tPunch ? slam(frame, tPunch) : 0;
    const bump = 1 + 0.07 * Math.sin(Math.min(1, punch) * Math.PI) * (frame >= tPunch ? 1 : 0);
    const glow = frame >= tPunch ? Math.min(1, (frame - tPunch) / 6) : 0;
    return (
      <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(40% 35% at ${isV ? 58 : 66}% 52%, rgba(255,106,61,${0.28 * glow}), transparent 70%)`,
          }}
        />
        <div style={{ transform: `scale(${bump * (1 + (frame - tTitle) * 0.0012)})` }}>
          {frame >= tTitle ? (
            <Slam text={isV ? 'Your Mac\nruns *hot.*' : 'Your Mac runs *hot.*'} at={tTitle} size={isV ? 168 : 176} from={1.6} />
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }

  // Menu-bar close-up: CPU temperature climbs while the fan barely turns.
  const climb = ramp(frame, tMenu + 4, tClimbEnd, 0, 1, (t) => t * t * (3 - 2 * t) * 0.35 + t * t * 0.65);
  const temp = T.hook.tempFrom + (T.hook.tempTo - T.hook.tempFrom) * climb;
  const color = heatC(temp);
  const local = frame - tMenu;
  const line2 = frame >= tLineA;
  const dof = line2 ? ramp(frame, tLineA, tLineA + 6, 0, 14) : 0;
  const zoom = 1.04 + local * 0.0009;
  const barH = isV ? 70 : 84;
  const barW = W * 1.9;
  const fanAngle = local * 1.2;
  const shimmer = temp > 80 ? (temp - 80) / 12 : 0;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, filter: dof > 0 ? `blur(${dof}px) brightness(${1 - dof / 30})` : undefined }}>
        <Wallpaper warmth={climb} />
        <div style={{ position: 'absolute', top: H * 0.07, left: W - barW - 24 - W * 0.09 }}>
          <MenuBar width={barW} height={barH} temp={temp} tempColor={color} />
        </div>
        {/* Highlight ring around the temperature item */}
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: FONT,
            color: C.white,
            paddingTop: isV ? 40 : 90,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: C.dim, fontSize: isV ? 40 : 44, fontWeight: 600, letterSpacing: '0.02em' }}>
            <CpuIcon size={isV ? 44 : 48} color={C.dim} /> CPU
          </div>
          <div
            style={{
              fontSize: isV ? 330 : 360,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color,
              textShadow: `0 0 ${60 + 80 * climb}px ${color}${climb > 0.5 ? '88' : '44'}`,
              transform: `translateX(${shimmer * Math.sin(frame * 2.1) * 3}px)`,
            }}
          >
            {Math.round(temp)}°
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18, color: C.dim, fontSize: isV ? 36 : 40, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            <FanGlyph size={isV ? 44 : 50} angle={fanAngle} color="rgba(245,245,247,0.45)" />
            Fans {fmtInt(T.fanRange.minRPM)} RPM
          </div>
        </AbsoluteFill>
        {/* Heat haze rising from the bottom */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(0deg, rgba(255,106,61,${0.22 * climb}) 0%, transparent 45%)`,
            mixBlendMode: 'screen',
          }}
        />
      </AbsoluteFill>
      {line2 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,11,0.35)' }}>
          <Slam text="And you can't" at={tLineA} size={isV ? 120 : 132} from={1.5} />
          <Slam text={isV ? 'do *anything*\nabout it.' : 'do *anything* about it.'} at={tLineB} size={isV ? 120 : 132} from={1.5} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
