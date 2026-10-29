/**
 * Race tracks: a closed loop of ice, generated from a seed.
 *
 * How a track is made (F1 style: straights, corners of all kinds, chicanes):
 * 1. Pick 11–15 corner points around a circle, each at a random distance from
 *    the middle, so the loop turns both ways.
 * 2. On up to two long straights, add a chicane (a quick left-right or a jog).
 * 3. Join the corners with straights and round each corner off with an arc of
 *    its own radius, from tight hairpins to fast sweepers.
 * 3b. Scale it so the loop has the wanted length, and resample it into points
 *    about 1 m apart along the middle line.
 * 4. Reject it and try the next seed if a bend is too tight for the track's
 *    width, or two parts of the loop come too close to each other.
 * 5. Rotate the loop so the start line sits at the start of its straightest
 *    stretch, with room for the starting grid behind it.
 *
 * The middle line runs counter-clockwise; the start line is at point 0.
 */

export interface TrackPoint {
  x: number;
  z: number;
}

export interface Track {
  seed: number;
  /** Middle line, about 1 m apart; the loop closes from the last point back to the first. */
  points: TrackPoint[];
  /** Distance along the middle line at each point (0 at the start line). */
  along: number[];
  length: number;
  halfWidth: number;
  /** Farthest any part of the track reaches from (0, 0); used for bounds. */
  bound: number;
}

export interface TrackSpot {
  index: number;
  /** Distance from the middle line. */
  offset: number;
  /** Unit direction from the middle line out to the spot (zero on the line). */
  outX: number;
  outZ: number;
}

function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points evenly spaced along a closed polyline. */
function resample(line: TrackPoint[], count: number): TrackPoint[] {
  const n = line.length;
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = line[i]!;
    const b = line[(i + 1) % n]!;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    seg.push(d);
    total += d;
  }
  const out: TrackPoint[] = [];
  let i = 0;
  let walked = 0;
  for (let k = 0; k < count; k++) {
    const want = (k / count) * total;
    while (walked + seg[i]! < want && i < n - 1) {
      walked += seg[i]!;
      i++;
    }
    const a = line[i]!;
    const b = line[(i + 1) % n]!;
    const t = seg[i]! > 0 ? (want - walked) / seg[i]! : 0;
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return out;
}

function loopLength(line: TrackPoint[]): number {
  let total = 0;
  for (let i = 0; i < line.length; i++) {
    const a = line[i]!;
    const b = line[(i + 1) % line.length]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

/** Direction of travel at point i (radians). */
export function trackHeading(track: Track, i: number): number {
  const n = track.points.length;
  const a = track.points[(i - 1 + n) % n]!;
  const b = track.points[(i + 1) % n]!;
  return Math.atan2(b.z - a.z, b.x - a.x);
}

function tryTrack(seed: number, length: number, width: number): Track | null {
  const random = makeRandom(seed);
  const halfWidth = width / 2;

  // 1. Corners: points around a circle at random distances from the middle,
  //    so the loop turns both ways (some corners bend inward).
  const count = 11 + Math.floor(random() * 5);
  let corners: TrackPoint[] = [];
  for (let i = 0; i < count; i++) {
    const a = ((i + (random() - 0.5) * 0.6) / count) * Math.PI * 2;
    const r = 0.25 + random() * 0.75;
    corners.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  // Scale so the corner-to-corner loop is about the wanted length.
  const raw = loopLength(corners);
  corners = corners.map((p) => ({ x: (p.x * length) / raw, z: (p.z * length) / raw }));

  // 2. Chicanes: on up to two long straights, add a quick left-right (or a jog).
  const withChicanes: TrackPoint[] = [];
  let chicanes = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    withChicanes.push(a);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (chicanes < 2 && len > width * 4 && random() < 0.7) {
      chicanes++;
      const nx = -(b.z - a.z) / len;
      const nz = (b.x - a.x) / len;
      const o1 = width * (1 + random() * 0.6) * (random() < 0.5 ? 1 : -1);
      const o2 = random() < 0.5 ? -o1 : o1;
      for (const [t, o] of [[0.38, o1], [0.62, o2]] as const) {
        withChicanes.push({ x: a.x + (b.x - a.x) * t + nx * o, z: a.z + (b.z - a.z) * t + nz * o });
      }
    }
  }
  corners = withChicanes;

  // 3. Straights between the corners, each corner rounded off with an arc of
  //    its own radius (tight hairpins to fast sweepers), as far as the
  //    straights on either side leave room for.
  const minRadius = halfWidth * 1.3;
  const smooth: TrackPoint[] = [];
  const m = corners.length;
  for (let i = 0; i < m; i++) {
    const p = corners[(i - 1 + m) % m]!;
    const v = corners[i]!;
    const nxt = corners[(i + 1) % m]!;
    const l1 = Math.hypot(v.x - p.x, v.z - p.z);
    const l2 = Math.hypot(nxt.x - v.x, nxt.z - v.z);
    const d1x = (v.x - p.x) / l1;
    const d1z = (v.z - p.z) / l1;
    const d2x = (nxt.x - v.x) / l2;
    const d2z = (nxt.z - v.z) / l2;
    const cross = d1x * d2z - d1z * d2x;
    const turn = Math.acos(Math.max(-1, Math.min(1, d1x * d2x + d1z * d2z)));
    if (turn < 0.05) {
      smooth.push(v);
      continue;
    }
    if (turn > 2.8) return null; // nearly turning back on itself
    // Mostly tight corners, now and then a fast sweeper.
    let radius = minRadius * (1 + random() * random() * 3);
    let tangent = radius * Math.tan(turn / 2);
    const room = 0.48 * Math.min(l1, l2);
    if (tangent > room) {
      tangent = room;
      radius = tangent / Math.tan(turn / 2);
    }
    const ax = v.x - d1x * tangent;
    const az = v.z - d1z * tangent;
    const side = cross > 0 ? 1 : -1;
    const cx = ax - d1z * radius * side;
    const cz = az + d1x * radius * side;
    const start = Math.atan2(az - cz, ax - cx);
    const steps = Math.max(2, Math.ceil((turn * radius) / 1.5));
    for (let k = 0; k <= steps; k++) {
      const ang = start + side * turn * (k / steps);
      smooth.push({ x: cx + Math.cos(ang) * radius, z: cz + Math.sin(ang) * radius });
    }
  }
  const scale = length / loopLength(smooth);
  const scaled = smooth.map((p) => ({ x: p.x * scale, z: p.z * scale }));
  const n = Math.max(60, Math.round(length));
  let points = resample(scaled, n);
  const step = loopLength(points) / n;

  // Tight bends: the turning radius must stay well above half the width,
  // or the inner edge of the bend folds over itself.
  const look = Math.max(2, Math.round(3 / step));
  const curvature: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i - look + n) % n]!;
    const b = points[i]!;
    const c = points[(i + look) % n]!;
    const h1 = Math.atan2(b.z - a.z, b.x - a.x);
    const h2 = Math.atan2(c.z - b.z, c.x - b.x);
    let turn = h2 - h1;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    const k = Math.abs(turn) / (look * step);
    curvature.push(k);
    if (k > 1 / (halfWidth * 1.15)) return null;
  }

  // Parts of the loop that are far apart along the track must also be far
  // apart on the ice (a clear gap between their edges).
  const minGap = width * 1.7;
  const skip = Math.round((width * 3) / step);
  for (let i = 0; i < n; i += 2) {
    for (let j = i + skip; j < n - skip + i && j < n; j += 2) {
      const d = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z);
      if (d < minGap) return null;
    }
  }

  // Start line at the start of the straightest stretch (grid behind it, straight ahead).
  const span = Math.round(40 / step);
  let best = 0;
  let bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -Math.round(span * 0.6); k < span; k++) sum += curvature[(i + k + n) % n]!;
    if (sum < bestScore) {
      bestScore = sum;
      best = i;
    }
  }
  points = [...points.slice(best), ...points.slice(0, best)];

  const along: number[] = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z));
  const total = along[n - 1]! + Math.hypot(points[0]!.x - points[n - 1]!.x, points[0]!.z - points[n - 1]!.z);
  const bound = Math.max(...points.map((p) => Math.hypot(p.x, p.z))) + halfWidth + 2;
  return { seed, points, along, length: total, halfWidth, bound };
}

/**
 * A new track of about `length` metres around and `width` metres wide.
 * The same seed always gives the same track.
 */
export function generateTrack(seed: number, length: number, width: number): Track {
  for (let k = 0; k < 200; k++) {
    const t = tryTrack((seed + k * 7919) >>> 0, length, width);
    if (t) return t;
  }
  // Fallback: a plain oval (never expected; the loop above nearly always succeeds).
  const r = length / (2 * Math.PI);
  const n = Math.round(length);
  const points = Array.from({ length: n }, (_, i) => ({ x: Math.cos((i / n) * 2 * Math.PI) * r * 1.3, z: Math.sin((i / n) * 2 * Math.PI) * r * 0.7 }));
  const along: number[] = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z));
  return { seed, points, along, length: loopLength(points), halfWidth: width / 2, bound: r * 1.3 + width };
}

/**
 * Where a spot is relative to the track: the closest middle-line point and
 * how far off the middle it is. With `hint` (the index found last time) only
 * nearby points are checked, so a tank is never matched to another part of
 * the loop that happens to be close.
 */
export function locateOnTrack(track: Track, x: number, z: number, hint: number | null = null, window = 25): TrackSpot {
  const pts = track.points;
  const n = pts.length;
  let bestI = 0;
  let bestD = Infinity;
  const check = (i: number) => {
    const p = pts[i]!;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  };
  if (hint === null) for (let i = 0; i < n; i++) check(i);
  else for (let k = -window; k <= window; k++) check((((hint + k) % n) + n) % n);

  // Distance to the segment on either side of the closest point (smoother than the point itself).
  let offset = Math.sqrt(bestD);
  let outX = 0;
  let outZ = 0;
  for (const j of [(bestI + 1) % n, (bestI - 1 + n) % n]) {
    const a = pts[bestI]!;
    const b = pts[j]!;
    const sx = b.x - a.x;
    const sz = b.z - a.z;
    const len2 = sx * sx + sz * sz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * sx + (z - a.z) * sz) / len2));
    const px = a.x + sx * t;
    const pz = a.z + sz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d <= offset) {
      offset = d;
      outX = d > 1e-6 ? (x - px) / d : 0;
      outZ = d > 1e-6 ? (z - pz) / d : 0;
    }
  }
  return { index: bestI, offset, outX, outZ };
}
