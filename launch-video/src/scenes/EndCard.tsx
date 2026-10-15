import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { FanGlyph } from '../components/Icons';
import { AppIcon } from '../components/Mac';
import { Slam } from '../components/Text';
import { Shockwave, useLayout } from '../components/FX';
import { C, FONT, FPS, T, f } from '../theme';

/** REPLACE: no pricing or domain exists in the repo yet. Swap in the real price / URL here. */
export const END_CARD_CTA = 'macOS 14+  ·  Apple Silicon  ·  github.com/notvasub/fanpilot';

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { H, isV } = useLayout();
  const S = T.scenes.end[0];
  const tTag = f(T.end.tagline - S);
  const tPulse = f(T.end.pulse - S);
  const tBlack = f(T.end.black - S);

  if (frame >= tBlack) return <AbsoluteFill style={{ background: '#000' }} />;

  const hit = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 240, mass: 0.6 } });
  const pulseL = frame - tPulse;
  const pulse = pulseL >= 0 ? Math.sin(Math.min(1, pulseL / 12) * Math.PI) : 0;
  const glow = 0.55 + 0.9 * pulse;
  const iconSize = isV ? 240 : 210;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(45% 45% at 50% ${isV ? 40 : 44}%, rgba(56,189,248,${0.16 + 0.2 * pulse}), rgba(255,106,61,${0.08 + 0.12 * pulse}) 55%, transparent 75%)`,
        }}
      />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 0.05 }}>
        <FanGlyph size={H * 1.3} angle={frame * 0.6} color={C.white} />
      </AbsoluteFill>
      {pulseL >= 0 ? <Shockwave at={tPulse} size={iconSize * 1.4} color={C.cyan} length={26} /> : null}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: isV ? 40 : 34, fontFamily: FONT }}>
        <div
          style={{
            display: 'flex',
            flexDirection: isV ? 'column' : 'row',
            alignItems: 'center',
            gap: isV ? 30 : 44,
            transform: `scale(${interpolate(hit, [0, 1], [1.3, 1]) * (1 + 0.07 * pulse)})`,
          }}
        >
          <AppIcon size={iconSize} angle={frame * 1.2 + 30} glow={glow} />
          <div style={{ fontSize: isV ? 190 : 180, fontWeight: 800, letterSpacing: '-0.045em', color: C.white, lineHeight: 1 }}>FanPilot</div>
        </div>
        <div style={{ height: isV ? 150 : 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          {frame >= tTag ? (
            <>
              <Slam text={isV ? 'FanPilot.\nTake the *controls.*' : 'FanPilot. Take the *controls.*'} at={tTag} size={isV ? 72 : 64} weight={700} accent={C.cyan} from={1.25} tracking="-0.025em" />
              <div style={{ fontSize: isV ? 30 : 26, color: C.dim, fontWeight: 500, letterSpacing: '0.01em', opacity: Math.min(1, (frame - tTag) / 3) }}>
                {END_CARD_CTA}
              </div>
            </>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
