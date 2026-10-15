import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { AppIcon } from '../components/Mac';
import { Slam } from '../components/Text';
import { Shockwave, Whip, useLayout, useShake } from '../components/FX';
import { C, FONT, FPS, T, f } from '../theme';
import { spinReveal } from '../spin';

export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { isV } = useLayout();
  const S = T.scenes.reveal[0];
  const tWord = f(T.reveal.wordmark - S);
  const tSubA = f(T.reveal.subA - S);
  const tSubB = f(T.reveal.subB - S);
  const dur = f(T.scenes.reveal[1] - S);

  const iconSize = isV ? 440 : 400;
  const hit = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 220, mass: 0.7 } });
  const iconScale = interpolate(hit, [0, 1], [1.35, 1]);
  const lock = spring({ frame: frame - tWord, fps: FPS, config: { damping: 15, stiffness: 200, mass: 0.8 } });
  const shake = useShake(0, 18, 12);

  // Lockup: icon slides aside (16:9) or up (9:16) when the wordmark lands.
  const iconX = isV ? 0 : interpolate(lock, [0, 1], [0, -390]);
  const iconY = isV ? interpolate(lock, [0, 1], [0, -330]) : interpolate(lock, [0, 1], [0, -70]);
  const iconK = interpolate(lock, [0, 1], [1, isV ? 0.62 : 0.56]);
  const glow = 1 - 0.45 * Math.min(1, frame / 60);
  const rays = frame * 0.25;

  return (
    <Whip id="reveal" duration={dur} exit={1} frames={10}>
      <AbsoluteFill style={{ background: C.bg, overflow: 'hidden', transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(50% 50% at 50% ${isV ? 42 : 46}%, rgba(56,189,248,${0.22 * glow}), rgba(255,106,61,${0.12 * glow}) 50%, transparent 75%)`,
          }}
        />
        <AbsoluteFill
          style={{
            background: `conic-gradient(from ${rays}deg at 50% 46%, transparent 0deg, rgba(56,189,248,0.05) 20deg, transparent 40deg, rgba(255,106,61,0.04) 90deg, transparent 120deg, rgba(56,189,248,0.05) 200deg, transparent 230deg, rgba(255,106,61,0.04) 300deg, transparent 330deg)`,
          }}
        />
        <Shockwave at={0} size={iconSize} color={C.cyan} length={30} />
        <Shockwave at={4} size={iconSize} color={C.orange} length={34} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: `translate(${iconX}px, ${iconY}px) scale(${iconScale * iconK})` }}>
            <AppIcon size={iconSize} angle={spinReveal(frame)} glow={glow} />
          </div>
        </AbsoluteFill>
        {frame >= tWord ? (
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                transform: isV ? 'translateY(-10px)' : 'translate(140px, -70px)',
                clipPath: `inset(-20% ${100 - Math.min(100, (frame - tWord) * 14)}% -20% -5%)`,
              }}
            >
              <Slam text="FanPilot" at={tWord} size={isV ? 200 : 210} weight={800} from={1.25} tracking="-0.045em" />
            </div>
          </AbsoluteFill>
        ) : null}
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              transform: `translateY(${isV ? 250 : 130}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              fontFamily: FONT,
            }}
          >
            {frame >= tSubA ? <Slam text="Fan control for Apple Silicon." at={tSubA} size={isV ? 62 : 66} weight={600} color={C.dim} from={1.2} tracking="-0.02em" /> : null}
            {frame >= tSubB ? <Slam text="On your *keyboard.*" at={tSubB} size={isV ? 62 : 66} weight={700} accent={C.cyan} from={1.2} tracking="-0.02em" /> : null}
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ background: '#CFF1FF', opacity: Math.max(0, 0.6 - frame * 0.15), mixBlendMode: 'screen' }} />
      </AbsoluteFill>
    </Whip>
  );
};

