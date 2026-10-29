// The computer opponent. It tests candidate shots with the real physics, scores the
// results with the real rules, then adds aim and power error for its level.
// Source: game_information/game_rules.md, section 8.
import { HUMAN, COMPUTER, MONEY, other } from '../data/config.js';
import { BUMPERS, HOLE, GATE_INDEX, PHYSICS } from '../data/tableLayout.js';
import {
  terikId, createShotTracker, onBumperHit, onDrop, finishShot, isHoleOpen, countOwned,
} from '../game/rules.js';
import { maxRaise } from '../game/betting.js';

export const LEVELS = {
  easy: {
    aimErrorDeg: 4.5, powerError: 0.22, sweepStepDeg: 0, powers: [0.35, 0.55, 0.8],
    pickFromTop: 5, defense: false,
  },
  medium: {
    aimErrorDeg: 1.4, powerError: 0.08, sweepStepDeg: 9, powers: [0.3, 0.55, 0.85],
    pickFromTop: 2, defense: false,
  },
  hard: {
    aimErrorDeg: 0.35, powerError: 0.03, sweepStepDeg: 5, powers: [0.25, 0.45, 0.65, 0.9],
    pickFromTop: 1, defense: true, refine: true,
  },
};

const gauss = (rng) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Plays one candidate shot in a copy of the world and scores it for the shooter.
export function evaluateShot(world, bumpers, shooter, angle, power, ctx = {}) {
  const w = world.clone();
  const bs = bumpers.slice();
  const t = createShotTracker(bs, shooter);
  w.strike(terikId(shooter), angle, power * PHYSICS.maxShotSpeed);
  w.simulate((e) => {
    if (e.type === 'bumper') onBumperHit(t, e.ballId, e.bumperIndex);
    else if (e.type === 'drop') {
      if (onDrop(t, e.ballId) === 'win') return false;
    }
    return true;
  });
  const outcome = finishShot(t);
  return { score: scoreOutcome(t, outcome, w, bs, shooter, ctx), outcome, tracker: t };
}

function scoreOutcome(t, outcome, w, bs, shooter, ctx) {
  const opp = other(shooter);
  if (outcome.type === 'win') return 1000;
  if (outcome.type === 'scratch') {
    // A desperate wipe can be worth it when the opponent is about to win a big pot.
    const oppThreat = bs !== null && ctx.oppThreatBefore;
    if (ctx.allowDeliberateScratch && oppThreat) return 60;
    return -300;
  }
  let s = 0;
  s += t.lit * 12 + t.stolen * 18;
  if (t.gateTaken) s += 30;
  if (isHoleOpen(bs, shooter)) s += 120;
  if (outcome.type === 'noBumperFirst') s -= 60;
  if (outcome.type === 'continue') s += 10;
  if (ctx.defense && outcome.type !== 'continue') {
    // Penalize leaving the opponent close to opening the hole.
    s -= countOwned(bs, opp) * 3;
    if (bs[GATE_INDEX] === opp) s -= 10;
    // Reward an obstacle ball between the opponent's terik and the gate bumper.
    const oppBall = w.getBall(terikId(opp));
    if (oppBall && oppBall.active) {
      const g = BUMPERS[GATE_INDEX];
      const a = Math.atan2(g.y - oppBall.y, g.x - oppBall.x);
      const cast = w.castBall(oppBall.id, a, Math.hypot(g.x - oppBall.x, g.y - oppBall.y) + 2);
      if (cast.hit && cast.hit.type !== 'bumper') s += 12;
    }
  }
  // Prefer leaving the own terik away from the hole when the hole is not open.
  const me = w.getBall(terikId(shooter));
  if (me && me.active && !isHoleOpen(bs, shooter)) {
    const dh = Math.hypot(me.x - HOLE.x, me.y - HOLE.y);
    if (dh < 6) s -= (6 - dh) * 3;
  }
  return s;
}

function candidateAngles(world, bumpers, shooter, level) {
  const me = world.getBall(terikId(shooter));
  const angles = [];
  const direct = (x, y) => Math.atan2(y - me.y, x - me.x);
  // Direct aims at every bumper and at the hole.
  BUMPERS.forEach((b, i) => {
    if (bumpers[i] !== shooter) {
      angles.push(direct(b.x, b.y));
      if (level !== LEVELS.easy) {
        // Glancing aims at either side of the bumper.
        angles.push(direct(b.x, b.y) + 0.06, direct(b.x, b.y) - 0.06);
      }
    }
  });
  if (isHoleOpen(bumpers, shooter)) {
    BUMPERS.forEach((b, i) => { if (bumpers[i] === shooter) angles.push(direct(b.x, b.y)); });
    angles.push(direct(HOLE.x, HOLE.y));
  }
  if (level.sweepStepDeg > 0) {
    for (let d = 0; d < 360; d += level.sweepStepDeg) angles.push((d * Math.PI) / 180);
  }
  return angles;
}

// Chooses a shot. Runs in small chunks so the page stays responsive.
// Returns { angle, power, planned } where planned is the expected outcome type.
export async function chooseShot(world, bumpers, shooter, levelName, opts = {}) {
  const level = LEVELS[levelName];
  const rng = opts.rng || Math.random;
  const opp = other(shooter);
  const ctx = {
    defense: level.defense,
    allowDeliberateScratch: levelName === 'hard' && (opts.pot || 0) >= 300,
    oppThreatBefore: countOwned(bumpers, opp) >= 5 && bumpers[GATE_INDEX] === opp,
  };
  const angles = candidateAngles(world, bumpers, shooter, level);
  const results = [];
  const yieldNow = opts.yieldEvery ? () => new Promise((r) => setTimeout(r, 0)) : null;
  let n = 0;
  for (const a of angles) {
    for (const p of level.powers) {
      const r = evaluateShot(world, bumpers, shooter, a, p, ctx);
      results.push({ angle: a, power: p, score: r.score, planned: r.outcome.type });
      if (yieldNow && ++n % opts.yieldEvery === 0) await yieldNow();
    }
  }
  results.sort((x, y) => y.score - x.score);

  if (level.refine && results.length) {
    const best = results[0];
    for (let da = -0.03; da <= 0.031; da += 0.01) {
      for (const dp of [-0.08, 0, 0.08]) {
        const p = Math.min(1, Math.max(0.1, best.power + dp));
        const r = evaluateShot(world, bumpers, shooter, best.angle + da, p, ctx);
        results.push({ angle: best.angle + da, power: p, score: r.score, planned: r.outcome.type });
      }
      if (yieldNow) await yieldNow();
    }
    results.sort((x, y) => y.score - x.score);
  }

  const pool = results.slice(0, Math.max(1, level.pickFromTop));
  const choice = pool[Math.floor(rng() * pool.length)];
  // Human-like error.
  const angle = choice.angle + (gauss(rng) * level.aimErrorDeg * Math.PI) / 180;
  const power = Math.min(1, Math.max(0.08, choice.power * (1 + gauss(rng) * level.powerError)));
  return { angle, power, planned: choice.planned, candidates: results.length };
}

// Position from the computer's point of view: positive means it is ahead.
function position(bumpers, me) {
  const opp = other(me);
  let p = countOwned(bumpers, me) - countOwned(bumpers, opp);
  if (isHoleOpen(bumpers, me)) p += 6;
  if (isHoleOpen(bumpers, opp)) p -= 6;
  return p;
}

// Before its shot, the computer may raise. Returns an amount (0 for no raise).
export function decideRaise(levelName, session, round, bumpers, rng = Math.random) {
  const max = maxRaise(session, round, COMPUTER);
  if (round.raisedThisTurn || max < MONEY.raiseStep) return 0;
  const step = MONEY.raiseStep;
  const clamp = (v) => Math.max(step, Math.min(max, Math.floor(v / step) * step));
  const pos = position(bumpers, COMPUTER);
  const open = isHoleOpen(bumpers, COMPUTER);
  if (levelName === 'easy') return rng() < 0.08 ? step : 0;
  if (levelName === 'medium') {
    if (open || pos >= 4) return clamp(rng() < 0.5 ? 50 : 100);
    return 0;
  }
  // hard
  if (open) return clamp(max);
  if (pos >= 3) return clamp(round.pot / 2);
  if (rng() < 0.15) return clamp(rng() < 0.5 ? 50 : 100); // bluff
  return 0;
}

// The human raised. Returns true to call, false to fold.
export function respondToRaise(levelName, session, round, bumpers, amount, rng = Math.random) {
  if (levelName === 'easy') return true;
  const pos = position(bumpers, COMPUTER);
  const humanOpen = isHoleOpen(bumpers, HUMAN);
  if (levelName === 'medium') {
    if (humanOpen && amount >= 100) return false;
    if (pos <= -5) return false;
    return true;
  }
  // hard: folds against a real threat, but calls bluffs more often.
  if (humanOpen && amount >= 100) return rng() < 0.3;
  if (pos <= -6 && amount >= round.pot / 2) return rng() < 0.5;
  return true;
}
