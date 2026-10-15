# FanPilot launch video prompt

Paste everything inside the fenced block into your video tool / agent. SFX files live in `assets/sfx/` (see `assets/sfx/CREDITS.md`).

```
Create a 35-second, 16:9 (1920x1080, 60fps) fast-paced startup launch video for "FanPilot", a native macOS menu-bar app that lets Apple Silicon Mac users control their fans with keyboard shortcuts and smart profiles.

STYLE
Think Linear / Raycast / Arc launch videos. Dark, premium, high-contrast. Near-black background (#0A0A0B), one hot accent that shifts from cool cyan (#38BDF8) to hot orange (#FF6A3D) as temperatures rise. Typeface: Inter or SF Pro, heavy weights, tight tracking. Kinetic typography: words slam in on the beat with slight overshoot, 6-12 frame holds, hard cuts or fast whip-pans, no slow fades. Subtle film grain, soft glow on the accent, shallow depth-of-field on macOS UI mockups. macOS-native look: translucent vibrancy panels, SF Symbols-style icons, rounded 12px corners, real menu-bar proportions.

MUSIC
Driving electronic/lo-fi-house instrumental, ~124 BPM (1 beat = 0.484s = ~29 frames at 60fps). Every cut lands on a beat. Duck the music 6 dB under any SFX hit larger than a click, and sidechain-pump it slightly on the logo drop.

SOUND DESIGN (use the provided files in assets/sfx/, do not synthesize replacements unless noted)
Mix rule: music -14 LUFS bed, SFX peak around -6 dB, clicks quieter than whooshes, whooshes quieter than impacts. Pitch-vary repeated clicks +/-3 semitones so they do not machine-gun. Apply 5-10 ms fades on every trimmed SFX to avoid pops.

Cue sheet (time -> file -> note)
  0:00.0  impact-quick-zoom.mp3                       Title slam "Your Mac runs hot."
  0:01.0  riser-electricity-static-power-up.mp3       Under the temp climb 48 -> 92 deg, pitch up with the number
  0:02.4  whoosh-cinematic-stutter.mp3                Line 2 text hit "And you can't do anything about it."
  0:03.0  whoosh-cinematic-fast-transition.mp3        Hard cut to keyboard close-up
  0:03.5  keyboard-pack/single-keys/keypress-0xx.wav  One fn key press, one F5 key press (two different files)
  0:05.0  riser-reverse-cinematic-impact.mp3          Use ONLY the last 4.5 s of the file, so its peak lands exactly on the logo reveal
  0:06.0  impact-movie-logo-intro.mp3                 Logo reveal bass drop. Fade tail out by 0:09.
  0:06.0  drop-bomb-impact.mp3                        Layer under logo hit at -8 dB for sub-bass weight, trim to first 2.5 s
  0:10.0  whoosh-fast-transition.mp3                  Cut into hero keyboard sequence
  0:10.5  ui-modern-technology-select.mp3             HUD tick, one per fn+F5 press (x4 across 10.5-14.0, pitch +1 semitone each press)
  0:10.5  keypress-0xx.wav                            Real key clack on every press, synced to the HUD pop (use 4 different files)
  0:13.5  ui-cool-interface-click-tone.mp3            fn+F4 "slower" press, pitch down 2 semitones
  0:15.0  ui-select-click.mp3                         fn+Shift+F4 "Automatic" confirmation
  0:16.0  whoosh-air.mp3                              Profiles montage start
  0:16.5  ui-interface-device-click.mp3               Quiet / Balanced / Performance / Full Speed, one per cut, x4 with +1 semitone steps
  0:20.5  whoosh-cinematic-fast-transition.mp3        Card-flip into curve editor
  0:21.5  ui-mouse-click-close.mp3                    Grab curve point, release on 0:24
  0:26.0  whoosh-fast-transition.mp3                  Cut to terminal
  0:26.2  typing-laptop-keyboard.mp3                  Trim to ~2.5 s while `$ fanctl temps` types on
  0:27.5  ui-select-click.mp3 x3                      One per trust chip pop-in ("Returns to auto on quit." etc.), 0.2 s apart
  0:29.0  whoosh-air.mp3                              Pull back to desktop, reverse it for a "settling" feel
  0:33.0  impact-cinematic-whoosh-deep.mp3            End card, trimmed to first 1.5 s
  0:34.0  (silence)                                   Hard 4-frame silence before last logo pulse, then ui-cool-interface-click-tone.mp3 on the final pulse

Fan whir (no file provided): synthesize a filtered-noise loop whose pitch and volume are driven by the on-screen RPM value. Low (2,300 RPM) = soft air hiss, high (7,800 RPM) = bright rushing roar. Fade it in during the hero sequence, out at 0:16. Keep it at -22 dB so it does not mask clicks.

STRUCTURE (cuts on beat)

0:00-0:03  HOOK
Black screen. Text slams in: "Your Mac runs hot." Cut: a MacBook menu bar, CPU temp climbing 48 -> 92 degrees, the number turning orange, a fan icon barely moving. Text: "And you can't do anything about it."

0:03-0:06  THE TURN
Hard cut to extreme close-up of a keyboard, the fn and F5 keys lit by a soft light. Text: "Until now."

0:06-0:10  REVEAL
Bass drop. App icon (a stylised fan blade in a rounded squircle, cyan -> orange gradient) scales in with a glow. Wordmark "FanPilot" slams in. Subline: "Fan control for Apple Silicon. On your keyboard."

0:10-0:16  HERO FEATURE: KEYBOARD CONTROL
One key press per beat:
- Finger presses fn+F5 -> a translucent HUD pops center-screen: "Fans 40% -> 50%" with a segmented bar filling. Fan icon spins faster. RPM counter ticks 3,200 -> 4,100.
- fn+F5 again, again -> HUD 60%, 70%, bar turning orange, RPM roaring up.
- fn+F4 -> bar drains back, color cools to cyan. Text overlay: "SLOWER." / "FASTER." slamming on alternate beats.
- fn+Shift+F4: HUD "Automatic". Text: "One key back to auto."

0:16-0:21  PROFILES
Rapid-fire montage of the profiles panel, 4 cuts at 1 per beat: Quiet, Balanced, Performance, Full Speed. Each gets a distinct accent tint and an icon. fn+Shift+F5 cycles them with a card-flip transition. Text: "Profiles for every mood."

0:21-0:26  TEMPERATURE CURVES
Screen-record style: user drags points on a temperature-to-fan-speed curve editor, the line glowing, a live temperature dot riding along it. Fan RPM readout tracks in real time. Text: "Draw the curve. Fans follow."

0:26-0:29  DEV FLEX + TRUST
Fast terminal type-on: `$ fanctl temps` -> clean list of sensor readings. Then a quick shield icon animation with three one-line chips popping in: "Returns to auto on quit." "Never below SMC minimum." "Signed helper, XPC-verified."

0:29-0:33  MENU BAR PAYOFF
Pull back to a full MacBook desktop. Temp now a calm cyan 54 degrees, fans humming at a quiet 40%. Text: "Cool. Quiet. Yours."

0:33-0:35  END CARD
Logo centered, tagline "FanPilot. Take the controls.", then a placeholder price/URL line (REPLACE: no pricing or domain exists in the repo). Final beat: logo pulses once with the accent glow, hard cut to black.

MOTION RULES
- Every scene under 3 seconds except the hero keyboard sequence.
- Use whip-pan, zoom-punch, and match-cut transitions (e.g. fan icon spin -> app icon spin).
- Numbers always count up/down, never pop in statically.
- Keep on-screen text to max 6 words per beat. Highlight one keyword per line in the accent color.
- UI mockups must look like a real macOS menu-bar app, not a generic dashboard.
- Every visual hit (text slam, HUD pop, cut) must have a matching SFX within +/-2 frames. Audio leads video by 1 frame on impacts for punch.

DELIVERABLES
Main 16:9 cut, plus a 9:16 vertical cut (same beats, re-framed) for X/TikTok/Reels, plus a 6-second looping teaser of just the keyboard HUD sequence (0:10-0:16 tightened, with its own SFX).
```

## Notes

- `drop-bomb-impact.mp3`, `riser-*`: Mixkit has no true bass-drop/riser category, these are the closest matches. Swap if you find better.
- Mixkit files are the site's 128 kbps preview MP3s. Pull WAVs from the Mixkit pages for the final master.
- Real fan whir not sourced. Synthesized from RPM is the better fit anyway.
