import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { FanGlyph, PointerCursor } from '../components/Icons';
import { MacWindow, Wallpaper } from '../components/Mac';
import { Slam } from '../components/Text';
import { Whip, useLayout } from '../components/FX';
import { C, FONT, FPS, MONO, T, f, fmtInt, heatP, rpmFor } from '../theme';

const X0 = 30;
const X1 = 100;

export const Curves: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, isV } = useLayout();
  const S = T.scenes.curves[0];
  const dur = f(T.scenes.curves[1] - S);
  const tText = f(T.curves.text - S);
  const tGrab = f(T.curves.grab - S);
  const tRelease = f(T.curves.release - S);

  // Card-flip entrance from the profiles card.
  const flip = spring({ frame, fps: FPS, config: { damping: 15, stiffness: 200, mass: 0.7 } });
  const flipAngle = interpolate(flip, [0, 1], [-90, 0]);

  const winW = isV ? 1000 : 1400;
  const winH = isV ? 1180 : 760;
  const sidebar = isV ? 0 : 250;
  const gx = sidebar + (isV ? 90 : 90);
  const gy = isV ? 210 : 150;
  const gw = winW - gx - (isV ? 60 : 330);
  const gh = isV ? 560 : 440;

  // Drag the "to" handle from 90 °C down to 70 °C, with a slightly human path.
  const dragT = interpolate(frame, [tGrab, tRelease], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dragEase = dragT < 0.5 ? 4 * dragT ** 3 : 1 - Math.pow(-2 * dragT + 2, 3) / 2;
  const toC = T.curves.toStartC + (T.curves.toEndC - T.curves.toStartC) * dragEase + Math.sin(dragT * Math.PI * 3) * 0.6 * (1 - dragT);
  const fromC = T.curves.fromC;
  const curve = (c: number) => Math.max(0, Math.min(100, ((c - fromC) / (toC - fromC)) * 100));

  const px = (c: number) => gx + ((c - X0) / (X1 - X0)) * gw;
  const py = (p: number) => gy + gh - (p / 100) * gh;

  // Live CPU temperature wandering between 62 and 74 °C.
  const sec = frame / FPS;
  const liveC = 67 + 4.5 * Math.sin(sec * 1.7) + 2 * Math.sin(sec * 3.9 + 1);
  const livePct = curve(liveC);
  const liveRPM = rpmFor(livePct);
  const accent = heatP(40 + livePct * 0.45);

  // Pointer: approach the handle, grab, drag, release, drift away.
  const handle = { x: px(toC), y: py(100) };
  const approach = interpolate(frame, [12, tGrab - 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 3) });
  const start = { x: px(84), y: py(55) };
  let cursor = { x: start.x + (handle.x - start.x) * approach, y: start.y + (handle.y - start.y) * approach };
  if (frame >= tGrab) cursor = handle;
  if (frame > tRelease + 4) {
    const away = interpolate(frame, [tRelease + 4, tRelease + 40], [0, 1], { extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 2) });
    cursor = { x: handle.x + 60 * away, y: handle.y + 90 * away };
  }
  const grabbing = frame >= tGrab && frame <= tRelease;

  const path: string[] = [];
  for (let c = X0; c <= X1; c += 0.5) path.push(`${px(c).toFixed(1)},${py(curve(c)).toFixed(1)}`);

  return (
    <Whip id="curves" duration={dur} exit={1} frames={9}>
      <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
        <Wallpaper warmth={0.2} />
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: isV ? H * 0.06 : H * 0.045 }}>
          {frame >= tText ? (
            <Slam text={isV ? 'Draw the *curve.*\nFans follow.' : 'Draw the *curve.* Fans follow.'} at={tText} size={isV ? 112 : 96} accent={C.cyan} from={1.4} />
          ) : null}
        </AbsoluteFill>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 2200 }}>
          <div style={{ transform: `translateY(${isV ? 150 : 70}px) rotateY(${flipAngle}deg)` }}>
            <MacWindow title="FanPilot Profiles" width={winW} height={winH}>
              {sidebar ? (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: sidebar, background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '18px 12px', boxSizing: 'border-box', fontSize: 16 }}>
                  {['Automatic', 'Quiet', 'Balanced', 'Performance', 'Full Speed', 'Custom'].map((n) => (
                    <div
                      key={n}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 7,
                        marginBottom: 2,
                        background: n === 'Custom' ? 'rgba(56,189,248,0.22)' : 'transparent',
                        color: n === 'Custom' ? C.white : C.dim,
                        fontWeight: n === 'Custom' ? 600 : 500,
                      }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ position: 'absolute', left: sidebar + 40, top: 26, right: 40, display: 'flex', alignItems: 'center', gap: 14, fontSize: isV ? 26 : 22 }}>
                <span style={{ fontSize: isV ? 40 : 34, fontWeight: 800, letterSpacing: '-0.03em' }}>Custom</span>
                <span style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: C.white }}>Follow temperature</span>
                <span style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: C.dim }}>CPU average</span>
              </div>
              <svg width={winW} height={winH - 40} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                <defs>
                  <linearGradient id="curve-stroke" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0" stopColor={C.cyan} />
                    <stop offset="1" stopColor={C.orange} />
                  </linearGradient>
                  <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={C.orange} stopOpacity="0.22" />
                    <stop offset="1" stopColor={C.cyan} stopOpacity="0.02" />
                  </linearGradient>
                  <filter id="curve-glow" x="-10%" y="-30%" width="120%" height="160%">
                    <feGaussianBlur stdDeviation="7" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {[0, 25, 50, 75, 100].map((p) => (
                  <g key={p}>
                    <line x1={gx} x2={gx + gw} y1={py(p)} y2={py(p)} stroke="rgba(255,255,255,0.07)" />
                    <text x={gx - 14} y={py(p) + 6} fill={C.dim} fontSize={isV ? 22 : 17} textAnchor="end" fontFamily={FONT}>
                      {p}%
                    </text>
                  </g>
                ))}
                {[30, 40, 50, 60, 70, 80, 90, 100].map((c) => (
                  <g key={c}>
                    <line x1={px(c)} x2={px(c)} y1={gy} y2={gy + gh} stroke="rgba(255,255,255,0.05)" />
                    <text x={px(c)} y={gy + gh + 30} fill={C.dim} fontSize={isV ? 22 : 17} textAnchor="middle" fontFamily={FONT}>
                      {c}°
                    </text>
                  </g>
                ))}
                <polygon points={`${px(X0)},${py(0)} ${path.join(' ')} ${px(X1)},${py(0)}`} fill="url(#curve-fill)" />
                <polyline points={path.join(' ')} stroke="url(#curve-stroke)" strokeWidth={6} fill="none" strokeLinejoin="round" filter="url(#curve-glow)" />
                {/* Live temperature crosshair */}
                <line x1={px(liveC)} x2={px(liveC)} y1={py(livePct)} y2={gy + gh} stroke={accent} strokeDasharray="5 7" strokeWidth={2} opacity={0.7} />
                <line x1={gx} x2={px(liveC)} y1={py(livePct)} y2={py(livePct)} stroke={accent} strokeDasharray="5 7" strokeWidth={2} opacity={0.7} />
                <circle cx={px(liveC)} cy={py(livePct)} r={22} fill={accent} opacity={0.18} />
                <circle cx={px(liveC)} cy={py(livePct)} r={10} fill={accent} stroke="#fff" strokeWidth={3} style={{ filter: `drop-shadow(0 0 10px ${accent})` }} />
                <text x={px(liveC) + 18} y={py(livePct) - 22} fill={C.white} fontSize={isV ? 24 : 19} fontFamily={MONO}>
                  {liveC.toFixed(1)} °C → {Math.round(livePct)}%
                </text>
                {/* Handles */}
                {[
                  { c: fromC, p: 0, active: false, label: `${fromC} °C` },
                  { c: toC, p: 100, active: grabbing, label: `${Math.round(toC)} °C` },
                ].map((h) => (
                  <g key={h.p}>
                    <circle cx={px(h.c)} cy={py(h.p)} r={h.active ? 20 : 15} fill="#0A0A0B" stroke={h.p ? C.orange : C.cyan} strokeWidth={5} />
                    {h.active ? <circle cx={px(h.c)} cy={py(h.p)} r={34} fill="none" stroke={C.orange} strokeOpacity={0.45} strokeWidth={2} /> : null}
                    <text x={px(h.c)} y={h.p ? py(h.p) - 34 : py(h.p) + 62} fill={h.p ? C.orange : C.cyan} fontSize={isV ? 24 : 19} textAnchor="middle" fontWeight={700} fontFamily={FONT}>
                      {h.label}
                    </text>
                  </g>
                ))}
              </svg>
              {/* RPM readout */}
              <div
                style={{
                  position: 'absolute',
                  ...(isV ? { left: 90, right: 60, top: gy + gh + 90 } : { right: 40, top: gy, width: 250 }),
                  display: 'flex',
                  flexDirection: isV ? 'row' : 'column',
                  gap: isV ? 50 : 26,
                  fontFamily: FONT,
                }}
              >
                {['Left fan', 'Right fan'].map((n, i) => (
                  <div key={n} style={{ padding: 22, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.dim, fontSize: isV ? 24 : 18 }}>
                      <FanGlyph size={isV ? 30 : 24} angle={frame * (2 + livePct * 0.14) + i * 20} color={accent} /> {n}
                    </div>
                    <div style={{ fontSize: isV ? 56 : 46, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>
                      {fmtInt(liveRPM - i * 24)}
                    </div>
                    <div style={{ color: C.dim, fontSize: isV ? 22 : 16, fontVariantNumeric: 'tabular-nums' }}>RPM · {Math.round(livePct)}%</div>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', left: cursor.x - 3, top: cursor.y - 3 }}>
                <PointerCursor size={isV ? 30 : 26} pressed={grabbing} />
              </div>
            </MacWindow>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </Whip>
  );
};
