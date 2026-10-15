// One drawn icon set, shared by Astro markup and runtime-rendered markup.
// Stroke icons use a 24px grid, 1.8px stroke, round caps. Fan blades match the app icon and the film.

const stroke = (body: string, w = 1.8) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const BLADE = 'M50,50 C45,42 41,30 46,20 C50,12 61,10 68,15 C75,21 72,31 64,38 C59,42 54,46 50,50 Z';

/** Filled three-blade fan (SF Symbols fan.fill spirit). The <g data-blades> is rotated at runtime. */
export const fanFill = `<svg viewBox="0 0 100 100" aria-hidden="true"><g data-blades>${[0, 120, 240]
  .map((r) => `<path d="${BLADE}" fill="currentColor" transform="rotate(${r} 50 50)"/>`)
  .join('')}</g><circle cx="50" cy="50" r="9" fill="currentColor"/><circle cx="50" cy="50" r="4" fill="rgba(0,0,0,.35)"/></svg>`;

/** Outline fan (SF Symbols fan), shown in the menu bar while Automatic is active. */
export const fanOutline = `<svg viewBox="0 0 100 100" aria-hidden="true"><g data-blades>${[0, 120, 240]
  .map((r) => `<path d="${BLADE}" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" transform="rotate(${r} 50 50)"/>`)
  .join('')}</g></svg>`;

export const icons = {
  cpu: stroke('<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>'),
  globe: stroke('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/>', 1.6),
  magnifier: stroke('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/>', 2),
  mic: stroke('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 2),
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" fill="currentColor"/></svg>',
  gauge: stroke('<path d="M3.5 17a8.5 8.5 0 1 1 17 0"/><path d="M12 17l3.6-5.2"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/>', 2.2),
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4.5 13.6h6.3L9.6 22l9.9-12.4h-6.6L13.5 2Z" fill="currentColor"/></svg>',
  wind: stroke('<path d="M3 8.5h11a3 3 0 1 0-3-3"/><path d="M3 12.5h16a3 3 0 1 1-3 3"/><path d="M3 16.5h7"/>', 2.2),
  auto: stroke('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>', 2.2),
  sliders: stroke('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  shield: stroke('<path d="M12 2.5 4 5.6v5.9c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5.6L12 2.5Z"/><path d="m8.6 12.2 2.4 2.4 4.6-4.9"/>', 1.6),
  check: stroke('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.2),
  plus: stroke('<path d="M12 5v14M5 12h14"/>', 2),
  minus: stroke('<path d="M5 12h14"/>', 2),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4.2" height="16" rx="1.2" fill="currentColor"/><rect x="13.8" y="4" width="4.2" height="16" rx="1.2" fill="currentColor"/></svg>',
  volume: stroke('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  mute: stroke('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  expand: stroke('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  copy: stroke('<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
  arrowDown: stroke('<path d="M12 5v14M6 13l6 6 6-6"/>', 2),
  chevron: stroke('<path d="m8 10 4 4 4-4"/>', 2),
  updown: stroke('<path d="m8.5 9.5 3.5-3.5 3.5 3.5M8.5 14.5l3.5 3.5 3.5-3.5"/>', 2),
  battery: '<svg viewBox="0 0 38 24" aria-hidden="true"><rect x="1" y="5" width="31" height="14" rx="4" stroke="currentColor" stroke-opacity=".5" stroke-width="1.5" fill="none"/><rect x="3.5" y="7.5" width="21" height="9" rx="2.2" fill="currentColor"/><path d="M34 10v4" stroke="currentColor" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18.5 9.6 16a3.4 3.4 0 0 1 4.8 0L12 18.5Z" fill="currentColor"/><path d="M6.9 13.3a7.4 7.4 0 0 1 10.2 0M4 10.4a11.5 11.5 0 0 1 16 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  controlCenter: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="6" rx="3" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="17.8" cy="8" r="1.8" fill="currentColor"/><rect x="3" y="13" width="18" height="6" rx="3" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="6.2" cy="16" r="1.8" fill="currentColor"/></svg>',
  // Function-row legends for the keyboard illustration.
  sunLow: stroke('<circle cx="12" cy="12" r="3.2"/><path d="M12 5.5v1M12 17.5v1M5.5 12h1M17.5 12h1M7.4 7.4l.7.7M15.9 15.9l.7.7M7.4 16.6l.7-.7M15.9 8.1l.7-.7"/>', 1.6),
  sunHigh: stroke('<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>', 1.6),
  mission: stroke('<rect x="3.5" y="5" width="7.5" height="6" rx="1.2"/><rect x="13" y="5" width="7.5" height="6" rx="1.2"/><rect x="3.5" y="13" width="7.5" height="6" rx="1.2"/><rect x="13" y="13" width="7.5" height="6" rx="1.2"/>', 1.5),
  rewind: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 7v10l-7-5 7-5Zm9 0v10l-7-5 7-5Z" fill="currentColor"/></svg>',
  playPause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7v10l7-5-7-5Z" fill="currentColor"/><rect x="13" y="7" width="2.6" height="10" rx=".6" fill="currentColor"/><rect x="17.6" y="7" width="2.6" height="10" rx=".6" fill="currentColor"/></svg>',
  forward: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v10l7-5-7-5Zm9 0v10l7-5-7-5Z" fill="currentColor"/></svg>',
  speaker0: stroke('<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/>', 1.6),
  speaker1: stroke('<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M14.5 10a3 3 0 0 1 0 4"/>', 1.6),
  speaker2: stroke('<path d="M3.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M14 10a3 3 0 0 1 0 4M16.5 7.5a6.5 6.5 0 0 1 0 9"/>', 1.6),
  triLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6v12L7 12z" fill="currentColor"/></svg>',
  triRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12l8-6z" fill="currentColor"/></svg>',
  triUp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15h12l-6-8z" fill="currentColor"/></svg>',
  triDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h12l-6 8z" fill="currentColor"/></svg>',
  lock: stroke('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 1.8),
} as const;

export type IconName = keyof typeof icons;

/** Apple-style app icon squircle (superellipse n=5) in a 100×100 box. */
export const squirclePath = (() => {
  const n = 5;
  const pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = 50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = 50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

/** The FanPilot app icon, same construction as launch-video/src/components/Mac.tsx. */
export const appIcon = (id = 'fp') => `<svg viewBox="0 0 100 100" aria-hidden="true">
<defs>
<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38BDF8"/><stop offset=".5" stop-color="#6F7CF0"/><stop offset="1" stop-color="#FF6A3D"/></linearGradient>
<radialGradient id="${id}-shade" cx=".5" cy=".45" r=".6"><stop offset=".35" stop-color="#0A0A0B" stop-opacity="0"/><stop offset="1" stop-color="#0A0A0B" stop-opacity=".35"/></radialGradient>
<linearGradient id="${id}-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<path d="${squirclePath}" fill="url(#${id}-bg)"/><path d="${squirclePath}" fill="url(#${id}-shade)"/>
<circle cx="50" cy="50" r="33" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.2"/>
<g data-blades>${[0, 120, 240]
  .map((r) => `<path d="${BLADE}" fill="#fff" transform="rotate(${r} 50 50) translate(50 50) scale(.78) translate(-50 -50)"/>`)
  .join('')}<circle cx="50" cy="50" r="6.5" fill="#fff"/><circle cx="50" cy="50" r="2.8" fill="#6F7CF0"/></g>
<path d="${squirclePath}" fill="url(#${id}-gloss)" opacity=".6"/><path d="${squirclePath}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".8"/>
</svg>`;
