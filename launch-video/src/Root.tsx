import React from 'react';
import { AbsoluteFill, Audio, Composition, Sequence, staticFile } from 'remotion';
import { Grain } from './components/FX';
import { Curves } from './scenes/Curves';
import { EndCard } from './scenes/EndCard';
import { HeroSequence, type HeroConfig } from './scenes/HeroSequence';
import { Hook } from './scenes/Hook';
import { Payoff } from './scenes/Payoff';
import { Profiles } from './scenes/Profiles';
import { Reveal } from './scenes/Reveal';
import { Terminal } from './scenes/Terminal';
import { Turn } from './scenes/Turn';
import { Whip } from './components/FX';
import { C, T, f } from './theme';

const Hero: React.FC = () => (
  <Whip id="hero" duration={f(T.scenes.hero[1] - T.scenes.hero[0])} enter={1} frames={8}>
    <HeroSequence cfg={T.hero as HeroConfig} />
  </Whip>
);

const SCENES: Array<[keyof typeof T.scenes, React.FC]> = [
  ['hook', Hook],
  ['turn', Turn],
  ['reveal', Reveal],
  ['hero', Hero],
  ['profiles', Profiles],
  ['curves', Curves],
  ['terminal', Terminal],
  ['payoff', Payoff],
  ['end', EndCard],
];

const Main: React.FC<{ audio: string }> = ({ audio }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    {SCENES.map(([key, Scene]) => {
      const [a, b] = T.scenes[key];
      return (
        <Sequence key={key} from={f(a)} durationInFrames={f(b) - f(a)} name={key}>
          <Scene />
        </Sequence>
      );
    })}
    <Grain />
    <Audio src={staticFile(audio)} />
  </AbsoluteFill>
);

const Teaser: React.FC<{ audio: string }> = ({ audio }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <HeroSequence cfg={T.teaser as HeroConfig} loop />
    <Grain />
    <Audio src={staticFile(audio)} />
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Main" component={Main} width={1920} height={1080} fps={T.fps} durationInFrames={f(T.duration)} defaultProps={{ audio: 'mix-main.wav' }} />
    <Composition id="Vertical" component={Main} width={1080} height={1920} fps={T.fps} durationInFrames={f(T.duration)} defaultProps={{ audio: 'mix-main.wav' }} />
    <Composition id="Teaser" component={Teaser} width={1920} height={1080} fps={T.fps} durationInFrames={f(T.teaserDuration)} defaultProps={{ audio: 'mix-teaser.wav' }} />
    <Composition id="TeaserVertical" component={Teaser} width={1080} height={1920} fps={T.fps} durationInFrames={f(T.teaserDuration)} defaultProps={{ audio: 'mix-teaser.wav' }} />
  </>
);
