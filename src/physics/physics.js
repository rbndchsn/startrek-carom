// Ball physics on the table plane. Pure JavaScript, deterministic with a fixed step.
import {
  BALL_RADIUS as R, OUTLINE, HOLE, BUMPERS, BUMPER_RADIUS, WALLS, WALL_THICKNESS, PHYSICS as P,
} from '../data/tableLayout.js';
import { closestPointOnSegment, arcPoints } from './geometry.js';

// Static colliders, built once.
export const SEGMENTS = [];
for (let i = 0; i < OUTLINE.length; i++) {
  const [ax, ay] = OUTLINE[i];
  const [bx, by] = OUTLINE[(i + 1) % OUTLINE.length];
  SEGMENTS.push({ ax, ay, bx, by, radius: 0, e: P.restitutionRail, kind: 'rail' });
}
for (const w of WALLS) {
  const pts = arcPoints(w.cx, w.cy, w.r, w.a0, w.a1, 16);
  for (let i = 0; i < pts.length - 1; i++) {
    SEGMENTS.push({
      ax: pts[i][0], ay: pts[i][1], bx: pts[i + 1][0], by: pts[i + 1][1],
      radius: WALL_THICKNESS / 2, e: P.restitutionWall, kind: 'wall',
    });
  }
}

export class PhysicsWorld {
  constructor() {
    this.balls = [];
    this.time = 0;
  }

  addBall({ id, kind, owner = null, x, y }) {
    const ball = { id, kind, owner, x, y, vx: 0, vy: 0, active: true };
    this.balls.push(ball);
    return ball;
  }

  getBall(id) {
    return this.balls.find((b) => b.id === id);
  }

  clone() {
    const w = new PhysicsWorld();
    w.balls = this.balls.map((b) => ({ ...b }));
    w.time = this.time;
    return w;
  }

  strike(id, angle, speed) {
    const b = this.getBall(id);
    const s = Math.max(P.minShotSpeed, Math.min(P.maxShotSpeed, speed));
    b.vx = Math.cos(angle) * s;
    b.vy = Math.sin(angle) * s;
  }

  isMoving() {
    for (const b of this.balls) if (b.active && (b.vx !== 0 || b.vy !== 0)) return true;
    return false;
  }

  placeBall(id, x, y) {
    const b = this.getBall(id);
    b.x = x; b.y = y; b.vx = 0; b.vy = 0; b.active = true;
  }

  // Advance one fixed step. Pushes events into the events array.
  step(events) {
    const dt = P.dt;
    const balls = this.balls;

    // Move, friction, hole.
    for (const b of balls) {
      if (!b.active) continue;
      const hx = HOLE.x - b.x;
      const hy = HOLE.y - b.y;
      const dh = Math.hypot(hx, hy);
      let s = Math.hypot(b.vx, b.vy);
      if (s === 0) continue;
      // The rim only bends a rolling ball toward the hole. A ball at rest stays put.
      if (dh < HOLE.r && dh > 1e-6) {
        b.vx += (hx / dh) * P.holeLipPull * dt;
        b.vy += (hy / dh) * P.holeLipPull * dt;
        s = Math.hypot(b.vx, b.vy);
      }
      const ns = Math.max(0, s - P.friction * dt);
      if (ns < P.stopSpeed) {
        b.vx = 0; b.vy = 0;
        if (dh < P.holeCaptureRadius) {
          // Stopped over the opening: it falls in.
          b.active = false;
          events.push({ type: 'drop', ballId: b.id, time: this.time });
        }
        continue;
      }
      const k = Math.min(ns, P.maxBallSpeed) / s;
      b.vx *= k; b.vy *= k;
      s = ns;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const d2 = Math.hypot(HOLE.x - b.x, HOLE.y - b.y);
      if (d2 < P.holeCaptureRadius && s < P.holeCaptureMaxSpeed) {
        b.active = false;
        b.vx = 0; b.vy = 0;
        events.push({ type: 'drop', ballId: b.id, time: this.time });
      }
    }

    // Static collisions for moving balls.
    for (const b of balls) {
      if (!b.active || (b.vx === 0 && b.vy === 0)) continue;
      for (const sg of SEGMENTS) {
        const c = closestPointOnSegment(b.x, b.y, sg.ax, sg.ay, sg.bx, sg.by);
        const dx = b.x - c.x;
        const dy = b.y - c.y;
        const d = Math.hypot(dx, dy);
        const min = R + sg.radius;
        if (d < min && d > 1e-9) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = c.x + nx * min;
          b.y = c.y + ny * min;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= (1 + sg.e) * vn * nx;
            b.vy -= (1 + sg.e) * vn * ny;
            if (vn < -2) events.push({ type: sg.kind, ballId: b.id, speed: -vn, time: this.time });
          }
        }
      }
      for (let i = 0; i < BUMPERS.length; i++) {
        const bp = BUMPERS[i];
        const dx = b.x - bp.x;
        const dy = b.y - bp.y;
        const d = Math.hypot(dx, dy);
        const min = R + BUMPER_RADIUS;
        if (d < min && d > 1e-9) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = bp.x + nx * min;
          b.y = bp.y + ny * min;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < -0.05) {
            b.vx -= (1 + P.restitutionBumper) * vn * nx;
            b.vy -= (1 + P.restitutionBumper) * vn * ny;
            const kick = P.bumperKick * Math.min(1, -vn / 20);
            b.vx += nx * kick;
            b.vy += ny * kick;
            events.push({ type: 'bumper', ballId: b.id, bumperIndex: i, speed: -vn, time: this.time });
          }
        }
      }
    }

    // Ball to ball.
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (!a.active) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (!b.active) continue;
        if (a.vx === 0 && a.vy === 0 && b.vx === 0 && b.vy === 0) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 2 * R && d > 1e-9) {
          const nx = dx / d;
          const ny = dy / d;
          const overlap = 2 * R - d;
          a.x += nx * overlap / 2; a.y += ny * overlap / 2;
          b.x -= nx * overlap / 2; b.y -= ny * overlap / 2;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel < 0) {
            const jimp = (-(1 + P.restitutionBall) * rel) / 2;
            a.vx += jimp * nx; a.vy += jimp * ny;
            b.vx -= jimp * nx; b.vy -= jimp * ny;
            if (rel < -1) events.push({ type: 'ball', a: a.id, b: b.id, speed: -rel, time: this.time });
          }
        }
      }
    }

    this.time += dt;
  }

  // Run until everything stops. Calls onEvent for each event. Returns elapsed time.
  simulate(onEvent, maxTime = P.maxSimTime) {
    const start = this.time;
    const events = [];
    while (this.isMoving() && this.time - start < maxTime) {
      events.length = 0;
      this.step(events);
      for (const e of events) if (onEvent(e) === false) return this.time - start;
    }
    if (this.isMoving()) for (const b of this.balls) { b.vx = 0; b.vy = 0; }
    return this.time - start;
  }

  // Path of a ball fired from (x, y) at angle, until its first contact.
  // Returns { x, y, hit } where hit describes what it touches first.
  castBall(id, angle, maxDist = 260) {
    const self = this.getBall(id);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const stepLen = 0.08;
    let x = self.x;
    let y = self.y;
    for (let t = 0; t < maxDist; t += stepLen) {
      x = self.x + dx * t;
      y = self.y + dy * t;
      if (t > 0.3 && Math.hypot(HOLE.x - x, HOLE.y - y) < P.holeCaptureRadius) return { x, y, hit: { type: 'hole' } };
      for (const b of this.balls) {
        if (b === self || !b.active) continue;
        if (Math.hypot(b.x - x, b.y - y) < 2 * R) return { x, y, hit: { type: 'ball', id: b.id } };
      }
      for (let i = 0; i < BUMPERS.length; i++) {
        if (Math.hypot(BUMPERS[i].x - x, BUMPERS[i].y - y) < R + BUMPER_RADIUS) return { x, y, hit: { type: 'bumper', index: i } };
      }
      for (const sg of SEGMENTS) {
        const c = closestPointOnSegment(x, y, sg.ax, sg.ay, sg.bx, sg.by);
        if (Math.hypot(x - c.x, y - c.y) < R + sg.radius) return { x, y, hit: { type: sg.kind } };
      }
    }
    return { x, y, hit: null };
  }
}
