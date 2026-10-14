import { WEAPONS, angleDifference, heading } from "./config.js";
import { lineClear } from "./collision.js";

export function canReach(
  attacker,
  target,
  weapon = WEAPONS[attacker.weaponId],
) {
  return (
    target.hp > 0 &&
    attacker.id !== target.id &&
    Math.hypot(target.x - attacker.x, target.z - attacker.z) <=
      weapon.reach + target.radius &&
    Math.abs(angleDifference(heading(attacker, target), attacker.angle)) <=
      weapon.arc &&
    lineClear(attacker, target, 0.08)
  );
}

export function startAttack(robot, events) {
  if (
    robot.hp <= 0 ||
    robot.stun > 0 ||
    robot.flipTime > 0 ||
    robot.cooldown > 0 ||
    robot.attacking
  )
    return false;
  const weapon = WEAPONS[robot.weaponId];
  robot.cooldown = weapon.interval;
  robot.attackElapsed = 0;
  robot.attackLanded = false;
  robot.attacking = true;
  if (weapon.lunge) {
    robot.impulseX += Math.sin(robot.angle) * weapon.lunge;
    robot.impulseZ -= Math.cos(robot.angle) * weapon.lunge;
  }
  events.push({ type: "attack", owner: robot.id, weapon: robot.weaponId });
  return true;
}

export function updateAttack(robot, targets, dt, events) {
  robot.cooldown = Math.max(0, robot.cooldown - dt);
  if (!robot.attacking) return;
  if (robot.hp <= 0 || robot.stun > 0 || robot.flipTime > 0) {
    robot.attacking = false;
    return;
  }
  const weapon = WEAPONS[robot.weaponId];
  const previous = robot.attackElapsed;
  robot.attackElapsed += dt;
  // Check the time interval too: a coarse step cannot skip a mechanical strike.
  if (
    !robot.attackLanded &&
    robot.attackElapsed >= weapon.hitTime &&
    previous <= weapon.hitTime + weapon.activeTime
  ) {
    for (const target of targets) {
      if (!canReach(robot, target, weapon)) continue;
      robot.attackLanded = true;
      const targetWeapon = WEAPONS[target.weaponId];
      const guarded =
        Math.abs(angleDifference(heading(target, robot), target.angle)) < 1.0;
      const reduction = guarded ? targetWeapon.frontArmor || 0 : 0;
      const damage = Math.round(weapon.damage * (1 - reduction));
      target.hp = Math.max(0, target.hp - damage);
      target.hitFlash = 0.16;
      const distance = Math.hypot(target.x - robot.x, target.z - robot.z) || 1;
      const force = weapon.knockback * (targetWeapon.stability || 1);
      target.impulseX += ((target.x - robot.x) / distance) * force;
      target.impulseZ += ((target.z - robot.z) / distance) * force;
      target.stun = Math.max(target.stun, weapon.stun);
      if (target.stun > 0) target.attacking = false;
      if (weapon.flip && target.hp > 0) {
        target.flipTime = target.flipDuration = weapon.flip;
        target.speedNow = 0;
        events.push({ type: "flip", target: target.id });
      }
      events.push({
        type: "damage",
        owner: robot.id,
        target: target.id,
        weapon: robot.weaponId,
        x: (robot.x + target.x) / 2,
        z: (robot.z + target.z) / 2,
      });
      if (target.hp === 0)
        events.push({
          type: "destroy",
          target: target.id,
          x: target.x,
          z: target.z,
        });
      break;
    }
  }
  if (robot.attackElapsed >= weapon.duration) robot.attacking = false;
}
