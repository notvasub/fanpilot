import React from 'react';

type IconProps = { size: number; color?: string; strokeWidth?: number; style?: React.CSSProperties };

/** Swept-blade fan glyph (SF Symbols "fan.fill" spirit). `angle` in degrees. */
export const FanGlyph: React.FC<IconProps & { angle?: number; blades?: number; hubColor?: string }> = ({
  size,
  color = 'currentColor',
  angle = 0,
  blades = 3,
  hubColor,
  style,
}) => {
  const blade = 'M50,50 C45,42 41,30 46,20 C50,12 61,10 68,15 C75,21 72,31 64,38 C59,42 54,46 50,50 Z';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <g transform={`rotate(${angle} 50 50)`}>
        {Array.from({ length: blades }, (_, i) => (
          <path key={i} d={blade} fill={color} transform={`rotate(${(360 / blades) * i} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="9" fill={hubColor ?? color} />
      {hubColor ? null : <circle cx="50" cy="50" r="4" fill="rgba(0,0,0,0.35)" />}
    </svg>
  );
};

const Stroke: React.FC<IconProps & { children: React.ReactNode; vb?: number }> = ({ size, color = 'currentColor', strokeWidth = 2, style, children, vb = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox={`0 0 ${vb} ${vb}`}
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
);

export const MoonIcon: React.FC<IconProps> = (p) => (
  <svg width={p.size} height={p.size} viewBox="0 0 24 24" style={p.style}>
    <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" fill={p.color ?? 'currentColor'} />
  </svg>
);

export const GaugeIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} strokeWidth={p.strokeWidth ?? 2.2}>
    <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
    <path d="M12 17l3.6-5.2" />
    <circle cx="12" cy="17" r="1.4" fill={p.color ?? 'currentColor'} />
  </Stroke>
);

export const BoltIcon: React.FC<IconProps> = (p) => (
  <svg width={p.size} height={p.size} viewBox="0 0 24 24" style={p.style}>
    <path d="M13.5 2 4.5 13.6h6.3L9.6 22l9.9-12.4h-6.6L13.5 2Z" fill={p.color ?? 'currentColor'} />
  </svg>
);

export const WindIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} strokeWidth={p.strokeWidth ?? 2.2}>
    <path d="M3 8.5h11a3 3 0 1 0-3-3" />
    <path d="M3 12.5h16a3 3 0 1 1-3 3" />
    <path d="M3 16.5h7" />
  </Stroke>
);

export const AutoIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} strokeWidth={p.strokeWidth ?? 2.2}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </Stroke>
);

export const CpuIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} strokeWidth={p.strokeWidth ?? 1.8}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="0.8" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </Stroke>
);

export const ShieldIcon: React.FC<IconProps & { draw?: number; fill?: string; check?: number }> = ({
  size,
  color = 'currentColor',
  draw = 1,
  fill = 'none',
  check = 1,
  style,
}) => {
  const len = 70;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path
        d="M12 2.5 4 5.6v5.9c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5.6L12 2.5Z"
        fill={fill}
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - draw)}
      />
      <path
        d="M8.3 12.2l2.6 2.6 5-5.3"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={14}
        strokeDashoffset={14 * (1 - check)}
      />
    </svg>
  );
};

export const CheckCircle: React.FC<IconProps> = (p) => (
  <svg width={p.size} height={p.size} viewBox="0 0 24 24" style={p.style}>
    <circle cx="12" cy="12" r="10" fill={p.color ?? 'currentColor'} />
    <path d="M7.5 12.3l3 3 6-6.3" stroke="#0A0A0B" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const MagnifierIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} strokeWidth={p.strokeWidth ?? 2}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 20 20" />
  </Stroke>
);

export const MicIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} strokeWidth={p.strokeWidth ?? 2}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </Stroke>
);

export const GlobeIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} strokeWidth={p.strokeWidth ?? 1.6}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
  </Stroke>
);

export const WifiIcon: React.FC<IconProps> = (p) => (
  <svg width={p.size} height={p.size} viewBox="0 0 24 24" style={p.style}>
    <path d="M12 18.5 9.6 16a3.4 3.4 0 0 1 4.8 0L12 18.5Z" fill={p.color ?? 'currentColor'} />
    <path d="M6.9 13.3a7.4 7.4 0 0 1 10.2 0M4 10.4a11.5 11.5 0 0 1 16 0" stroke={p.color ?? 'currentColor'} strokeWidth={2} fill="none" strokeLinecap="round" />
  </svg>
);

export const BatteryIcon: React.FC<IconProps & { level?: number }> = ({ size, color = 'currentColor', level = 0.8, style }) => (
  <svg width={size * 1.6} height={size} viewBox="0 0 38 24" style={style}>
    <rect x="1" y="5" width="31" height="14" rx="4" stroke={color} strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
    <rect x="3.5" y="7.5" width={26 * level} height="9" rx="2.2" fill={color} />
    <path d="M34 10v4" stroke={color} strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
  </svg>
);

export const ControlCenterIcon: React.FC<IconProps> = (p) => (
  <svg width={p.size} height={p.size} viewBox="0 0 24 24" style={p.style}>
    <rect x="3" y="5" width="18" height="6" rx="3" stroke={p.color ?? 'currentColor'} strokeWidth={1.6} fill="none" />
    <circle cx="17.8" cy="8" r="1.8" fill={p.color ?? 'currentColor'} />
    <rect x="3" y="13" width="18" height="6" rx="3" stroke={p.color ?? 'currentColor'} strokeWidth={1.6} fill="none" />
    <circle cx="6.2" cy="16" r="1.8" fill={p.color ?? 'currentColor'} />
  </svg>
);

export const PointerCursor: React.FC<{ size: number; pressed?: boolean }> = ({ size, pressed }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 20 28" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}>
    <path
      d="M2 1.5v20.2l5-4.6 3.2 7.6 3.4-1.5-3.2-7.4 6.8-.4L2 1.5Z"
      fill={pressed ? '#e8e8e8' : '#111'}
      stroke="#fff"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  </svg>
);

/** Apple-style app icon squircle (superellipse n=5) as an SVG path in a 100×100 box. */
export const squirclePath = (() => {
  const n = 5;
  const pts: string[] = [];
  for (let i = 0; i < 128; i++) {
    const t = (i / 128) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = 50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = 50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();
