import { WEAPONS, angleDifference, heading } from "./config.js";
import { lineClear } from "./collision.js";

export function canReach(
  attacker,
  target,
  weapon = attacker.weapon || WEAPONS[attacker.weaponId],
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
  const weapon = robot.weapon || WEAPONS[robot.weaponId];
  if (
    robot.hp <= 0 ||
    (robot.stun > 0 && !weapon.steady) ||
    robot.flipTime > 0 ||
    robot.cooldown > 0 ||
    robot.attacking
  )
    return false;
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

export function updateAttack(robot, targets, dt, events, hits) {
  robot.cooldown = Math.max(0, robot.cooldown - dt);
  if (!robot.attacking) return;
  const weapon = robot.weapon || WEAPONS[robot.weaponId];
  if (
    robot.hp <= 0 ||
    (robot.stun > 0 && !weapon.steady) ||
    robot.flipTime > 0
  ) {
    robot.attacking = false;
    return;
  }
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

      if (hits) hits.push({ attacker: robot, target, weapon });
      else applyHit(robot, target, weapon, events);
      break;
    }
  }
  if (robot.attackElapsed >= weapon.duration) robot.attacking = false;
}

export function applyHit(attacker, target, weapon, events) {
  const guarded =
    Math.abs(angleDifference(heading(target, attacker), target.angle)) < 1.0;
  const reduction = guarded ? target.frontArmor || 0 : 0;
  const damage = Math.max(
    1,
    Math.round(weapon.damage * (1 - reduction) * (1 - (target.armor || 0))),
  );
  target.hp = Math.max(0, target.hp - damage);
  target.hitFlash = 0.16;
  const distance =
    Math.hypot(target.x - attacker.x, target.z - attacker.z) || 1;
  const force = weapon.knockback * (target.stability || 1);
  target.impulseX += ((target.x - attacker.x) / distance) * force;
  target.impulseZ += ((target.z - attacker.z) / distance) * force;
  target.stun = Math.max(target.stun, weapon.stun * (target.recovery || 1));
  if (target.stun > 0 && !target.weapon?.steady) target.attacking = false;
  if (weapon.flip && target.hp > 0) {
    target.flipTime = target.flipDuration =
      weapon.flip * (target.recovery || 1);
    target.speedNow = 0;
    target.attacking = false;
    events.push({ type: "flip", target: target.id });
  }
  events.push({
    type: "damage",
    owner: attacker.id,
    target: target.id,
    weapon: attacker.weaponId,
    x: (attacker.x + target.x) / 2,
    z: (attacker.z + target.z) / 2,
  });
  if (target.hp === 0)
    events.push({
      type: "destroy",
      target: target.id,
      x: target.x,
      z: target.z,
    });
}
