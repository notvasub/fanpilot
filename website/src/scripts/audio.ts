import { sim } from '../lib/sim';
import { FAN_RANGE } from '../lib/control';
import { $ } from './util';

/** A synthesized fan: filtered brown noise whose pitch and level follow the simulated RPM. Off by default. */
export function initFanSound() {
  const toggle = $('[data-sound]');
  if (!toggle) return;
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let band: BiquadFilterNode | null = null;
  let on = false;

  const build = () => {
    ctx = new AudioContext();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.6;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2600;
    gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(band).connect(low).connect(gain).connect(ctx.destination);
    src.start();
  };

  toggle.addEventListener('click', () => {
    on = !on;
    toggle.setAttribute('aria-checked', String(on));
    if (on && !ctx) build();
    if (ctx) on ? ctx.resume() : ctx.suspend();
  });

  sim.on('frame', () => {
    if (!on || !ctx || !gain || !band) return;
    const x = sim.averageRPM / FAN_RANGE.max;
    gain.gain.setTargetAtTime(Math.pow(x, 1.3) * 0.35, ctx.currentTime, 0.25);
    band.frequency.setTargetAtTime(220 + x * 1500, ctx.currentTime, 0.25);
  });
}
