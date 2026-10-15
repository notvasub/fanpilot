import React from 'react';
import { interpolate } from 'remotion';
import { C, FONT, MONO, fmtInt } from '../theme';
import {
  BatteryIcon,
  ControlCenterIcon,
  CpuIcon,
  FanGlyph,
  GlobeIcon,
  MagnifierIcon,
  MicIcon,
  WifiIcon,
  squirclePath,
} from './Icons';

/* ───────────────────────── Desktop wallpaper ───────────────────────── */

export const Wallpaper: React.FC<{ warmth?: number; style?: React.CSSProperties }> = ({ warmth = 0, style }) => {
  const warm = `rgba(255,106,61,${0.1 + 0.28 * warmth})`;
  const cool = `rgba(56,189,248,${0.16 * (1 - warmth) + 0.04})`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(60% 70% at 18% 22%, ${cool}, transparent 70%),
          radial-gradient(55% 65% at 85% 85%, ${warm}, transparent 70%),
          radial-gradient(80% 80% at 60% 30%, rgba(76,52,140,0.22), transparent 70%),
          linear-gradient(160deg, #0d1018 0%, #0a0a0f 55%, #120c10 100%)`,
        ...style,
      }}
    />
  );
};

/* ───────────────────────── Menu bar ───────────────────────── */

export type MenuBarProps = {
  width: number;
  height?: number;
  /** CPU temperature shown by a system stats item; omit to hide. */
  temp?: number;
  tempColor?: string;
  /** FanPilot item: average RPM; omit to hide. */
  rpm?: number;
  fanAuto?: boolean;
  fanAngle?: number;
  fanColor?: string;
  highlightFan?: boolean;
  appName?: string;
  /** Narrow screens: fewer app menus and a short clock. */
  compact?: boolean;
};

export const MenuBar: React.FC<MenuBarProps> = ({
  width,
  height = 34,
  temp,
  tempColor = C.white,
  rpm,
  fanAuto = false,
  fanAngle = 0,
  fanColor = C.white,
  highlightFan = false,
  appName = 'Finder',
  compact = false,
}) => {
  const fs = height * 0.41;
  const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: height * 0.14, height, padding: `0 ${height * 0.3}px` };
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(16,16,20,0.55)',
        backdropFilter: 'blur(24px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        color: C.white,
        fontFamily: FONT,
        fontSize: fs,
        fontWeight: 500,
        letterSpacing: '-0.005em',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: height * 0.9, gap: height * 0.62 }}>
        <span style={{ fontWeight: 700 }}>{appName}</span>
        {(compact ? ['File', 'Edit', 'View'] : ['File', 'Edit', 'View', 'Go', 'Window', 'Help']).map((m) => (
          <span key={m} style={{ opacity: 0.92 }}>
            {m}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: height * 0.45 }}>
        {temp !== undefined ? (
          <div style={{ ...item, color: tempColor, fontVariantNumeric: 'tabular-nums' }}>
            <CpuIcon size={fs * 1.25} color={tempColor} />
            <span style={{ fontWeight: 600 }}>{Math.round(temp)}°</span>
          </div>
        ) : null}
        {rpm !== undefined ? (
          <div
            style={{
              ...item,
              borderRadius: height * 0.18,
              background: highlightFan ? 'rgba(255,255,255,0.18)' : 'transparent',
              height: height * 0.78,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fanAuto ? (
              <svg width={fs * 1.3} height={fs * 1.3} viewBox="0 0 100 100" style={{ transform: `rotate(${fanAngle}deg)` }}>
                {Array.from({ length: 3 }, (_, i) => (
                  <path key={i} d="M50,50 C45,42 41,30 46,20 C50,12 61,10 68,15 C75,21 72,31 64,38 C59,42 54,46 50,50 Z" fill="none" stroke={fanColor} strokeWidth={7} transform={`rotate(${120 * i} 50 50)`} />
                ))}
              </svg>
            ) : (
              <FanGlyph size={fs * 1.3} angle={fanAngle} color={fanColor} />
            )}
            <span>{Math.round(rpm)}</span>
          </div>
        ) : null}
        <div style={item}>
          <BatteryIcon size={fs * 1.05} level={0.82} color={C.white} />
        </div>
        <div style={item}>
          <WifiIcon size={fs * 1.25} color={C.white} />
        </div>
        <div style={item}>
          <MagnifierIcon size={fs * 1.15} color={C.white} strokeWidth={2.4} />
        </div>
        <div style={item}>
          <ControlCenterIcon size={fs * 1.25} color={C.white} />
        </div>
        <div style={{ ...item, paddingRight: 0 }}>{compact ? '9:41' : <>Wed 14 Oct&nbsp;&nbsp;9:41</>}</div>
      </div>
    </div>
  );
};

/* ───────────────────────── Vibrancy panel ───────────────────────── */

export const Vibrancy: React.FC<{ radius?: number; style?: React.CSSProperties; children?: React.ReactNode; tint?: string }> = ({
  radius = 12,
  style,
  children,
  tint = 'rgba(34,34,38,0.62)',
}) => (
  <div
    style={{
      background: tint,
      backdropFilter: 'blur(40px) saturate(180%)',
      border: `1px solid ${C.panelBorder}`,
      borderRadius: radius,
      boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
      ...style,
    }}
  >
    {children}
  </div>
);

/* ───────────────────────── FanPilot HUD (mirrors HUD.swift) ───────────────────────── */

export type HudProps = {
  title: string;
  detail: string;
  /** 0..1 or null for profiles/automatic. */
  fraction: number | null;
  accent: string;
  fanAngle: number;
  segments?: number;
};

export const Hud: React.FC<HudProps> = ({ title, detail, fraction, accent, fanAngle, segments = 10 }) => (
  <Vibrancy
    radius={18}
    tint="rgba(40,40,46,0.58)"
    style={{
      width: 240,
      height: 120,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      fontFamily: FONT,
      color: C.white,
    }}
  >
    <FanGlyph size={32} angle={fanAngle} color={accent} style={{ filter: `drop-shadow(0 0 6px ${accent}88)` }} />
    <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{title}</div>
    {fraction !== null ? (
      <div style={{ display: 'flex', gap: 2.5, width: 164 }}>
        {Array.from({ length: segments }, (_, i) => {
          const fill = Math.max(0, Math.min(1, fraction * segments - i));
          return (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
              <div style={{ width: `${fill * 100}%`, height: '100%', background: accent, boxShadow: `0 0 6px ${accent}` }} />
            </div>
          );
        })}
      </div>
    ) : null}
    <div style={{ fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>{detail}</div>
  </Vibrancy>
);

/* ───────────────────────── Keycaps ───────────────────────── */

export type KeyName = 'fn' | 'F4' | 'F5' | 'shift' | string;

export const Keycap: React.FC<{
  name: KeyName;
  unit?: number;
  w?: number;
  h?: number;
  pressed?: number;
  lit?: number;
  accent?: string;
}> = ({ name, unit = 64, w = 1, h = 1, pressed = 0, lit = 0, accent = C.cyan }) => {
  const legend = interpolate(lit, [0, 1], [0, 1]);
  const legendColor = lit > 0.01 ? `color-mix(in srgb, ${accent} ${legend * 100}%, #d8d8dc)` : '#d8d8dc';
  const fs = unit * 0.2;
  const icon = unit * 0.3;
  let content: React.ReactNode = <span style={{ fontSize: fs * 1.15 }}>{name}</span>;
  if (name === 'fn') {
    content = (
      <>
        <span style={{ position: 'absolute', right: unit * 0.12, top: unit * 0.08, fontSize: fs }}>fn</span>
        <span style={{ position: 'absolute', left: unit * 0.12, bottom: unit * 0.1 }}>
          <GlobeIcon size={icon * 0.8} color={legendColor} />
        </span>
      </>
    );
  } else if (name === 'F4' || name === 'F5') {
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: unit * 0.04 }}>
        {name === 'F4' ? <MagnifierIcon size={icon} color={legendColor} /> : <MicIcon size={icon} color={legendColor} />}
        <span style={{ fontSize: fs * 0.82 }}>{name}</span>
      </div>
    );
  } else if (name === 'shift') {
    content = (
      <>
        <span style={{ position: 'absolute', left: unit * 0.14, top: unit * 0.06, fontSize: fs * 1.2 }}>⇧</span>
        <span style={{ position: 'absolute', left: unit * 0.14, bottom: unit * 0.1, fontSize: fs * 0.9 }}>shift</span>
      </>
    );
  }
  return (
    <div
      style={{
        position: 'relative',
        width: unit * w,
        height: unit * h,
        borderRadius: unit * 0.13,
        background: `linear-gradient(180deg, #2b2b2f ${pressed * 30}%, #1a1a1d 100%)`,
        boxShadow: [
          `inset 0 ${unit * 0.015}px 0 rgba(255,255,255,${0.1 - pressed * 0.05})`,
          `0 ${unit * (0.05 - pressed * 0.035)}px 0 #050506`,
          `0 ${unit * (0.09 - pressed * 0.06)}px ${unit * 0.12}px rgba(0,0,0,0.6)`,
          lit > 0 ? `0 0 ${unit * 0.6 * lit}px ${accent}${Math.round(lit * 110).toString(16).padStart(2, '0')}` : '',
          lit > 0 ? `inset 0 0 0 ${unit * 0.02}px ${accent}${Math.round(lit * 200).toString(16).padStart(2, '0')}` : '',
        ]
          .filter(Boolean)
          .join(','),
        transform: `translateY(${pressed * unit * 0.035}px) scale(${1 - pressed * 0.025})`,
        color: legendColor,
        fontFamily: FONT,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textShadow: lit > 0.1 ? `0 0 ${unit * 0.15}px ${accent}` : undefined,
      }}
    >
      {content}
    </div>
  );
};

/** Keycastr-style combo: keys pop in, depress together on `pressFrame`. */
export const KeyCombo: React.FC<{ keys: KeyName[]; frame: number; pressFrame: number; unit?: number; accent: string }> = ({
  keys,
  frame,
  pressFrame,
  unit = 92,
  accent,
}) => {
  const local = frame - pressFrame;
  const pressed = local < 0 ? 0 : local < 3 ? 1 : Math.max(0, 1 - (local - 3) / 8);
  const lit = local < 0 ? 0 : Math.max(0.35, 1 - local / 30);
  return (
    <div style={{ display: 'flex', gap: unit * 0.16, alignItems: 'center' }}>
      {keys.map((k, i) => (
        <React.Fragment key={k + i}>
          {i > 0 ? <span style={{ color: C.dim, fontFamily: FONT, fontSize: unit * 0.32, fontWeight: 300 }}>+</span> : null}
          <Keycap name={k} unit={unit} w={k === 'shift' ? 1.55 : 1} pressed={pressed} lit={lit} accent={accent} />
        </React.Fragment>
      ))}
    </div>
  );
};

/* ───────────────────────── Window chrome ───────────────────────── */

export const MacWindow: React.FC<{
  title: string;
  width: number;
  height: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  bg?: string;
}> = ({ title, width, height, children, style, bg = 'rgba(28,28,31,0.92)' }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 12,
      background: bg,
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 0.5px #000',
      overflow: 'hidden',
      fontFamily: FONT,
      color: C.white,
      position: 'relative',
      ...style,
    }}
  >
    <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 16px', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
        <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, marginRight: 8 }} />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.dim }}>{title}</div>
    </div>
    <div style={{ position: 'absolute', top: 40, left: 0, right: 0, bottom: 0 }}>{children}</div>
  </div>
);

/* ───────────────────────── FanPilot menu-bar panel (mirrors MenuContentView.swift) ───────────────────────── */

export type PanelFan = { name: string; manual: boolean; rpm: number; percent: number; target: number };

export const PROFILE_ROWS = [
  { name: 'Automatic', summary: 'Automatic' },
  { name: 'Quiet', summary: 'CPU average 60–90 °C' },
  { name: 'Balanced', summary: 'CPU average 50–80 °C' },
  { name: 'Performance', summary: 'CPU hottest 45–75 °C' },
  { name: 'Full Speed', summary: 'Fixed 100%' },
];

export const FanPilotPanel: React.FC<{
  cpuAvg: number;
  cpuMax: number;
  fans: PanelFan[];
  active: string;
  accent: string;
  manualPercent?: number;
  style?: React.CSSProperties;
}> = ({ cpuAvg, cpuMax, fans, active, accent, manualPercent, style }) => (
  <Vibrancy
    radius={12}
    tint="rgba(30,30,34,0.78)"
    style={{ width: 320, padding: 14, fontFamily: FONT, fontSize: 13, color: C.white, display: 'flex', flexDirection: 'column', gap: 11, ...style }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 700 }}>FanPilot</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>
        <CpuIcon size={13} color={C.dim} />
        {Math.round(cpuAvg)} °C avg · {Math.round(cpuMax)} °C max
      </span>
    </div>
    {fans.map((fan) => (
      <div key={fan.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{fan.name}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 8,
              background: fan.manual ? `${accent}33` : 'rgba(255,255,255,0.12)',
              color: fan.manual ? accent : C.dim,
            }}
          >
            {fan.manual ? 'Manual' : 'Auto'}
          </span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(fan.rpm)} RPM</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)' }}>
          <div style={{ width: `${fan.percent}%`, height: '100%', borderRadius: 3, background: accent }} />
        </div>
        <div style={{ fontSize: 10, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>
          2317–7826 RPM · target {fmtInt(fan.target)}
        </div>
      </div>
    ))}
    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, color: C.dim }}>Profiles</span>
      {PROFILE_ROWS.map((p) => {
        const on = p.name === active;
        return (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div
              style={{
                width: 13,
                height: 13,
                borderRadius: 7,
                border: on ? 'none' : `1.4px solid ${C.dim}`,
                background: on ? accent : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {on ? <svg width={9} height={9} viewBox="0 0 10 10"><path d="M2 5.2l2 2 4-4.4" stroke="#0A0A0B" strokeWidth={1.8} fill="none" strokeLinecap="round" /></svg> : null}
            </div>
            <span>{p.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.dim }}>{p.summary}</span>
          </div>
        );
      })}
    </div>
    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.dim }}>
        <span>Manual speed</span>
        {manualPercent !== undefined ? <span style={{ color: C.white, fontVariantNumeric: 'tabular-nums' }}>{Math.round(manualPercent)}%</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.dim }}>−</span>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', position: 'relative' }}>
          <div style={{ width: `${manualPercent ?? fans[0]?.percent ?? 0}%`, height: '100%', background: accent, borderRadius: 2 }} />
          <div
            style={{
              position: 'absolute',
              left: `calc(${manualPercent ?? fans[0]?.percent ?? 0}% - 8px)`,
              top: -6,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: '#e8e8ea',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          />
        </div>
        <span style={{ color: C.dim }}>+</span>
      </div>
    </div>
    <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.45 }}>
      fn F4 / fn F5 — slower / faster by 10%
      <br />
      fn ⇧F4 — automatic &nbsp;·&nbsp; fn ⇧F5 — next profile
    </div>
  </Vibrancy>
);

/* ───────────────────────── App icon ───────────────────────── */

export const AppIcon: React.FC<{ size: number; angle?: number; glow?: number; bare?: boolean }> = ({ size, angle = 0, glow = 0, bare = false }) => (
  <div style={{ width: size, height: size, position: 'relative' }}>
    {glow > 0 ? (
      <div
        style={{
          position: 'absolute',
          inset: -size * 0.35,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(56,189,248,${0.45 * glow}), rgba(255,106,61,${0.28 * glow}) 55%, transparent 75%)`,
          filter: `blur(${size * 0.08}px)`,
        }}
      />
    ) : null}
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id="fp-icon-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#6F7CF0" />
          <stop offset="1" stopColor="#FF6A3D" />
        </linearGradient>
        <radialGradient id="fp-icon-shade" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0.35" stopColor="#0A0A0B" stopOpacity="0.0" />
          <stop offset="1" stopColor="#0A0A0B" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="fp-icon-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="fp-blade-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" floodColor="#0A0A0B" floodOpacity="0.45" />
        </filter>
      </defs>
      {bare ? null : <path d={squirclePath} fill="url(#fp-icon-bg)" />}
      {bare ? null : <path d={squirclePath} fill="url(#fp-icon-shade)" />}
      {bare ? null : <circle cx="50" cy="50" r="33" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />}
      <g filter="url(#fp-blade-shadow)" transform={`rotate(${angle} 50 50)`}>
        {Array.from({ length: 3 }, (_, i) => (
          <path key={i} d="M50,50 C45,42 41,30 46,20 C50,12 61,10 68,15 C75,21 72,31 64,38 C59,42 54,46 50,50 Z" fill="#fff" transform={`rotate(${120 * i} 50 50) translate(50 50) scale(0.78) translate(-50 -50)`} />
        ))}
        <circle cx="50" cy="50" r="6.5" fill="#fff" />
        <circle cx="50" cy="50" r="2.8" fill="#6F7CF0" />
      </g>
      {bare ? null : <path d={squirclePath} fill="url(#fp-icon-gloss)" opacity={0.6} />}
      {bare ? null : <path d={squirclePath} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />}
    </svg>
  </div>
);

export const Mono: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{ fontFamily: MONO, ...style }}>{children}</span>
);
