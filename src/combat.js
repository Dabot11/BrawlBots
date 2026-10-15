import { WEAPONS, angleDifference, heading, clamp } from "./config.js";
import { lineClear } from "./collision.js";

// Sector/disc contact: an exposed chassis edge counts, not just its centre.
export function attackProbe(
  attacker,
  target,
  weapon = attacker.weapon || WEAPONS[attacker.weaponId],
) {
  const dx = target.x - attacker.x,
    dz = target.z - attacker.z;
  const distance = Math.hypot(dx, dz);
  const difference = angleDifference(heading(attacker, target), attacker.angle);
  const nearestAngle =
    attacker.angle + clamp(difference, -weapon.arc, weapon.arc);
  const radial = clamp(
    distance * Math.cos(Math.max(0, Math.abs(difference) - weapon.arc)),
    0,
    weapon.reach,
  );
  const point = {
    x: attacker.x + Math.sin(nearestAngle) * radial,
    z: attacker.z - Math.cos(nearestAngle) * radial,
  };
  let reason = "ready";
  if (target.hp <= 0 || attacker.id === target.id) reason = "invalid";
  else if (!lineClear(attacker, target, 0.02)) reason = "cover";
  else if (distance > weapon.reach + target.radius + 1e-6) reason = "range";
  else if (
    Math.hypot(point.x - target.x, point.z - target.z) >
    target.radius + 1e-6
  )
    reason = "aim";
  else if (!lineClear(attacker, point, 0.08) || !lineClear(point, target, 0.02))
    reason = "cover";
  return {
    canHit: reason === "ready",
    reason,
    distance,
    difference,
    gap: Math.max(0, distance - weapon.reach - target.radius),
    point,
  };
}
const smooth = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
export function attackPose(robot) {
  const weapon = robot.weapon || WEAPONS[robot.weaponId],
    t = robot.attackElapsed;
  if (!robot.attacking)
    return {
      stage: robot.cooldown > 0 ? "recovery" : "ready",
      progress: 0,
      charge: 0,
      hammer: 0,
      sweep: 0,
      lift: 0,
      thrust: 0,
      recoil: 0,
    };
  const charge = smooth(t / weapon.windup),
    strike = smooth((t - weapon.windup) / (weapon.hitTime - weapon.windup));
  const after = smooth(
    (t - weapon.hitTime) / Math.max(0.01, weapon.duration - weapon.hitTime),
  );
  const stage =
    t < weapon.windup
      ? "windup"
      : t < weapon.hitTime
        ? "strike"
        : t <= weapon.hitTime + weapon.activeTime
          ? "active"
          : "recovery";
  return {
    stage,
    progress: clamp(t / weapon.duration, 0, 1),
    charge: t < weapon.hitTime ? charge : 0,
    hammer:
      t < weapon.hitTime ? charge * 1.35 - strike * 1.51 : -0.16 * (1 - after),
    sweep:
      t < weapon.hitTime
        ? -weapon.arc * charge * (1 - strike)
        : Math.sin(after * Math.PI) * weapon.arc,
    lift:
      t < weapon.hitTime ? -0.08 * charge + strike * 1.03 : 0.95 * (1 - after),
    thrust:
      t < weapon.hitTime ? 0.07 * charge - 0.37 * strike : -0.3 * (1 - after),
    recoil: t >= weapon.hitTime ? Math.sin(after * Math.PI) * 0.07 : 0,
  };
}
export function impactPose(robot) {
  const t = 1 - (robot.hitReaction || 0) / 0.34;
  const wave =
    robot.hitReaction > 0
      ? Math.cos(t * Math.PI * 3) * Math.exp(-3 * t) * robot.hitStrength
      : 0;
  const x =
    (robot.hitX || 0) * Math.cos(robot.angle) +
    (robot.hitZ || 0) * Math.sin(robot.angle);
  const z =
    -(robot.hitX || 0) * Math.sin(robot.angle) +
    (robot.hitZ || 0) * Math.cos(robot.angle);
  return {
    pitch: z * wave * 0.14,
    roll: -x * wave * 0.16,
    bounce: Math.abs(wave) * 0.035,
  };
}
