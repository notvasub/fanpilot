import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { FanGlyph } from '../components/Icons';
import { Hud, KeyCombo, MenuBar, Wallpaper } from '../components/Mac';
import { Slam } from '../components/Text';
import { useLayout } from '../components/FX';
import { C, FPS, f, fmtInt, heatP, rpmFor } from '../theme';

export type Press = { t: number; keys: string[]; percent: number | null };
export type HeroConfig = { startPercent: number; startAuto: boolean; presses: Press[]; end: number };

const AUTO_RPM = 3080;
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/** Everything derived from the press list at a given frame. */
const stateAt = (cfg: HeroConfig, frame: number) => {
  const pf = cfg.presses.map((p) => f(p.t));
  let idx = -1;
  for (let i = 0; i < pf.length; i++) if (pf[i] <= frame) idx = i;
  const pct = (i: number) => (i < 0 ? (cfg.startAuto ? null : cfg.startPercent) : cfg.presses[i].percent);
  const rpmOf = (p: number | null) => (p === null ? AUTO_RPM : rpmFor(p));
  const cur = pct(idx);
  const prev = pct(idx - 1);
  const since = idx < 0 ? 1e9 : frame - pf[idx];
  const prevForAnim = prev ?? cfg.startPercent;
  const percent = cur === null ? null : prevForAnim + (cur - prevForAnim) * ease(since / 10);
  const rpm = rpmOf(prev) + (rpmOf(cur) - rpmOf(prev)) * ease(since / 24);
  return { idx, pf, cur, prev, percent, rpm, since };
};

export const HeroSequence: React.FC<{ cfg: HeroConfig; loop?: boolean }> = ({ cfg, loop = false }) => {
  const frame = useCurrentFrame();
  const { W, H, isV } = useLayout();
  const st = stateAt(cfg, frame);
  const total = f(cfg.end);

  // Integrate fan angle and CPU temperature (lagging behind fan speed).
  let angle = 0;
  let temp = cfg.startAuto ? 74 : 79;
  const steps = loop ? total : frame;
  let angleAtFrame = 0;
  let tempAtFrame = temp;
  for (let k = 0; k <= steps; k++) {
    const s = stateAt(cfg, k);
    if (k === frame) {
      angleAtFrame = angle;
      tempAtFrame = temp;
    }
    angle += 0.5 + (s.rpm / 7826) * 15;
    const target = s.cur === null ? 74 : 80 - (s.cur - 40) * 0.42;
    temp += (target - temp) * 0.045;
  }
  // 3-blade glyphs repeat every 120°; the background glyph turns at 0.6×, so land on a multiple of 600°.
  if (loop) angleAtFrame *= (Math.round(angle / 600) * 600) / angle;

  const isAuto = st.cur === null;
  const pctShown = st.percent ?? 0;
  const heat = isAuto ? 0 : (pctShown - 40) / 45;
  const accent = isAuto ? C.cyan : heatP(pctShown);

  const first = st.pf[0];
  const hideAt = loop ? total - f(0.5) : Infinity;
  const hudVisible = frame >= first;
  const hudPop = st.since > 90 ? 1 : spring({ frame: st.since, fps: FPS, config: { damping: 9, stiffness: 320, mass: 0.5 } });
  const hudIn = frame - first > 90 ? 1 : spring({ frame: frame - first, fps: FPS, config: { damping: 14, stiffness: 260, mass: 0.6 } });
  const hide = loop ? interpolate(frame, [hideAt, hideAt + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
  const hudScale = (isV ? 2.8 : 2.55) * (0.86 + 0.14 * hudIn) * (1 + 0.05 * (1 - hudPop)) * (0.96 + 0.04 * hide);

  const press = st.idx >= 0 ? cfg.presses[st.idx] : null;
  const isFaster = press && press.keys.includes('F5');
  const isAutoPress = press && press.percent === null;
  const word = !press ? null : isAutoPress ? 'One key back\nto *auto.*' : isFaster ? '*FASTER.*' : '*SLOWER.*';
  const wordAccent = isFaster ? accent : C.cyan;
  const tilt = st.idx % 2 === 0 ? -1.5 : 1.5;
  const punch = 1 + 0.018 * Math.exp(-st.since / 6);

  const title = isAuto ? 'Automatic' : `Manual ${Math.round(press?.percent ?? cfg.startPercent)}%`;
  const detail = isAuto ? 'Fans back under macOS control' : `≈ ${fmtInt(st.rpm)} RPM`;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <Wallpaper warmth={Math.max(0, heat)} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ opacity: 0.06 + 0.06 * Math.max(0, heat), filter: 'blur(3px)', transform: `translate(${isV ? 0 : W * 0.18}px, ${isV ? H * 0.12 : H * 0.08}px)` }}>
            <FanGlyph size={isV ? H * 0.8 : H * 1.3} angle={angleAtFrame * 0.6} color={accent} />
          </div>
        </AbsoluteFill>
        <MenuBar
          width={W}
          height={isV ? 46 : 40}
          temp={tempAtFrame}
          tempColor={heatP(40 + (tempAtFrame - 64) * 2.2)}
          rpm={st.rpm}
          fanAuto={isAuto}
          fanAngle={angleAtFrame}
          appName="Xcode"
          compact={isV}
        />
      </AbsoluteFill>

      {word && frame < hideAt ? (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: isV ? H * 0.17 : H * (isAutoPress ? 0.08 : 0.1) }}>
          <div key={st.idx} style={{ transform: `rotate(${isAutoPress ? 0 : tilt}deg)` }}>
            <Slam
              text={word}
              at={st.pf[st.idx]}
              size={isAutoPress ? (isV ? 120 : 112) : isV ? 168 : 220}
              accent={wordAccent}
              from={isAutoPress ? 1.3 : 1.55}
              tracking={isAutoPress ? '-0.035em' : '-0.02em'}
            />
          </div>
        </AbsoluteFill>
      ) : null}

      {hudVisible ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: `translateY(${isV ? 40 : H * 0.07}px) scale(${hudScale})`, opacity: Math.min(1, hudIn * 2) * hide }}>
            <Hud title={title} detail={detail} fraction={isAuto ? null : pctShown / 100} accent={accent} fanAngle={angleAtFrame} />
          </div>
        </AbsoluteFill>
      ) : null}

      {press && frame >= st.pf[st.idx] - 3 && frame < hideAt ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: isV ? H * 0.17 : H * 0.075 }}>
          <div
            style={{
              transform: `scale(${0.9 + 0.1 * spring({ frame: frame - st.pf[st.idx] + 3, fps: FPS, config: { damping: 12, stiffness: 300 } })})`,
            }}
          >
            <KeyCombo keys={press.keys} frame={frame} pressFrame={st.pf[st.idx]} unit={isV ? 128 : 118} accent={isAutoPress ? C.cyan : accent} />
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
