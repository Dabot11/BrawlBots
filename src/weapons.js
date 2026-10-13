import { CONFIG, OBSTACLES, WEAPON } from "./config.js";
import { segmentBox, segmentCircle } from "./collision.js";

export function fire(robot, bullets, events, nextId) {
  if (robot.hp <= 0 || robot.cooldown > 0) return false;
  robot.cooldown = WEAPON.interval * (robot.id === 1 ? 1.7 : 1);
  const dx = Math.sin(robot.angle),
    dz = -Math.cos(robot.angle);
  // Start inside the barrel and sweep outward; even point-blank cover blocks.
  const bullet = {
    id: nextId,
    owner: robot.id,
    x: robot.x + dx * 0.9,
    z: robot.z + dz * 0.9,
    dx,
    dz,
    life: WEAPON.life,
  };
  bullets.push(bullet);
  events.push({
    type: "fire",
    owner: robot.id,
    x: robot.x + dx * 1.65,
    z: robot.z + dz * 1.65,
  });
  return true;
}

export function advanceProjectiles(
  bullets,
  robots,
  dt,
  events,
  obstacles = OBSTACLES,
) {
  const retained = [];
  for (const bullet of bullets) {
    const from = { x: bullet.x, z: bullet.z };
    const to = {
      x: from.x + bullet.dx * WEAPON.speed * dt,
      z: from.z + bullet.dz * WEAPON.speed * dt,
    };
    let nearest = Infinity,
      hitRobot = null;
    for (const box of obstacles) {
      const t = segmentBox(from, to, box, WEAPON.radius);
      if (t !== null && t < nearest) {
        nearest = t;
        hitRobot = null;
      }
    }
    for (const robot of robots) {
      if (robot.id === bullet.owner || robot.hp <= 0) continue;
      const t = segmentCircle(from, to, robot, robot.radius + WEAPON.radius);
      if (t !== null && t < nearest) {
        nearest = t;
        hitRobot = robot;
      }
    }
    if (nearest !== Infinity) {
      const point = {
        x: from.x + (to.x - from.x) * nearest,
        z: from.z + (to.z - from.z) * nearest,
      };
      if (hitRobot) {
        hitRobot.hp = Math.max(0, hitRobot.hp - WEAPON.damage);
        hitRobot.hitFlash = 0.16;
        events.push({ type: "damage", target: hitRobot.id, ...point });
        if (hitRobot.hp === 0)
          events.push({
            type: "destroy",
            target: hitRobot.id,
            x: hitRobot.x,
            z: hitRobot.z,
          });
      } else events.push({ type: "impact", ...point });
      continue;
    }
    bullet.x = to.x;
    bullet.z = to.z;
    bullet.life -= dt;
    if (
      Math.abs(to.x) >= CONFIG.arena.halfWidth - WEAPON.radius ||
      Math.abs(to.z) >= CONFIG.arena.halfDepth - WEAPON.radius
    ) {
      events.push({
        type: "impact",
        x: Math.max(-17, Math.min(17, to.x)),
        z: Math.max(-14, Math.min(14, to.z)),
      });
      continue;
    }
    if (bullet.life > 0) retained.push(bullet);
  }
  return retained;
}
