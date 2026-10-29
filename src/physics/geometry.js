// 2D geometry helpers. Points are [x, y] arrays or {x, y} objects as noted.

export function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy };
}

export function distToSegment(px, py, ax, ay, bx, by) {
  const c = closestPointOnSegment(px, py, ax, ay, bx, by);
  return Math.hypot(px - c.x, py - c.y);
}

// poly: array of [x, y]
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

// Offset a simple polygon outward by d (negative d moves inward). Mitered corners.
export function offsetPolygon(poly, d) {
  const ccw = signedArea(poly) > 0;
  const n = poly.length;
  const normals = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const len = Math.hypot(x2 - x1, y2 - y1);
    let nx = (y2 - y1) / len;
    let ny = -(x2 - x1) / len;
    if (!ccw) { nx = -nx; ny = -ny; }
    normals.push([nx, ny]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const [n1x, n1y] = normals[(i - 1 + n) % n];
    const [n2x, n2y] = normals[i];
    let mx = n1x + n2x;
    let my = n1y + n2y;
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml; my /= ml;
    const cos = mx * n2x + my * n2y;
    const len = Math.min(Math.abs(d / (cos || 1)), Math.abs(d) * 3) * Math.sign(d);
    out.push([poly[i][0] + mx * len, poly[i][1] + my * len]);
  }
  return out;
}

// Points along an arc. Angles in degrees.
export function arcPoints(cx, cy, r, a0, a1, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
