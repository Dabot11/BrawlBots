import { CONFIG, angleDifference, heading, clamp } from "./config.js";
import { lineClear } from "./collision.js";

export class RivalAI {
  constructor(navigation) {
    this.navigation = navigation;
    this.reset();
  }
  reset() {
    this.reaction = 0.6;
    this.repath = 0;
    this.path = [];
    this.command = { throttle: 0, turn: 0, fire: false };
    this.stuckTime = 0;
    this.last = null;
    this.recovery = 0;
    this.recoveryCount = 0;
  }

  update(robot, target, dt) {
    this.reaction -= dt;
    this.repath -= dt;
    if (
      this.last &&
      Math.abs(this.command.throttle) > 0.35 &&
      Math.hypot(robot.x - this.last.x, robot.z - this.last.z) < 0.009
    )
      this.stuckTime += dt;
    else this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
    this.last = { x: robot.x, z: robot.z };
    if (this.stuckTime > 0.7) {
      this.recovery = 0.8;
      this.stuckTime = 0;
      this.repath = 0;
      this.recoveryCount++;
    }
    if (this.recovery > 0) {
      this.recovery -= dt;
      this.command = {
        throttle: -0.85,
        turn: this.recoveryCount % 2 ? 0.7 : -0.7,
        fire: false,
      };
      return this.command;
    }
    if (this.reaction > 0) return this.command;
    this.reaction = CONFIG.ai.reaction;
    const distance = Math.hypot(robot.x - target.x, robot.z - target.z);
    const clearShot = lineClear(robot, target, 0.15);
    const clearDrive = lineClear(robot, target, robot.radius + 0.2);
    if (this.repath <= 0) {
      this.path = this.navigation.findPath(robot, target);
      this.repath = CONFIG.ai.repath;
    }
    while (
      this.path.length > 1 &&
      Math.hypot(robot.x - this.path[0].x, robot.z - this.path[0].z) < 1.0
    )
      this.path.shift();
    const attacking = clearShot && distance < CONFIG.ai.range;
    const waypoint = attacking ? target : clearDrive ? target : this.path[0];
    if (!waypoint)
      return (this.command = { throttle: -0.4, turn: 0.7, fire: false });
    const difference = angleDifference(heading(robot, waypoint), robot.angle);
    const turn = clamp(difference * 1.8, -0.8, 0.8);
    let throttle = Math.abs(difference) < 1.1 ? 0.72 : 0;
    if (attacking && distance < CONFIG.ai.preferredRange)
      throttle = distance < 3.3 ? -0.45 : 0;
    // Keep a little forward pressure while repositioning behind cover.
    if (!attacking && Math.abs(difference) < 0.35) throttle = 0.8;
    this.command = {
      throttle,
      turn,
      fire:
        attacking &&
        Math.abs(angleDifference(heading(robot, target), robot.angle)) <
          CONFIG.ai.aimAngle,
    };
    return this.command;
  }
}
