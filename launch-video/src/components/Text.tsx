import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { C, FONT, slam } from '../theme';

type Unit = { text: string; hl: boolean; br: boolean };

/** "Your Mac runs *hot.*" → units; `*…*` marks the accent keyword, `\n` breaks the line. */
const parse = (text: string, perWord: boolean): Unit[] => {
  const units: Unit[] = [];
  text.split('\n').forEach((line, li) => {
    const parts = line.split('*');
    parts.forEach((part, pi) => {
      if (!part) return;
      const hl = pi % 2 === 1;
      const pieces = perWord ? part.split(/(\s+)/) : (part.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? ['', '', part, '']).slice(1);
      pieces.filter(Boolean).forEach((w) => units.push({ text: w, hl, br: false }));
    });
    if (li < text.split('\n').length - 1) units.push({ text: '', hl: false, br: true });
  });
  return units;
};

export type SlamProps = {
  text: string;
  /** Frame (local to the enclosing Sequence) the text hits. */
  at: number;
  size: number;
  accent?: string;
  color?: string;
  weight?: number;
  /** Frames between words; 0 slams the whole line at once. */
  stagger?: number;
  align?: 'center' | 'left' | 'right';
  lineHeight?: number;
  tracking?: string;
  style?: React.CSSProperties;
  /** Starting scale of the slam (zoom-punch). */
  from?: number;
  glow?: boolean;
};

export const Slam: React.FC<SlamProps> = ({
  text,
  at,
  size,
  accent = C.orange,
  color = C.white,
  weight = 800,
  stagger = 0,
  align = 'center',
  lineHeight = 1.02,
  tracking = '-0.035em',
  style,
  from = 1.35,
  glow = true,
}) => {
  const frame = useCurrentFrame();
  const units = parse(text, stagger > 0);
  let wordIndex = 0;
  if (stagger === 0) {
    // Whole line slams as one block so keyword gaps don't breathe during the overshoot.
    const local = frame - at;
    if (local < 0) return null;
    const s = slam(frame, at);
    const blur = Math.max(0, 6 - local * 2);
    return (
      <div
        style={{
          fontFamily: FONT,
          fontSize: size,
          fontWeight: weight,
          letterSpacing: tracking,
          lineHeight,
          color,
          textAlign: align,
          whiteSpace: 'pre-wrap',
          transform: `scale(${interpolate(s, [0, 1], [from, 1])})`,
          transformOrigin: align === 'left' ? '0% 60%' : align === 'right' ? '100% 60%' : '50% 60%',
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          ...style,
        }}
      >
        {units.map((u, i) =>
          u.br ? (
            <br key={i} />
          ) : (
            <span key={i} style={u.hl ? { color: accent, textShadow: glow ? `0 0 ${size * 0.35}px ${accent}66` : undefined } : undefined}>
              {u.text}
            </span>
          ),
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: tracking,
        lineHeight,
        color,
        textAlign: align,
        whiteSpace: 'pre-wrap',
        ...style,
      }}
    >
      {units.map((u, i) => {
        if (u.br) return <br key={i} />;
        const isSpace = /^\s+$/.test(u.text);
        // Spaces stay plain inline text so they keep their natural width next to inline-block words.
        if (isSpace) return <span key={i}>{u.text}</span>;
        const local = frame - at - (stagger > 0 ? wordIndex++ : 0) * stagger;
        if (local < 0) {
          return (
            <span key={i} style={{ opacity: 0 }}>
              {u.text}
            </span>
          );
        }
        const s = slam(frame, frame - local);
        const scale = interpolate(s, [0, 1], [from, 1]);
        const blur = Math.max(0, 6 - local * 2);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `scale(${scale})`,
              transformOrigin: '50% 60%',
              filter: blur > 0 ? `blur(${blur}px)` : undefined,
              color: u.hl ? accent : undefined,
              textShadow: u.hl && glow ? `0 0 ${size * 0.35}px ${accent}66` : undefined,
              whiteSpace: 'pre',
            }}
          >
            {u.text}
          </span>
        );
      })}
    </div>
  );
};

/** Number that always counts between values rather than popping in. */
export const useCount = (frame: number, keys: Array<[number, number]>, ease = (t: number) => 1 - Math.pow(1 - t, 3)) => {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (frame <= f1) return v0 + (v1 - v0) * ease((frame - f0) / Math.max(1, f1 - f0));
  }
  return keys[keys.length - 1][1];
};
