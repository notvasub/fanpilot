/** Fan-blade angle shared by the turn → reveal match cut (degrees, local frames). */
const PUSH = 120;
const TURN_END = 180;

const omegaTurn = (lf: number) => 1 + 27 * Math.pow(Math.max(0, lf - PUSH) / (TURN_END - PUSH), 2);
const omegaReveal = (r: number) => 27.5 * Math.exp(-r / 26) + 0.8;

export const spinTurn = (lf: number) => {
  let a = 0;
  for (let k = PUSH; k < lf; k++) a += omegaTurn(k);
  return a;
};

const TURN_TOTAL = spinTurn(TURN_END);

export const spinReveal = (r: number) => {
  let a = TURN_TOTAL;
  for (let k = 0; k < r; k++) a += omegaReveal(k);
  return a;
};
