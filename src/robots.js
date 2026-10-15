import { SPAWNS, clamp } from "./config.js";
import { deriveLoadout, DEFAULT_LOADOUT } from "./loadout.js";
import { moveCircle } from "./collision.js";

export function createRobot(
  id,
  definition,
  weaponId = id === 0 ? "hammer" : "saw",
  loadout,
) {
  const built = deriveLoadout(
    loadout || {
      ...DEFAULT_LOADOUT,
      weapon: weaponId,
      paint: id === 0 ? "mint" : "orange",
    },
  );
  definition ||= built.stats;
  return {
    ...definition,
    loadout: built.loadout,
    weapon: built.weapon,
    ...SPAWNS[id],
    id,
    hp: definition.health,
    speedNow: 0,
    cooldown: 0,
    travel: 0,
    hitFlash: 0,
    hitReaction: 0,
    hitStrength: 0,
    hitX: 0,
    hitZ: 0,
    controlGrace: 0,
    attacks: 0,
    hits: 0,
    damageDealt: 0,
    damageTaken: 0,
    weaponId,
    attackElapsed: 0,
    attacking: false,
    attackLanded: false,
    stun: 0,
    flipTime: 0,
    flipDuration: 1,
    impulseX: 0,
    impulseZ: 0,
  };
}

export function drive(robot, input, dt) {
  if (robot.hp <= 0) return;
  robot.controlGrace = Math.max(0, robot.controlGrace - dt);
  robot.hitReaction = Math.max(0, robot.hitReaction - dt);
  robot.stun = Math.max(0, robot.stun - dt);
  robot.flipTime = Math.max(0, robot.flipTime - dt);
  const disabled = robot.stun > 0 || robot.flipTime > 0;
  const throttle = disabled ? 0 : clamp(input.throttle || 0, -1, 1);
  const turn = disabled ? 0 : clamp(input.turn || 0, -1, 1);
  robot.angle += turn * robot.turnSpeed * dt;
  const target = throttle * (throttle < 0 ? robot.reverseSpeed : robot.speed);
  const rate =
    Math.abs(target) < Math.abs(robot.speedNow) || target * robot.speedNow < 0
      ? robot.braking
      : robot.acceleration;
  robot.speedNow += clamp(target - robot.speedNow, -rate * dt, rate * dt);
  const before = { x: robot.x, z: robot.z };
  moveCircle(
    robot,
    (Math.sin(robot.angle) * robot.speedNow + robot.impulseX) * dt,
    (-Math.cos(robot.angle) * robot.speedNow + robot.impulseZ) * dt,
  );
  robot.impulseX *= Math.exp(-7 * dt);
  robot.impulseZ *= Math.exp(-7 * dt);
  const moved = Math.hypot(robot.x - before.x, robot.z - before.z);
  robot.travel += Math.sign(robot.speedNow) * moved;
  if (
    Math.abs(robot.speedNow) > 0.1 &&
    moved < Math.abs(robot.speedNow * dt) * 0.1
  )
    robot.speedNow *= 0.5;
  robot.hitFlash = Math.max(0, robot.hitFlash - dt);
}
