import { ROBOT, SPAWNS, clamp } from "./config.js";
import { moveCircle } from "./collision.js";

export function createRobot(id, definition = ROBOT) {
  return {
    ...definition,
    ...SPAWNS[id],
    id,
    hp: definition.health,
    speedNow: 0,
    cooldown: 0,
    travel: 0,
    hitFlash: 0,
  };
}

export function drive(robot, input, dt) {
  if (robot.hp <= 0) return;
  const throttle = clamp(input.throttle || 0, -1, 1);
  const turn = clamp(input.turn || 0, -1, 1);
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
    Math.sin(robot.angle) * robot.speedNow * dt,
    -Math.cos(robot.angle) * robot.speedNow * dt,
  );
  const moved = Math.hypot(robot.x - before.x, robot.z - before.z);
  robot.travel += Math.sign(robot.speedNow) * moved;
  if (
    Math.abs(robot.speedNow) > 0.1 &&
    moved < Math.abs(robot.speedNow * dt) * 0.1
  )
    robot.speedNow *= 0.5;
  robot.hitFlash = Math.max(0, robot.hitFlash - dt);
}
