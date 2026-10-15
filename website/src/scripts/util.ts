export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b);

const textCache = new WeakMap<Element, string>();
/** Sets textContent only when it changed. */
export function setText(el: Element | null | undefined, text: string) {
  if (!el) return;
  if (textCache.get(el) === text) return;
  textCache.set(el, text);
  el.textContent = text;
}

const attrCache = new WeakMap<Element, Map<string, string>>();
export function setAttr(el: Element | null | undefined, name: string, value: string) {
  if (!el) return;
  let m = attrCache.get(el);
  if (!m) attrCache.set(el, (m = new Map()));
  if (m.get(name) === value) return;
  m.set(name, value);
  el.setAttribute(name, value);
}

export function setStyle(el: HTMLElement | SVGElement | null | undefined, prop: string, value: string) {
  if (!el) return;
  const key = `style:${prop}`;
  let m = attrCache.get(el);
  if (!m) attrCache.set(el, (m = new Map()));
  if (m.get(key) === value) return;
  m.set(key, value);
  el.style.setProperty(prop, value);
}

/** The film's accent: cool cyan → near-white → hot orange. */
const STOPS = [
  [56, 189, 248],
  [238, 234, 244],
  [255, 106, 61],
];
export function heatRGB(t: number) {
  const x = clamp(t) * 2;
  const i = Math.min(1, Math.floor(x));
  const f = x - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return a.map((v, k) => Math.round(v + (b[k] - v) * f)) as [number, number, number];
}
export const heatCSS = (t: number) => {
  const [r, g, b] = heatRGB(t);
  return `rgb(${r} ${g} ${b})`;
};

/** Size a canvas to its CSS box at device pixel ratio; returns the 2D context and CSS size. */
export function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/** Tracks whether an element is near the viewport. */
export function visibility(el: Element, margin = '200px') {
  const state = { visible: false };
  new IntersectionObserver(
    ([entry]) => {
      state.visible = entry.isIntersecting;
    },
    { rootMargin: margin },
  ).observe(el);
  return state;
}

export function once(el: Element, fn: () => void, threshold = 0.35) {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        io.disconnect();
        fn();
      }
    },
    { threshold },
  );
  io.observe(el);
}

export const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

export function mmss(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
