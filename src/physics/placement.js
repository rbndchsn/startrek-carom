// Random obstacle placement and finding free spots for returning balls.
import {
  BALL_RADIUS as R, OUTLINE, HOLE, BUMPERS, BUMPER_RADIUS, START_SPOTS,
} from '../data/tableLayout.js';
import { pointInPolygon, closestPointOnSegment } from './geometry.js';
import { SEGMENTS } from './physics.js';

const GAP = 0.8;

// Checks a spot for a ball. others: array of {x, y} for balls already placed.
// ignoreStartSpots: true when placing a terik back on its own start spot.
export function isValidSpot(x, y, others, { ignoreStartSpots = false, holeGap = 6, startGap = 5 } = {}) {
  if (!pointInPolygon(x, y, OUTLINE)) return false;
  for (const sg of SEGMENTS) {
    const c = closestPointOnSegment(x, y, sg.ax, sg.ay, sg.bx, sg.by);
    if (Math.hypot(x - c.x, y - c.y) < R + sg.radius + GAP) return false;
  }
  for (const b of BUMPERS) {
    if (Math.hypot(x - b.x, y - b.y) < R + BUMPER_RADIUS + GAP) return false;
  }
  if (Math.hypot(x - HOLE.x, y - HOLE.y) < holeGap) return false;
  if (!ignoreStartSpots) {
    for (const s of Object.values(START_SPOTS)) {
      if (Math.hypot(x - s.x, y - s.y) < startGap) return false;
    }
  }
  for (const o of others) {
    if (Math.hypot(x - o.x, y - o.y) < 2 * R + 0.5) return false;
  }
  return true;
}

const BOUNDS = (() => {
  const xs = OUTLINE.map((p) => p[0]);
  const ys = OUTLINE.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
})();

// Random positions for n obstacle balls.
export function randomObstaclePositions(n, rng = Math.random, occupied = []) {
  const placed = [];
  let tries = 0;
  while (placed.length < n) {
    if (++tries > 20000) throw new Error('Could not place obstacle balls');
    const x = BOUNDS.minX + rng() * (BOUNDS.maxX - BOUNDS.minX);
    const y = BOUNDS.minY + rng() * (BOUNDS.maxY - BOUNDS.minY);
    if (isValidSpot(x, y, [...occupied, ...placed])) placed.push({ x, y });
  }
  return placed;
}

// The given spot if free, otherwise the nearest free spot around it.
export function nearestFreeSpot(x, y, others, opts = {}) {
  const o = { holeGap: 4, startGap: 0, ignoreStartSpots: true, ...opts };
  if (isValidSpot(x, y, others, o)) return { x, y };
  for (let r = 0.5; r < 60; r += 0.5) {
    for (let a = 0; a < 360; a += 10) {
      const px = x + r * Math.cos((a * Math.PI) / 180);
      const py = y + r * Math.sin((a * Math.PI) / 180);
      if (isValidSpot(px, py, others, o)) return { x: px, y: py };
    }
  }
  return { x, y };
}
