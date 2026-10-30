// Dom-jot rules: bumpers, the hole, wins and scratches. Pure JavaScript.
// Source: game_information/game_rules.md, sections 3 to 6.
import { RULES, other } from '../data/config.js';
import { GATE_INDEX } from '../data/tableLayout.js';

export const terikId = (player) => `terik-${player}`;

export function createBumpers() {
  return new Array(RULES.bumperCount).fill(null);
}

export function countOwned(bumpers, player) {
  let n = 0;
  for (const o of bumpers) if (o === player) n++;
  return n;
}

export function allLit(bumpers) {
  return bumpers.every((o) => o !== null);
}

// Section 5: all lit, at least 6 yours, and the gate bumper yours.
export function isHoleOpen(bumpers, player) {
  return allLit(bumpers)
    && countOwned(bumpers, player) >= RULES.minOwnedToOpen
    && bumpers[GATE_INDEX] === player;
}

export function holeOpenFor(bumpers) {
  for (const p of ['human', 'computer']) if (isHoleOpen(bumpers, p)) return p;
  return null;
}

// Tracks one shot. bumpers is changed in place as the shot plays out.
export function createShotTracker(bumpers, shooter) {
  return {
    bumpers,
    shooter,
    changed: 0,
    lit: 0,
    stolen: 0,
    gateTaken: false,
    terikTouchedBumper: false,
    lastTerikBumper: null,
    win: false,
    scratch: false,
    scratchLost: 0,
    dropped: [],
  };
}

// Section 4. Only the shooter's own terik lights or steals a bumper. Obstacle balls (and the
// opponent's terik) bounce off bumpers without changing them.
// Returns { index, from, to } if the bumper changed, else null.
export function onBumperHit(t, ballId, index) {
  if (t.win || t.scratch) return null;
  if (ballId !== terikId(t.shooter)) return null;
  t.terikTouchedBumper = true;
  t.lastTerikBumper = index;
  const from = t.bumpers[index];
  if (from === t.shooter) return null;
  t.bumpers[index] = t.shooter;
  t.changed++;
  if (from === null) t.lit++; else t.stolen++;
  if (index === GATE_INDEX) t.gateTaken = true;
  return { index, from, to: t.shooter };
}

// Sections 5 and 6. Returns 'win', 'scratch' or 'ignored'.
export function onDrop(t, ballId) {
  if (t.win) return 'ignored';
  t.dropped.push(ballId);
  // With the hole open for the shooter, sinking their own terik wins. No bumper is needed first.
  if (ballId === terikId(t.shooter) && !t.scratch && isHoleOpen(t.bumpers, t.shooter)) {
    t.win = true;
    return 'win';
  }
  if (!t.scratch) {
    // A scratch costs only the shooter: their own bumpers go dark. The opponent keeps theirs.
    t.scratch = true;
    t.scratchLost = 0;
    for (let i = 0; i < t.bumpers.length; i++) {
      if (t.bumpers[i] === t.shooter) { t.bumpers[i] = null; t.scratchLost++; }
    }
  }
  return 'scratch';
}

// After all balls stop. Returns { type, next } where type is one of
// 'win', 'scratch', 'continue', 'pass'.
export function finishShot(t) {
  if (t.win) return { type: 'win', next: null };
  if (t.scratch) return { type: 'scratch', next: other(t.shooter) };
  if (t.changed > 0) return { type: 'continue', next: t.shooter };
  return { type: 'pass', next: other(t.shooter) };
}

// Straight nines: the winner owned no bumpers when this turn began.
export function isStraightNines(ownedAtTurnStart) {
  return ownedAtTurnStart === 0;
}
