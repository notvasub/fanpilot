// Prints duration, first onset (>-30 dBFS), and peak time of each SFX file.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const SFX = path.resolve(import.meta.dirname, '../../assets/sfx');
const files = [
  ...readdirSync(SFX).filter((f) => f.endsWith('.mp3')),
  ...readdirSync(path.join(SFX, 'keyboard-pack/single-keys')).slice(0, 6).map((f) => 'keyboard-pack/single-keys/' + f),
];
for (const f of files) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(SFX, f), '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const win = 480; // 10 ms
  let peak = 0, peakT = 0, onset = -1;
  const env = [];
  for (let i = 0; i < x.length; i += win) {
    let s = 0;
    for (let j = i; j < Math.min(i + win, x.length); j++) s += x[j] * x[j];
    const rms = Math.sqrt(s / win);
    env.push(rms);
    if (rms > peak) { peak = rms; peakT = i / 48000; }
    if (onset < 0 && 20 * Math.log10(rms + 1e-9) > -30) onset = i / 48000;
  }
  // coarse envelope (dB per 250ms) for long files
  const coarse = [];
  for (let k = 0; k < env.length; k += 25) coarse.push(Math.round(20 * Math.log10(Math.max(...env.slice(k, k + 25)) + 1e-9)));
  console.log(`${f.padEnd(52)} dur=${(x.length / 48000).toFixed(2)}s onset=${onset.toFixed(2)} peak@${peakT.toFixed(2)} (${(20 * Math.log10(peak)).toFixed(1)} dB rms)  env250ms=[${coarse.join(',')}]`);
}
