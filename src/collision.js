import { CONFIG, OBSTACLES, clamp } from "./config.js";

export function circleHitsBox(x, z, radius, box) {
  const dx = x - clamp(x, box.x - box.hx, box.x + box.hx);
  const dz = z - clamp(z, box.z - box.hz, box.z + box.hz);
  return dx * dx + dz * dz < radius * radius;
}

export function positionFree(x, z, radius, obstacles = OBSTACLES) {
  const { halfWidth, halfDepth } = CONFIG.arena;
  return (
    Math.abs(x) <= halfWidth - radius &&
    Math.abs(z) <= halfDepth - radius &&
    !obstacles.some((box) => circleHitsBox(x, z, radius, box))
  );
}

// Parametric segment intersections detect hits even when a projectile crosses
// the whole target between frames. The earliest hit wins.
export function segmentBox(from, to, box, padding = 0) {
  let enter = 0,
    exit = 1;
  for (const [axis, half] of [
    ["x", "hx"],
    ["z", "hz"],
  ]) {
    const delta = to[axis] - from[axis];
    const lo = box[axis] - box[half] - padding,
      hi = box[axis] + box[half] + padding;
    if (Math.abs(delta) < 1e-9) {
      if (from[axis] < lo || from[axis] > hi) return null;
    } else {
      let a = (lo - from[axis]) / delta,
        b = (hi - from[axis]) / delta;
      if (a > b) [a, b] = [b, a];
      enter = Math.max(enter, a);
      exit = Math.min(exit, b);
      if (enter > exit) return null;
    }
  }
  return enter;
}

export function segmentCircle(from, to, circle, radius) {
  const dx = to.x - from.x,
    dz = to.z - from.z;
  const fx = from.x - circle.x,
    fz = from.z - circle.z;
  const a = dx * dx + dz * dz,
    c = fx * fx + fz * fz - radius * radius;
  if (c <= 0) return 0;
  if (a < 1e-12) return null;
  const b = 2 * (fx * dx + fz * dz),
    disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function lineClear(from, to, padding = 0, obstacles = OBSTACLES) {
  return obstacles.every((box) => segmentBox(from, to, box, padding) === null);
}

export function moveCircle(robot, dx, dz, obstacles = OBSTACLES) {
  const { halfWidth, halfDepth } = CONFIG.arena;
  // Small substeps and axis sliding let vehicles reverse out of corners.
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(dx, dz) / (robot.radius * 0.45)),
  );
  for (let i = 0; i < steps; i++) {
    const x = clamp(
      robot.x + dx / steps,
      -halfWidth + robot.radius,
      halfWidth - robot.radius,
    );
    if (!obstacles.some((b) => circleHitsBox(x, robot.z, robot.radius, b)))
      robot.x = x;
    const z = clamp(
      robot.z + dz / steps,
      -halfDepth + robot.radius,
      halfDepth - robot.radius,
    );
    if (!obstacles.some((b) => circleHitsBox(robot.x, z, robot.radius, b)))
      robot.z = z;
  }
}

export function separateRobots(a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    d = Math.hypot(dx, dz);
  const overlap = a.radius + b.radius - d;
  if (overlap > 0) {
    const nx = d > 1e-6 ? dx / d : 1,
      nz = d > 1e-6 ? dz / d : 0;
    moveCircle(a, -nx * overlap * 0.5, -nz * overlap * 0.5);
    moveCircle(b, nx * overlap * 0.5, nz * overlap * 0.5);
    // If one is pinned to a wall, let the other absorb the remaining overlap.
    const remaining = a.radius + b.radius - Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining > 0.001) {
      moveCircle(a, -nx * remaining, -nz * remaining);
      const rest = a.radius + b.radius - Math.hypot(b.x - a.x, b.z - a.z);
      if (rest > 0) moveCircle(b, nx * rest, nz * rest);
    }
  }
}
