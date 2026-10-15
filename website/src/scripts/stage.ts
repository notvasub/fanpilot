import { icons } from '../lib/icons';
import { $, $$, clamp, mmss, reducedMotion } from './util';

/** The keynote stage: lights that come on as you arrive, the film on the screen, its light on the room. */
export function initStage() {
  const stage = $('[data-stage]');
  const video = $<HTMLVideoElement>('[data-film]');
  if (!stage || !video) return;
  const screen = $('[data-screen]', stage)!;
  const wrap = $('[data-screenwrap]', stage)!;
  const playBtn = $('[data-film-play]', stage)!;
  const controls = $('[data-film-controls]', stage)!;
  const toggle = $('[data-film-toggle]', stage)!;
  const time = $('[data-film-time]', stage);
  const scrub = $<HTMLInputElement>('[data-film-scrub]', stage)!;
  const mute = $('[data-film-mute]', stage)!;
  const full = $('[data-film-full]', stage)!;
  const lamps = $$('[data-lamp]', stage);
  const chapters = $$<HTMLButtonElement>('[data-chapter]');
  const ambi = $<HTMLCanvasElement>('[data-ambi]', stage)!;
  const reflect = $<HTMLCanvasElement>('[data-reflect]', stage)!;
  const phones = $$<HTMLCanvasElement>('[data-phone] canvas', stage);
  const reduce = reducedMotion();

  let mode: 'teaser' | 'main' = 'teaser';
  let inView = false;
  const duration = Number(scrub.max);

  /* Teaser loop plays silently on the screen while the stage is in view. */
  const ensureTeaser = () => {
    if (mode !== 'teaser' || reduce) return;
    if (!video.src) video.src = video.dataset.teaser!;
    if (inView) video.play().catch(() => {});
    else video.pause();
  };
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      ensureTeaser();
      if (!inView && mode === 'main' && !video.paused) video.pause();
    },
    { threshold: 0.25 },
  ).observe(screen);

  const startMain = (at = 0) => {
    if (mode !== 'main') {
      mode = 'main';
      video.src = video.dataset.main!;
      video.loop = false;
      video.muted = false;
      video.removeAttribute('poster');
    }
    playBtn.hidden = true;
    controls.hidden = false;
    const go = () => {
      video.currentTime = at;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    };
    if (video.readyState >= 1) go();
    else video.addEventListener('loadedmetadata', go, { once: true });
  };

  playBtn.addEventListener('click', () => startMain(0));
  toggle.addEventListener('click', () => (video.paused ? video.play() : video.pause()));
  screen.addEventListener('click', (e) => {
    if (mode !== 'main') return;
    if ((e.target as HTMLElement).closest('[data-film-controls]')) return;
    video.paused ? video.play() : video.pause();
  });
  scrub.addEventListener('input', () => {
    video.currentTime = Number(scrub.value);
  });
  mute.addEventListener('click', () => {
    video.muted = !video.muted;
  });
  full.addEventListener('click', () => {
    const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (screen.requestFullscreen) screen.requestFullscreen().catch(() => {});
    else v.webkitEnterFullscreen?.();
  });
  chapters.forEach((b) => b.addEventListener('click', () => startMain(Number(b.dataset.chapter))));

  const syncButtons = () => {
    toggle.innerHTML = `<span class="icon">${video.paused ? icons.play : icons.pause}</span>`;
    toggle.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
    mute.innerHTML = `<span class="icon">${video.muted ? icons.mute : icons.volume}</span>`;
    mute.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
    const playing = mode === 'main' && !video.paused;
    stage.style.setProperty('--playing', playing ? '1' : '0');
    stage.style.setProperty('--house', playing ? '0.28' : '1');
  };
  ['play', 'pause', 'volumechange'].forEach((ev) => video.addEventListener(ev, syncButtons));
  video.addEventListener('timeupdate', () => {
    if (mode !== 'main') return;
    const t = video.currentTime;
    if (time) time.textContent = `${mmss(t)} / ${mmss(duration)}`;
    scrub.value = String(t);
    scrub.style.setProperty('--fill', `${(t / duration) * 100}%`);
    let current = chapters[0];
    for (const c of chapters) if (Number(c.dataset.chapter) <= t + 0.01) current = c;
    chapters.forEach((c) => c.setAttribute('aria-current', String(c === current)));
  });
  video.addEventListener('ended', () => {
    playBtn.hidden = false;
    const label = playBtn.querySelector('b');
    if (label) label.textContent = 'Play again';
    controls.hidden = true;
    syncButtons();
  });

  /* Hide the control bar while the film plays and the pointer rests. */
  let idle = 0;
  const wake = () => {
    screen.classList.remove('is-idle');
    window.clearTimeout(idle);
    idle = window.setTimeout(() => {
      if (!video.paused) screen.classList.add('is-idle');
    }, 2200);
  };
  screen.addEventListener('pointermove', wake);
  video.addEventListener('play', wake);
  video.addEventListener('pause', () => screen.classList.remove('is-idle'));

  /* Light the room from the screen: ambient spill, floor reflection, two phones held up. */
  const actx = ambi.getContext('2d', { willReadFrequently: false })!;
  const rctx = reflect.getContext('2d')!;
  const pctx = phones.map((c) => c.getContext('2d')!);
  let last = 0;
  const paint = (now: number) => {
    requestAnimationFrame(paint);
    if (!inView || video.readyState < 2 || now - last < 66) return;
    last = now;
    try {
      actx.drawImage(video, 0, 0, ambi.width, ambi.height);
      rctx.drawImage(video, 0, 0, reflect.width, reflect.height);
      pctx.forEach((c, i) => c.drawImage(video, 0, 0, phones[i].width, phones[i].height));
    } catch {
      /* Frame not ready. */
    }
  };
  requestAnimationFrame(paint);
  // Poster frame lights the room before anything plays.
  const poster = new Image();
  poster.src = '/media/poster.jpg';
  poster.onload = () => {
    actx.drawImage(poster, 0, 0, ambi.width, ambi.height);
    rctx.drawImage(poster, 0, 0, reflect.width, reflect.height);
    pctx.forEach((c, i) => c.drawImage(poster, 0, 0, phones[i].width, phones[i].height));
  };

  /* Scroll: lamps switch on one by one, the screen tips up to face you. */
  const flicker = lamps.map(() => Math.random());
  const onScroll = () => {
    const r = stage.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = clamp((vh - r.top) / (vh + r.height * 0.5));
    let lit = 0;
    lamps.forEach((lamp, i) => {
      let on = reduce ? 1 : clamp((p - 0.14 - i * 0.04) / 0.07);
      if (on > 0 && on < 1 && !reduce) on *= 0.55 + 0.45 * Math.abs(Math.sin((p * 90 + flicker[i] * 7) * (i + 1)));
      lit += on;
      lamp.style.setProperty('--on', on.toFixed(3));
    });
    stage.style.setProperty('--lit', (lit / lamps.length).toFixed(3));
    const settle = reduce ? 1 : clamp((p - 0.05) / 0.35);
    wrap.style.setProperty('--stage-tilt', `${((1 - settle) * 16).toFixed(2)}deg`);
    wrap.style.setProperty('--stage-scale', (0.9 + settle * 0.1).toFixed(3));
  };
  window.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  syncButtons();
}
