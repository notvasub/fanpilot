# FanPilot launch video

The launch video from [`assets/launch-video-prompt.md`](../assets/launch-video-prompt.md), built in code: [Remotion](https://www.remotion.dev) renders the picture, and `audio/mix.mjs` builds the soundtrack from the SFX in `assets/sfx/`.

| Output | Composition | Size |
|---|---|---|
| `out/fanpilot-launch-16x9.mp4` | `Main` | 1920×1080, 60 fps, 35 s |
| `out/fanpilot-launch-9x16.mp4` | `Vertical` | 1080×1920, 60 fps, 35 s |
| `out/fanpilot-teaser-loop-16x9.mp4` | `Teaser` | 1920×1080, 60 fps, 6 s seamless loop |
| `out/fanpilot-teaser-loop-9x16.mp4` | `TeaserVertical` | 1080×1920, 60 fps, 6 s seamless loop |

## Run

```bash
npm install
```

```bash
npm run audio
```

```bash
npm run studio
```

```bash
npm run render:main && npm run render:vertical && npm run render:teaser && npm run render:teaser-vertical
```

`npm run audio` writes `public/mix-main.wav` and `public/mix-teaser.wav`. Run it again after any timing change, before rendering.

## How it fits together

- `src/timeline.json` is the single source of timing. Scenes, key presses, text slams and the audio cue sheet all read from it, so a visual hit and its sound can't drift apart.
- `src/scenes/` holds one file per section of the prompt's structure. `HeroSequence.tsx` is shared by the hero section and the 6-second teaser.
- `src/components/Mac.tsx` holds the macOS mockups. The HUD, menu-bar item and menu panel mirror `HUD.swift`, `FanPilotApp.swift` and `MenuContentView.swift`, so the video shows what the app shows.
- `audio/mix.mjs` synthesizes the music bed, places each SFX on its transient (impacts lead picture by one frame), synthesizes the RPM-driven fan whir, ducks the music 6 dB under anything larger than a click, and limits the master to −1.2 dBFS. The music bed is normalized to −14 LUFS.

## Where it differs from the prompt

- **120 BPM, not ~124.** At 120 BPM one beat is exactly 0.5 s (30 frames), so every time on the cue sheet lands on a beat or half-beat. At 124 BPM most of them would fall between beats.
- **Music is synthesized** (lo-fi house in A minor). To use a licensed track instead, save it as `audio/music.wav` and run `npm run audio`. It is trimmed to 35 s with a short fade.
- **SFX alignment follows the files, not the round numbers.** The reverse riser uses its last 1 s so it starts at 0:05 and peaks on the logo at 0:06. `impact-movie-logo-intro.mp3` is a 4 s swell, so the reveal uses it from its climax at 4.05 s. `drop-bomb-impact.mp3` is cut at its explosion (2.0 s), not its start. The line-2 hit is at 0:02.5 rather than 0:02.4, to sit on the beat.
- **Real numbers.** RPMs use the fan range from the README (2,317–7,826 RPM), so 40% → 50% reads 4,521 → 5,072 RPM, not 3,200 → 4,100. The HUD title says `Manual 50%` and the menu-bar item shows RPM, as the app does.
- **Hero sequence:** fn F5 four times (50 → 80%), then fn F4 three times (back down to 50%) so the bar visibly cools to cyan, then fn ⇧F4 for Automatic.
- **Profiles** cut every 2 beats (1 s) rather than every beat, so each card can be read. They cycle in the app's real order, starting from Automatic.
- **Curve editor:** you drag the two handles of FanPilot's real curve model (a ramp from one temperature to another), not free-form points.
- **End card CTA** points at the GitHub repo. Change it in `END_CARD_CTA` in `src/scenes/EndCard.tsx`.
- The Mixkit files are 128 kbps previews. For the final master, download the WAVs from Mixkit (see `assets/sfx/CREDITS.md`), save each next to its MP3 with the same base name (`whoosh-air.wav` beside `whoosh-air.mp3`), and run `npm run audio` again. The mixer uses a WAV when it finds one.
