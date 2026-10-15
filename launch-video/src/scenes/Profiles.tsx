import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { AutoIcon, BoltIcon, GaugeIcon, MoonIcon, WindIcon } from '../components/Icons';
import { FanPilotPanel, KeyCombo, Wallpaper } from '../components/Mac';
import { Slam, useCount } from '../components/Text';
import { Whip, useLayout } from '../components/FX';
import { C, FONT, FPS, MONO, T, f, fmtInt, rpmFor } from '../theme';

type Profile = {
  name: string;
  summary: string;
  tint: string;
  Icon: React.FC<{ size: number; color?: string }>;
  /** Fan % as a function of CPU °C. */
  curve: (c: number) => number;
  rpm: number;
  note: string;
};

const ramp = (from: number, to: number) => (c: number) => Math.max(0, Math.min(100, ((c - from) / (to - from)) * 100));

const PROFILES: Profile[] = [
  { name: 'Automatic', summary: 'Automatic', tint: '#A1A1AA', Icon: AutoIcon, curve: () => NaN, rpm: 2317, note: 'macOS decides' },
  { name: 'Quiet', summary: 'CPU average 60–90 °C', tint: '#7DD3FC', Icon: MoonIcon, curve: ramp(60, 90), rpm: rpmFor(10), note: 'Library-quiet' },
  { name: 'Balanced', summary: 'CPU average 50–80 °C', tint: '#34D399', Icon: GaugeIcon, curve: ramp(50, 80), rpm: rpmFor(38), note: 'Everyday' },
  { name: 'Performance', summary: 'CPU hottest 45–75 °C', tint: '#F5B13D', Icon: BoltIcon, curve: ramp(45, 75), rpm: rpmFor(68), note: 'Builds & renders' },
  { name: 'Full Speed', summary: 'Fixed 100%', tint: C.orange, Icon: WindIcon, curve: () => 100, rpm: rpmFor(100), note: 'Everything, now' },
];

const MiniCurve: React.FC<{ p: Profile; w: number; h: number }> = ({ p, w, h }) => {
  if (p.name === 'Automatic') {
    return (
      <svg width={w} height={h}>
        <path d={`M0 ${h * 0.75} C ${w * 0.3} ${h * 0.75}, ${w * 0.5} ${h * 0.3}, ${w} ${h * 0.45}`} stroke={p.tint} strokeWidth={4} fill="none" strokeDasharray="10 9" strokeLinecap="round" />
      </svg>
    );
  }
  const pts: string[] = [];
  for (let c = 30; c <= 100; c += 1) pts.push(`${((c - 30) / 70) * w},${h - (p.curve(c) / 100) * (h - 6) - 3}`);
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} stroke={p.tint} strokeWidth={5} fill="none" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${p.tint})` }} />
    </svg>
  );
};

const Card: React.FC<{ p: Profile; w: number; h: number }> = ({ p, w, h }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 32,
      padding: 44,
      boxSizing: 'border-box',
      background: `linear-gradient(150deg, ${p.tint}33, rgba(28,28,32,0.86) 45%, rgba(18,18,20,0.92))`,
      border: `1.5px solid ${p.tint}55`,
      boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 80px ${p.tint}22, inset 0 1px 0 rgba(255,255,255,0.1)`,
      backdropFilter: 'blur(30px)',
      fontFamily: FONT,
      color: C.white,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backfaceVisibility: 'hidden',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: 26,
          background: `${p.tint}26`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 40px ${p.tint}44`,
        }}
      >
        <p.Icon size={62} color={p.tint} />
      </div>
      <div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1 }}>{p.name}</div>
        <div style={{ fontSize: 28, color: C.dim, marginTop: 10, fontWeight: 500 }}>{p.note}</div>
      </div>
    </div>
    <MiniCurve p={p} w={w - 88} h={h * 0.3} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: MONO, fontSize: 26, color: p.tint }}>{p.summary}</span>
    </div>
  </div>
);

export const Profiles: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, isV } = useLayout();
  const S = T.scenes.profiles[0];
  const dur = f(T.scenes.profiles[1] - S);
  const cuts = T.profiles.cuts.map((c) => f(c - S));

  let idx = 0;
  cuts.forEach((c, i) => {
    if (frame >= c) idx = i + 1;
  });
  const p = PROFILES[idx];
  const prevP = PROFILES[Math.max(0, idx - 1)];
  const since = idx === 0 ? 999 : frame - cuts[idx - 1];

  const flipIn = spring({ frame: since, fps: FPS, config: { damping: 14, stiffness: 240, mass: 0.6 } });
  const inAngle = idx === 0 ? 0 : interpolate(flipIn, [0, 1], [-95, 0]);
  const outAngle = interpolate(since, [0, 6], [0, 95], { extrapolateRight: 'clamp' });

  const rpmKeys: Array<[number, number]> = [[0, PROFILES[0].rpm]];
  cuts.forEach((c, i) => rpmKeys.push([c, PROFILES[i].rpm], [c + 22, PROFILES[i + 1].rpm]));
  const rpm = useCount(frame, rpmKeys);

  const cardW = isV ? 900 : 860;
  const cardH = isV ? 620 : 560;
  const panelScale = isV ? 1.45 : 1.75;

  return (
    <Whip id="profiles" duration={dur} zoomIn frames={9}>
      <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
        <Wallpaper />
        <AbsoluteFill style={{ background: `radial-gradient(55% 55% at ${isV ? 50 : 66}% ${isV ? 42 : 56}%, ${p.tint}30, transparent 70%)` }} />
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: isV ? H * 0.06 : H * 0.06 }}>
          <Slam text={isV ? 'Profiles for\nevery *mood.*' : 'Profiles for every *mood.*'} at={0} size={isV ? 120 : 108} accent={p.tint === '#A1A1AA' ? C.cyan : p.tint} from={1.4} />
        </AbsoluteFill>
        {/* Menu-bar panel */}
        <div
          style={{
            position: 'absolute',
            left: isV ? W / 2 - (320 * panelScale) / 2 : W * 0.075,
            top: isV ? H * 0.585 : H * 0.235,
            transform: `scale(${panelScale})`,
            transformOrigin: '0 0',
          }}
        >
          <FanPilotPanel
            cpuAvg={63}
            cpuMax={71}
            fans={[
              { name: 'Left fan', manual: idx > 0, rpm, percent: ((rpm - 2317) / (7826 - 2317)) * 100, target: rpm },
              { name: 'Right fan', manual: idx > 0, rpm: rpm - 22, percent: ((rpm - 2339) / (7826 - 2317)) * 100, target: rpm },
            ]}
            active={p.name}
            accent={p.tint === '#A1A1AA' ? C.cyan : p.tint}
            style={isV ? { transform: 'none' } : undefined}
          />
        </div>
        {/* Flipping card */}
        <div
          style={{
            position: 'absolute',
            left: isV ? W / 2 - cardW / 2 : W * 0.62 - cardW / 2 + 40,
            top: isV ? H * 0.2 : H * 0.29,
            width: cardW,
            height: cardH,
            perspective: 2000,
          }}
        >
          {idx > 0 && since < 6 ? (
            <div style={{ position: 'absolute', inset: 0, transform: `rotateY(${outAngle}deg)`, transformOrigin: '50% 50%' }}>
              <Card p={prevP} w={cardW} h={cardH} />
            </div>
          ) : null}
          <div style={{ position: 'absolute', inset: 0, transform: `rotateY(${inAngle}deg)`, opacity: idx > 0 && since < 3 ? 0 : 1 }}>
            <Card p={p} w={cardW} h={cardH} />
          </div>
          <div style={{ position: 'absolute', right: 0, ...(isV ? { bottom: -88 } : { top: -92 }) }}>
            <KeyCombo keys={['fn', 'shift', 'F5']} frame={frame} pressFrame={idx === 0 ? -100 : cuts[idx - 1]} unit={58} accent={p.tint} />
          </div>
          <div
            style={{
              position: 'absolute',
              right: 44,
              bottom: 40,
              fontFamily: FONT,
              fontSize: 30,
              fontWeight: 600,
              color: C.white,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtInt(rpm)} <span style={{ color: C.dim, fontWeight: 500 }}>RPM</span>
          </div>
        </div>
      </AbsoluteFill>
    </Whip>
  );
};
