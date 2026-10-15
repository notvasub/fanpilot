import { startSim } from '../lib/sim';
import { initBindings, initCopy, initHud, initKeys, initLoadControls, initNav, initSpeedReadout, initSpinners } from './core';
import { initHistory, initPanel } from './panel';
import { initStage } from './stage';
import { initProfiles } from './profiles';
import { initCurves } from './curves';
import { initSafety } from './safety';
import { initMotion } from './motion';
import { initFanSound } from './audio';

const parts = [
  initBindings,
  initSpinners,
  initHud,
  initKeys,
  initLoadControls,
  initNav,
  initCopy,
  initSpeedReadout,
  initPanel,
  initHistory,
  initFanSound,
  initStage,
  initProfiles,
  initCurves,
  initSafety,
  initMotion,
];
for (const init of parts) {
  try {
    init();
  } catch (err) {
    console.error(`[fanpilot] ${init.name} failed`, err);
  }
}
startSim();
