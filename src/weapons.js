import { WEAPONS, angleDifference, heading } from "./config.js";
import { attackProbe } from "./combat.js";

export function canReach(
  attacker,
  target,
  weapon = attacker.weapon || WEAPONS[attacker.weaponId],
) {
  return attackProbe(attacker, target, weapon).canHit;
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
  robot.attacks++;
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
  if (robot.hp <= 0 || robot.flipTime > 0) {
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
  if (
    !robot.attackLanded &&
    previous <= weapon.hitTime + weapon.activeTime &&
    robot.attackElapsed > weapon.hitTime + weapon.activeTime
  ) {
    const target = targets.find(
      (target) => target.id !== robot.id && target.hp > 0,
    );
    events.push({
      type: "miss",
      owner: robot.id,
      reason: target ? attackProbe(robot, target, weapon).reason : "invalid",
    });
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
  const dealt = Math.min(target.hp, damage);
  target.hp = Math.max(0, target.hp - damage);
  attacker.hits++;
  attacker.damageDealt += dealt;
  target.damageTaken += dealt;
  target.hitFlash = 0.18;
  target.hitReaction = 0.34;
  target.hitStrength = Math.min(1.3, 0.35 + dealt / 28);
  const distance =
    Math.hypot(target.x - attacker.x, target.z - attacker.z) || 1;
  const force = weapon.knockback * (target.stability || 1);
  target.impulseX += ((target.x - attacker.x) / distance) * force;
  target.impulseZ += ((target.z - attacker.z) / distance) * force;
  target.hitX = (target.x - attacker.x) / distance;
  target.hitZ = (target.z - attacker.z) / distance;
  // Brief resistance after a heavy interruption prevents chained loss of control.
  const interrupts = weapon.stun >= 0.22 && target.controlGrace <= 0;
  if (interrupts) {
    target.stun = Math.max(
      target.stun,
      Math.min(0.3, weapon.stun) * (target.recovery || 1),
    );
    target.controlGrace = 0.85;
    const preparing =
      target.attacking && target.attackElapsed < target.weapon.windup;
    if (preparing && !target.weapon.steady) target.attacking = false;
  }
  if (
    weapon.flip &&
    target.hp > 0 &&
    target.flipTime <= 0 &&
    (target.controlGrace <= 0 || interrupts)
  ) {
    target.flipTime = target.flipDuration =
      weapon.flip * (target.recovery || 1);
    target.stun = Math.max(target.stun, target.flipTime);
    target.controlGrace = target.flipTime + 0.55;
    target.speedNow = 0;
    target.attacking = false;
    events.push({ type: "flip", target: target.id });
  }
  events.push({
    type: "damage",
    owner: attacker.id,
    target: target.id,
    weapon: attacker.weaponId,
    amount: dealt,
    absorbed: Math.max(0, weapon.damage - damage),
    hitX: target.hitX,
    hitZ: target.hitZ,
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
