// Builds the soundtrack for every cut: synthesized 120 BPM music bed (or audio/music.wav if present),
// the Mixkit/CC0 SFX from assets/sfx placed on the cue sheet, an RPM-driven fan whir, music ducking,
// and a master limiter. Writes public/mix-main.wav and public/mix-teaser.wav.
//
//   node audio/mix.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SFX = path.resolve(ROOT, '../assets/sfx');
const KEYS = path.join(SFX, 'keyboard-pack/single-keys');
const CACHE = path.join(ROOT, 'audio/cache');
mkdirSync(CACHE, { recursive: true });
const TL = JSON.parse(readFileSync(path.join(ROOT, 'src/timeline.json'), 'utf8'));

const SR = 48000;
const FRAME = 1 / TL.fps;
const BEAT = 60 / TL.bpm;
const db = (d) => Math.pow(10, d / 20);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ───────────── buffers ───────────── */

const stereo = (n) => [new Float32Array(n), new Float32Array(n)];

const decodeCache = new Map();
function decode(file) {
  if (decodeCache.has(file)) return decodeCache.get(file);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const all = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  const n = all.length / 2;
  const [L, R] = stereo(n);
  for (let i = 0; i < n; i++) {
    L[i] = all[2 * i];
    R[i] = all[2 * i + 1];
  }
  decodeCache.set(file, [L, R]);
  return [L, R];
}

function writeWav(file, [L, R]) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  let seed = 1;
  const tpdf = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const a = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return a - seed / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(clamp(Math.round(L[i] * 32767 + tpdf()), -32768, 32767), 44 + i * 4);
    buf.writeInt16LE(clamp(Math.round(R[i] * 32767 + tpdf()), -32768, 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}

/** Integrated loudness and true peak via ffmpeg's EBU R128 meter. */
function measure(file) {
  const r = spawnSync('ffmpeg', ['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary'));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]), TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]) };
}

/* ───────────── DSP helpers ───────────── */

/** RBJ biquad, coefficients recomputed per call to `set`. */
class Biquad {
  constructor() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, freq, q = 0.707) {
    const w = (2 * Math.PI * clamp(freq, 10, SR * 0.45)) / SR;
    const c = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (type === 'hp') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [a, 0, -a]; // band-pass, 0 dB peak
    const a0 = 1 + a;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// mulberry32: deterministic white noise without the spectral lines a plain LCG leaves.
let noiseSeed = 0x2f6a3d;
const noise = () => {
  noiseSeed = (noiseSeed + 0x6d2b79f5) | 0;
  let t = Math.imul(noiseSeed ^ (noiseSeed >>> 15), 1 | noiseSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
};
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Small Freeverb-style reverb (4 combs + 2 allpasses per side). */
function reverb([L, R], { size = 0.82, damp = 0.35, wet = 0.25 } = {}) {
  const combs = [1116, 1188, 1277, 1356];
  const aps = [556, 441];
  const out = stereo(L.length);
  for (const [ch, src, spread] of [[0, L, 0], [1, R, 23]]) {
    const cb = combs.map((d) => ({ buf: new Float32Array(d + spread), i: 0, lp: 0 }));
    const ab = aps.map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < src.length; n++) {
      const x = src[n] * 0.2;
      let y = 0;
      for (const c of cb) {
        const v = c.buf[c.i];
        c.lp = v * (1 - damp) + c.lp * damp;
        c.buf[c.i] = x + c.lp * size;
        c.i = (c.i + 1) % c.buf.length;
        y += v;
      }
      for (const a of ab) {
        const v = a.buf[a.i];
        a.buf[a.i] = y + v * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = v - y;
      }
      out[ch][n] = src[n] + y * wet;
    }
  }
  return out;
}

/* ───────────── music synth ───────────── */

const CHORDS = [
  { root: 45, notes: [60, 64, 67, 71] }, // Am9  (C E G B over A)
  { root: 41, notes: [57, 60, 64, 67] }, // Fmaj9 (A C E G over F)
  { root: 48, notes: [64, 67, 71, 74] }, // Cmaj9 (E G B D over C)
  { root: 43, notes: [59, 62, 64, 69] }, // G6/9 (B D E A over G)
];

/**
 * Renders the music bed. `arr(t)` returns the arrangement at time t:
 * { kick, clap, hats, ohat, bass, stabs, pad, arp, roll, lp (master low-pass Hz), pump }
 */
function synthMusic(duration, arr, { loop = false } = {}) {
  const n = Math.ceil(duration * SR);
  const tail = loop ? Math.ceil(2 * SR) : 0;
  const drums = stereo(n + tail);
  const tonal = stereo(n + tail);
  const add = (bus, i, l, r = l) => {
    if (i >= 0 && i < bus[0].length) {
      bus[0][i] += l;
      bus[1][i] += r;
    }
  };
  const sixteenth = BEAT / 4;
  const swing = (k) => (k % 2 === 1 ? sixteenth * 0.08 : 0);
  const steps = Math.floor(duration / sixteenth);

  for (let k = 0; k < steps; k++) {
    const t = k * sixteenth + swing(k);
    const a = arr(t);
    const i0 = Math.round(t * SR);
    const beatPos = k % 4;
    const barStep = k % 16;
    const chord = CHORDS[Math.floor(t / (BEAT * 4)) % CHORDS.length];

    if (a.kick && beatPos === 0) {
      const len = Math.round(0.42 * SR);
      let ph = 0;
      for (let j = 0; j < len; j++) {
        const tt = j / SR;
        const f0 = 48 + 110 * Math.exp(-tt / 0.035);
        ph += (2 * Math.PI * f0) / SR;
        const env = Math.exp(-tt / 0.16) * (tt < 0.002 ? tt / 0.002 : 1);
        const click = j < 90 ? noise() * 0.25 * (1 - j / 90) : 0;
        const v = (Math.sin(ph) * env + click) * 0.95 * a.kick;
        add(drums, i0 + j, v);
      }
    }
    if (a.clap && (barStep === 4 || barStep === 12)) {
      const bp = new Biquad().set('bp', 1300, 1.2);
      const len = Math.round(0.26 * SR);
      for (let j = 0; j < len; j++) {
        const tt = j / SR;
        const burst = [0, 0.011, 0.022].reduce((s, o) => s + (tt >= o ? Math.exp(-(tt - o) / 0.006) : 0), 0);
        const env = tt < 0.03 ? burst * 0.6 : Math.exp(-(tt - 0.03) / 0.07) * 0.55;
        const v = bp.run(noise()) * env * 1.6 * a.clap;
        add(drums, i0 + j, v * 0.9, v * 1.1);
      }
    }
    if (a.hats) {
      const hp = new Biquad().set('hp', 8000, 0.8);
      const vel = [0.5, 0.25, 0.75, 0.3][beatPos];
      const len = Math.round(0.03 * SR);
      for (let j = 0; j < len; j++) {
        const v = hp.run(noise()) * Math.exp(-j / SR / 0.009) * 0.28 * vel * a.hats;
        add(drums, i0 + j, v * 0.8, v);
      }
    }
    if (a.ohat && beatPos === 2) {
      const hp = new Biquad().set('hp', 7000, 0.7);
      const len = Math.round(0.16 * SR);
      for (let j = 0; j < len; j++) {
        const v = hp.run(noise()) * Math.exp(-j / SR / 0.05) * 0.22 * a.ohat;
        add(drums, i0 + j, v, v * 0.8);
      }
    }
    if (a.roll) {
      const bp = new Biquad().set('bp', 1800, 0.9);
      const len = Math.round(0.08 * SR);
      for (let j = 0; j < len; j++) {
        const v = bp.run(noise()) * Math.exp(-j / SR / 0.03) * 0.5 * a.roll;
        add(drums, i0 + j, v);
      }
    }
    if (a.bass && (beatPos === 2 || barStep === 15)) {
      const note = chord.root - 12 + (barStep === 15 ? 12 : 0);
      const fr = midi(note + 12);
      const lp = new Biquad().set('lp', 380, 0.9);
      const len = Math.round(0.24 * SR);
      let ph = 0;
      for (let j = 0; j < len; j++) {
        const tt = j / SR;
        ph += fr / SR;
        const saw = 2 * (ph % 1) - 1;
        const env = Math.min(1, tt / 0.004) * Math.exp(-tt / 0.16);
        const v = lp.run(Math.sin(2 * Math.PI * ph) * 0.8 + saw * 0.35) * env * 0.75 * a.bass;
        add(tonal, i0 + j, v);
      }
    }
    if (a.stabs && [3, 6, 10, 14].includes(barStep)) {
      const lp = [new Biquad(), new Biquad()];
      const len = Math.round(0.34 * SR);
      const phs = chord.notes.flatMap(() => [noise() * 0.5 + 0.5, noise() * 0.5 + 0.5]);
      for (let j = 0; j < len; j++) {
        const tt = j / SR;
        if (j % 32 === 0) {
          const fc = 500 + 2600 * Math.exp(-tt / 0.07) * a.stabs;
          lp[0].set('lp', fc, 1.1);
          lp[1].set('lp', fc, 1.1);
        }
        let l = 0;
        let r = 0;
        chord.notes.forEach((m, q) => {
          for (let d = 0; d < 2; d++) {
            const fr = midi(m) * (d ? 1.006 : 0.994);
            const idx = q * 2 + d;
            phs[idx] = (phs[idx] + fr / SR) % 1;
            const s = 2 * phs[idx] - 1;
            if (d) r += s;
            else l += s;
          }
        });
        const env = Math.min(1, tt / 0.003) * Math.exp(-tt / 0.13);
        add(tonal, i0 + j, lp[0].run(l) * env * 0.12 * a.stabs, lp[1].run(r) * env * 0.12 * a.stabs);
      }
    }
    if (a.arp) {
      const notes = [...chord.notes, chord.notes[0] + 12];
      const m = notes[[0, 2, 1, 3, 4, 3, 2, 1][k % 8]] + 12;
      const fr = midi(m);
      const lp = new Biquad();
      const len = Math.round(0.18 * SR);
      let ph = 0;
      for (let j = 0; j < len; j++) {
        const tt = j / SR;
        if (j % 32 === 0) lp.set('lp', 900 + 3500 * Math.exp(-tt / 0.04), 1.4);
        ph = (ph + fr / SR) % 1;
        const v = lp.run(2 * ph - 1 + (ph < 0.5 ? 0.4 : -0.4)) * Math.exp(-tt / 0.07) * 0.09 * a.arp;
        const pan = k % 2 ? 0.7 : 1.0;
        add(tonal, i0 + j, v * pan, v * (1.7 - pan));
      }
    }
  }

  // Pad: continuous, voiced per bar, cross-faded.
  const lpL = new Biquad();
  const lpR = new Biquad();
  const pph = new Float64Array(16).map(() => noise() * 0.5 + 0.5);
  let padAmp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 64 === 0) {
      const a = arr(t);
      lpL.set('lp', a.padLp ?? 900, 0.6);
      lpR.set('lp', a.padLp ?? 900, 0.6);
    }
    if (i % 480 === 0) padAmp = arr(t).pad;
    const amp = padAmp;
    if (amp <= 0.0001) continue;
    const ci = Math.floor(t / (BEAT * 4)) % CHORDS.length;
    const chord = CHORDS[ci];
    let l = 0;
    let r = 0;
    chord.notes.forEach((m, q) => {
      for (let d = 0; d < 2; d++) {
        const idx = q * 2 + d;
        pph[idx] = (pph[idx] + (midi(m - 12) * (d ? 1.004 : 0.996)) / SR) % 1;
        const s = 2 * pph[idx] - 1;
        if (d) r += s;
        else l += s;
      }
    });
    // root sub
    pph[15] = (pph[15] + midi(chord.root) / SR) % 1;
    const sub = Math.sin(2 * Math.PI * pph[15]) * 0.5;
    tonal[0][i] += (lpL.run(l) * 0.06 + sub * 0.12) * amp;
    tonal[1][i] += (lpR.run(r) * 0.06 + sub * 0.12) * amp;
  }

  // Sidechain the tonal bus to the kick, then sum.
  const out = stereo(n + tail);
  const tonalVerb = reverb(tonal, { wet: 0.35 });
  const drumsVerb = reverb(drums, { wet: 0.12, size: 0.7 });
  for (let i = 0; i < n + tail; i++) {
    const t = (i / SR) % (loop ? duration : Infinity);
    const a = arr(Math.min(t, duration - 1e-3));
    const sinceBeat = t % BEAT;
    const sc = a.kick ? 1 - 0.55 * Math.exp(-sinceBeat / 0.1) : 1;
    out[0][i] = drumsVerb[0][i] + tonalVerb[0][i] * sc;
    out[1][i] = drumsVerb[1][i] + tonalVerb[1][i] * sc;
  }
  // Master low-pass automation + global pump.
  const mlpL = new Biquad();
  const mlpR = new Biquad();
  for (let i = 0; i < n + tail; i++) {
    const t = i / SR;
    const a = arr(Math.min(loop ? t % duration : t, duration - 1e-3));
    if (i % 64 === 0) {
      mlpL.set('lp', a.lp ?? 18000, 0.7);
      mlpR.set('lp', a.lp ?? 18000, 0.7);
    }
    const pump = a.pump ? 1 - a.pump * Math.exp(-(t % BEAT) / 0.12) : 1;
    const gate = a.mute ? 0 : 1;
    out[0][i] = mlpL.run(out[0][i]) * pump * gate;
    out[1][i] = mlpR.run(out[1][i]) * pump * gate;
  }
  if (!loop) return [out[0].subarray(0, n), out[1].subarray(0, n)];
  // Wrap the tail around so the loop point is seamless.
  for (let i = 0; i < tail; i++) {
    out[0][i] += out[0][n + i];
    out[1][i] += out[1][n + i];
  }
  return [out[0].slice(0, n), out[1].slice(0, n)];
}

/* ───────────── arrangements ───────────── */

const between = (t, a, b) => t >= a && t < b;

function mainArrangement(t) {
  const a = { kick: 0, clap: 0, hats: 0, ohat: 0, bass: 0, stabs: 0, pad: 0, arp: 0, roll: 0, lp: 18000, padLp: 900, pump: 0, mute: false };
  if (t < 0.5) return { ...a, mute: true };
  if (t < 3.0) {
    // Hook: tense pad, muffled heartbeat kick, ticking hats rising with the temperature.
    return { ...a, pad: 0.9, padLp: 500 + 500 * (t / 3), kick: t >= 1.0 ? 0.55 : 0, hats: t >= 1.0 ? 0.35 + 0.5 * ((t - 1) / 2) : 0, lp: 2600 + 2500 * (t / 3) };
  }
  if (t < 6.0) {
    // Turn: drums out, pad opens, snare roll builds, 1/4-beat of silence before the drop.
    if (t >= 5.75) return { ...a, mute: true };
    const build = clamp((t - 4.5) / 1.25, 0, 1);
    return { ...a, pad: 1, padLp: 700 + 2200 * clamp((t - 3) / 2.75, 0, 1), roll: t >= 4.5 ? 0.25 + 0.75 * build * build : 0, hats: 0.25, lp: 4000 + 12000 * build };
  }
  const full = { ...a, kick: 1, clap: 1, hats: 1, ohat: 1, bass: 1, stabs: 1, pad: 0.45, padLp: 1400 };
  if (t < 10.0) return { ...full, pump: t < 8.0 ? 0.28 : 0.12 };
  if (t < 16.0) return { ...full };
  if (t < 20.5) return { ...full, arp: 1 };
  if (t < 26.0) return { ...full, stabs: 0.6, clap: 0.8, arp: 0.5 };
  if (t < 29.0) return { ...full, arp: 1 };
  if (t < 33.0) {
    // Payoff: settle — kick drops out, filter closes, pad warms.
    const s = clamp((t - 29) / 2, 0, 1);
    return { ...a, pad: 1, padLp: 1100, bass: 0.7, hats: 0.35, stabs: 0.45, ohat: 0.4, lp: 9000 - 6500 * s };
  }
  if (t < 34.0) return { ...a, pad: 1.1, padLp: 1600 - 700 * (t - 33), lp: 5000 - 3000 * (t - 33) };
  return { ...a, mute: true };
}

const teaserArrangement = () => ({ kick: 1, clap: 1, hats: 1, ohat: 1, bass: 1, stabs: 1, pad: 0.45, padLp: 1400, arp: 0.6, roll: 0, lp: 18000, pump: 0, mute: false });

/* ───────────── SFX placement ───────────── */

const LEVEL = { impact: -6, riser: -9, whoosh: -10, click: -15, key: -14, soft: -18, typing: -17 };

/** Time of the transient: last point before the peak where the 5 ms envelope is below half of it. */
function hitPoint([L, R], from = 0, to = Infinity) {
  const w = 240;
  const env = [];
  for (let i = 0; i < L.length; i += w) {
    let s = 0;
    for (let j = i; j < Math.min(i + w, L.length); j++) s += L[j] * L[j] + R[j] * R[j];
    env.push(Math.sqrt(s / (2 * w)));
  }
  const i0 = Math.floor((from * SR) / w);
  const i1 = Math.min(env.length, Math.floor((to * SR) / w));
  let pk = i0;
  for (let i = i0; i < i1; i++) if (env[i] > env[pk]) pk = i;
  let k = pk;
  while (k > i0 && env[k] > env[pk] * 0.5) k--;
  return ((k + 1) * w) / SR;
}

/**
 * Places one SFX on `bus`.
 *  at:    timeline seconds where `align` (seconds into the processed clip) should land
 *  trim:  [start, end] seconds of the source to use
 *  semis: pitch shift by resampling; glide: [from, to] semitones across the clip
 *  lead:  shift earlier by one video frame (audio leads picture on impacts)
 */
function place(bus, file, o) {
  const src = decode(file);
  let [L, R] = src;
  const s0 = Math.round((o.trim?.[0] ?? 0) * SR);
  const s1 = Math.min(L.length, Math.round((o.trim?.[1] ?? L.length / SR) * SR));
  L = L.slice(s0, s1);
  R = R.slice(s0, s1);
  if (o.reverse) {
    L.reverse();
    R.reverse();
  }
  // Resample for pitch (constant or gliding).
  const g0 = o.glide ? o.glide[0] : (o.semis ?? 0);
  const g1 = o.glide ? o.glide[1] : (o.semis ?? 0);
  if (g0 !== 0 || g1 !== 0) {
    const outL = [];
    const outR = [];
    let p = 0;
    while (p < L.length - 1) {
      const frac = p / L.length;
      const rate = Math.pow(2, (g0 + (g1 - g0) * frac) / 12);
      const i = Math.floor(p);
      const f = p - i;
      outL.push(L[i] * (1 - f) + L[i + 1] * f);
      outR.push(R[i] * (1 - f) + R[i + 1] * f);
      p += rate;
    }
    L = Float32Array.from(outL);
    R = Float32Array.from(outR);
  }
  // Fades (5–10 ms minimum to avoid pops).
  const fi = Math.max(Math.round((o.fadeIn ?? 0.006) * SR), 240);
  const fo = Math.max(Math.round((o.fadeOut ?? 0.008) * SR), 384);
  for (let i = 0; i < fi && i < L.length; i++) {
    L[i] *= i / fi;
    R[i] *= i / fi;
  }
  for (let i = 0; i < fo && i < L.length; i++) {
    const k = L.length - 1 - i;
    L[k] *= i / fo;
    R[k] *= i / fo;
  }
  // Peak-normalize to the category level.
  let pk = 1e-9;
  for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const gain = db(LEVEL[o.kind] + (o.gain ?? 0)) / pk;
  // Clicks and keys line up on their own transient unless told otherwise.
  const align = o.align ?? (['key', 'click', 'soft'].includes(o.kind) ? hitPoint([L, R]) : 0);
  const start = Math.round((o.at - align - (o.lead ? FRAME : 0)) * SR);
  const n = bus[0].length;
  for (let i = 0; i < L.length; i++) {
    let j = start + i;
    if (o.loop) j = ((j % n) + n) % n;
    if (j < 0 || j >= n) continue;
    bus[0][j] += L[i] * gain;
    bus[1][j] += R[i] * gain;
  }
}

/** Prefers a full-quality .wav saved next to the Mixkit preview .mp3 with the same base name. */
const sfx = (name) => {
  const wav = path.join(SFX, name.replace(/\.mp3$/, '.wav'));
  return existsSync(wav) ? wav : path.join(SFX, name);
};
const key = (k) => path.join(KEYS, `keypress-${String(k).padStart(3, '0')}.wav`);

/** Hero-style keyboard presses (shared by the main cut and the teaser). */
function placePresses(small, offset, presses) {
  let f5 = 0;
  let f4 = 0;
  presses.forEach((p, i) => {
    const at = offset + p.t;
    place(small, key([3, 7, 11, 15, 19, 23, 27, 31][i % 8]), { at, kind: 'key', semis: (i % 3) - 1, trim: [0.005, 0.25] });
    if (p.percent === null) {
      place(small, sfx('ui-select-click.mp3'), { at, kind: 'click', gain: 2, trim: [0, 0.6] });
    } else if (p.keys.includes('F5')) {
      place(small, sfx('ui-modern-technology-select.mp3'), { at, kind: 'click', semis: f5++ });
    } else {
      place(small, sfx('ui-cool-interface-click-tone.mp3'), { at, kind: 'click', semis: -2 - f4++ });
    }
  });
}

/** RPM curve mirrored from HeroSequence.tsx so the whir tracks the on-screen counter. */
function heroRPM(cfg, t) {
  const AUTO = 3080;
  const rpmFor = (p) => TL.fanRange.minRPM + (p / 100) * (TL.fanRange.maxRPM - TL.fanRange.minRPM);
  const frame = Math.round(t * TL.fps);
  const pf = cfg.presses.map((p) => Math.round(p.t * TL.fps));
  let idx = -1;
  pf.forEach((x, i) => {
    if (x <= frame) idx = i;
  });
  const pct = (i) => (i < 0 ? (cfg.startAuto ? null : cfg.startPercent) : cfg.presses[i].percent);
  const rpmOf = (p) => (p === null ? AUTO : rpmFor(p));
  const since = idx < 0 ? 1e9 : (t * TL.fps - pf[idx]);
  const e = 1 - Math.pow(1 - clamp(since / 24, 0, 1), 3);
  return rpmOf(pct(idx - 1)) + (rpmOf(pct(idx)) - rpmOf(pct(idx - 1))) * e;
}

/** Filtered-noise fan whir whose brightness and level follow RPM. */
function fanWhir(bus, from, to, rpmAt, { fadeIn = 0.4, fadeOut = 0.4, level = -22, loop = false } = {}) {
  const lp = [new Biquad(), new Biquad()];
  const bp = [new Biquad(), new Biquad()];
  const s0 = Math.round(from * SR);
  const s1 = Math.round(to * SR);
  const tmp = stereo(s1 - s0);
  let hum = 0;
  for (let i = s0; i < s1; i++) {
    const t = i / SR;
    const rpm = rpmAt(t - from);
    const x = clamp((rpm - 2300) / (7800 - 2300), 0, 1);
    if ((i - s0) % 64 === 0) {
      for (const ch of [0, 1]) {
        lp[ch].set('lp', 380 + 4200 * Math.pow(x, 1.3), 0.6);
        bp[ch].set('bp', 700 + 2600 * x, 2.2);
      }
    }
    hum += ((rpm / 60) * 7) / SR;
    const amp = (0.28 + 0.72 * Math.pow(x, 1.4)) * (1 + 0.04 * Math.sin(t * 37));
    for (const ch of [0, 1]) {
      const nz = noise();
      tmp[ch][i - s0] = (lp[ch].run(nz) * 0.9 + bp[ch].run(nz) * 0.35 * x + Math.sin(2 * Math.PI * hum) * 0.025) * amp;
    }
  }
  // Normalize so the loudest stretch sits at `level` dBFS RMS, then fade.
  let peakRms = 1e-9;
  const w = 4800;
  for (let i = 0; i + w < tmp[0].length; i += w) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += tmp[0][j] * tmp[0][j];
    peakRms = Math.max(peakRms, Math.sqrt(s / w));
  }
  const g = db(level) / peakRms;
  const n = tmp[0].length;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fade = loop ? 1 : Math.min(1, t / fadeIn, (n / SR - t) / fadeOut);
    bus[0][s0 + i] += tmp[0][i] * g * fade;
    bus[1][s0 + i] += tmp[1][i] * g * fade;
  }
}

/* ───────────── mixdown ───────────── */

function envelopeFollower([L, R], attack = 0.005, release = 0.25) {
  const a = Math.exp(-1 / (attack * SR));
  const r = Math.exp(-1 / (release * SR));
  const env = new Float32Array(L.length);
  let e = 0;
  for (let i = 0; i < L.length; i++) {
    const x = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    e = x > e ? a * e + (1 - a) * x : r * e + (1 - r) * x;
    env[i] = e;
  }
  return env;
}

function limiter([L, R], ceiling = db(-1)) {
  const look = Math.round(0.003 * SR);
  const rel = Math.exp(-1 / (0.08 * SR));
  const n = L.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // Minimum over the look-ahead window.
  const gmin = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let j = i; j < Math.min(n, i + look); j++) m = Math.min(m, need[j]);
    gmin[i] = m;
  }
  let g = 1;
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    g = gmin[i] < g ? gmin[i] : rel * g + (1 - rel) * gmin[i];
    out[0][i] = L[i] * g;
    out[1][i] = R[i] * g;
  }
  return out;
}

function mixdown({ name, duration, music, big, small, whir, silence = [], loop = false }) {
  const n = Math.ceil(duration * SR);
  // Normalize the music bed to -14 LUFS.
  const stem = path.join(CACHE, `${name}-music.wav`);
  writeWav(stem, music);
  const { I } = measure(stem);
  const mg = db(-14 - I);
  console.log(`${name}: music bed ${I.toFixed(1)} LUFS → gain ${(-14 - I).toFixed(1)} dB`);

  // Duck the music up to 6 dB under anything bigger than a click.
  const env = envelopeFollower(big, 0.004, 0.22);
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    const ed = 20 * Math.log10(env[i] + 1e-9);
    const duck = db(-6 * clamp((ed + 38) / 14, 0, 1));
    for (const ch of [0, 1]) out[ch][i] = music[ch][i] * mg * duck + big[ch][i] + small[ch][i] + whir[ch][i];
  }
  for (const [a, b] of silence) {
    const i0 = Math.round(a * SR);
    const i1 = Math.round(b * SR);
    const ramp = 96; // 2 ms
    for (let i = i0 - ramp; i < i1 + ramp; i++) {
      if (i < 0 || i >= n) continue;
      const g = i < i0 ? (i0 - i) / ramp : i >= i1 ? (i - i1) / ramp : 0;
      out[0][i] *= g;
      out[1][i] *= g;
    }
  }
  writeWav(path.join(CACHE, `${name}-whir.wav`), whir);
  writeWav(path.join(CACHE, `${name}-sfx.wav`), [big[0].map((x, i) => x + small[0][i]), big[1].map((x, i) => x + small[1][i])]);
  const master = limiter(out, db(-1.2));
  const file = path.join(ROOT, 'public', `${name}.wav`);
  writeWav(file, master);
  const m = measure(file);
  console.log(`${name}: wrote ${path.relative(ROOT, file)}  integrated ${m.I} LUFS, true peak ${m.TP} dBFS${loop ? ' (loop)' : ''}`);
}

/* ───────────── main cut ───────────── */

function buildMain() {
  const D = TL.duration;
  const n = Math.ceil(D * SR);
  const big = stereo(n);
  const small = stereo(n);
  const whir = stereo(n);

  // Quick-zoom swells into two hits (0.41 s, 0.51 s); land the slam between them.
  const qzHit = 0.47;
  const deep = decode(sfx('impact-cinematic-whoosh-deep.mp3'));
  const deepHit = hitPoint(deep, 0.3, 0.7);
  const bombHit = hitPoint(decode(sfx('drop-bomb-impact.mp3')), 1.9, 2.2);
  console.log(`hit points: deep ${deepHit.toFixed(3)} s, bomb ${bombHit.toFixed(3)} s`);

  // 0:00 Hook
  place(big, sfx('impact-quick-zoom.mp3'), { at: TL.hook.title, align: qzHit, kind: 'impact', lead: true });
  place(big, sfx('riser-electricity-static-power-up.mp3'), { at: TL.hook.menubar - 0.2, kind: 'riser', glide: [0, 7], gain: -1 });
  place(big, sfx('whoosh-cinematic-stutter.mp3'), { at: TL.hook.line2a, align: 2.04, kind: 'whoosh', gain: 1 });
  // 0:03 Turn
  place(big, sfx('whoosh-cinematic-fast-transition.mp3'), { at: TL.scenes.turn[0], align: 1.07, kind: 'whoosh' });
  place(small, key(5), { at: TL.turn.fn, kind: 'key', gain: 3, trim: [0.02, 0.25] });
  place(small, key(9), { at: TL.turn.f5, kind: 'key', gain: 3, trim: [0.005, 0.25] });
  place(big, sfx('impact-quick-zoom.mp3'), { at: TL.turn.untilNow, align: qzHit, kind: 'impact', gain: -5, lead: true });
  // Reverse riser: only the tail of the file, ending exactly on the logo hit.
  place(big, sfx('riser-reverse-cinematic-impact.mp3'), { at: TL.reveal.icon, align: 1.0, trim: [8.955, 9.955], kind: 'riser', fadeIn: 0.15, fadeOut: 0.006, lead: true });
  // 0:06 Reveal
  place(big, sfx('impact-movie-logo-intro.mp3'), { at: TL.reveal.icon, trim: [4.05, 7.05], kind: 'impact', fadeIn: 0.005, fadeOut: 1.2, lead: true });
  place(big, sfx('drop-bomb-impact.mp3'), { at: TL.reveal.icon, align: 0.01, trim: [bombHit - 0.01, bombHit + 2.49], kind: 'impact', gain: -8, fadeOut: 0.6, lead: true });
  place(small, sfx('ui-modern-technology-select.mp3'), { at: TL.reveal.wordmark, kind: 'click', semis: -5, gain: 1 });
  place(small, sfx('ui-select-click.mp3'), { at: TL.reveal.subA, kind: 'soft', semis: -3, trim: [0, 0.5] });
  place(small, sfx('ui-select-click.mp3'), { at: TL.reveal.subB, kind: 'soft', semis: -1, trim: [0, 0.5] });
  // 0:10 Hero keyboard sequence
  place(big, sfx('whoosh-fast-transition.mp3'), { at: TL.scenes.hero[0], align: 0.72, kind: 'whoosh' });
  placePresses(small, TL.scenes.hero[0], TL.hero.presses);
  fanWhir(whir, TL.scenes.hero[0], TL.scenes.hero[1], (t) => heroRPM(TL.hero, t), { fadeIn: 0.5, fadeOut: 0.4 });
  // 0:16 Profiles
  place(big, sfx('whoosh-air.mp3'), { at: TL.profiles.title, align: 0.71, kind: 'whoosh' });
  TL.profiles.cuts.forEach((c, i) => {
    place(small, sfx('ui-interface-device-click.mp3'), { at: c, kind: 'click', semis: i, trim: [0, 0.4] });
    place(small, key(12 + i * 4), { at: c, kind: 'soft', semis: i - 1, trim: [0.005, 0.25] });
  });
  // 0:20.5 Curves
  place(big, sfx('whoosh-cinematic-fast-transition.mp3'), { at: TL.curves.flip, align: 1.07, kind: 'whoosh' });
  place(small, sfx('ui-modern-technology-select.mp3'), { at: TL.curves.text, kind: 'soft', semis: -5 });
  place(small, sfx('ui-mouse-click-close.mp3'), { at: TL.curves.grab, kind: 'click', trim: [0, 0.4] });
  place(small, sfx('ui-mouse-click-close.mp3'), { at: TL.curves.release, kind: 'click', semis: -2, trim: [0, 0.4] });
  // 0:26 Terminal + trust
  place(big, sfx('whoosh-fast-transition.mp3'), { at: TL.scenes.terminal[0], align: 0.72, kind: 'whoosh' });
  place(small, sfx('typing-laptop-keyboard.mp3'), { at: TL.terminal.typeStart, trim: [3.0, 3.0 + (TL.terminal.typeEnd - TL.terminal.typeStart)], kind: 'typing', fadeIn: 0.01, fadeOut: 0.01 });
  place(small, key(21), { at: TL.terminal.output - 0.04, kind: 'key', trim: [0.005, 0.25] });
  place(small, sfx('ui-modern-technology-select.mp3'), { at: TL.terminal.shield, kind: 'click', semis: 3 });
  TL.terminal.chips.forEach((c, i) => place(small, sfx('ui-select-click.mp3'), { at: c, kind: 'click', semis: [0, 2, -1][i], trim: [0, 0.5] }));
  // 0:29 Payoff
  const air = decode(sfx('whoosh-air.mp3'));
  place(big, sfx('whoosh-air.mp3'), { at: TL.scenes.payoff[0], align: air[0].length / SR - 0.71, reverse: true, kind: 'whoosh', gain: -1 });
  TL.payoff.words.forEach((w, i) => place(small, sfx('ui-cool-interface-click-tone.mp3'), { at: w, kind: 'soft', semis: [0, 2, 5][i], gain: 2 }));
  // 0:33 End card
  place(big, sfx('impact-cinematic-whoosh-deep.mp3'), { at: TL.scenes.end[0], align: deepHit, trim: [0, 1.5], kind: 'impact', fadeOut: 0.3, lead: true });
  place(small, sfx('ui-select-click.mp3'), { at: TL.end.tagline, kind: 'soft', trim: [0, 0.5] });
  place(small, sfx('ui-cool-interface-click-tone.mp3'), { at: TL.end.pulse, kind: 'click', gain: 4 });

  const music = existsSync(path.join(ROOT, 'audio/music.wav')) ? fitMusic(path.join(ROOT, 'audio/music.wav'), D) : synthMusic(D, mainArrangement);
  mixdown({ name: 'mix-main', duration: D, music, big, small, whir, silence: [[TL.end.silence, TL.end.pulse], [TL.end.black, D]] });
}

/* ───────────── teaser loop ───────────── */

function buildTeaser() {
  const D = TL.teaserDuration;
  const n = Math.ceil(D * SR);
  const big = stereo(n);
  const small = stereo(n);
  const whir = stereo(n);
  placePresses(small, 0, TL.teaser.presses);
  fanWhir(whir, 0, D, (t) => heroRPM(TL.teaser, t), { loop: true });
  const music = synthMusic(D, teaserArrangement, { loop: true });
  mixdown({ name: 'mix-teaser', duration: D, music, big, small, whir, loop: true });
}

/** Use a supplied music file instead of the synth: trimmed to length with a short fade-out. */
function fitMusic(file, D) {
  const [L, R] = decode(file);
  const n = Math.ceil(D * SR);
  const out = stereo(n);
  for (let i = 0; i < n && i < L.length; i++) {
    const fade = Math.min(1, (n - i) / (0.5 * SR));
    out[0][i] = L[i] * fade;
    out[1][i] = R[i] * fade;
  }
  return out;
}

buildMain();
buildTeaser();
