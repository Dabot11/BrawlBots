import { CONFIG, WEAPONS, angleDifference, heading, clamp } from "./config.js";
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
    this.command = { throttle: 0, turn: 0, attack: false };
    this.stuckTime = 0;
    this.last = null;
    this.recovery = 0;
    this.recoveryCount = 0;
  }
  update(robot, target, dt) {
    if (robot.stun > 0 || robot.flipTime > 0 || robot.hp <= 0) {
      this.last = { x: robot.x, z: robot.z };
      this.stuckTime = 0;
      return (this.command = {
        throttle: 0,
        turn: 0,
        attack:
          robot.hp > 0 && robot.flipTime <= 0 && Boolean(robot.weapon?.steady),
      });
    }
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
      return (this.command = {
        throttle: -0.85,
        turn: this.recoveryCount % 2 ? 0.7 : -0.7,
        attack: false,
      });
    }
    if (this.reaction > 0) return this.command;
    this.reaction = CONFIG.ai.reaction;
    const weapon = robot.weapon || WEAPONS[robot.weaponId];
    const distance = Math.hypot(robot.x - target.x, robot.z - target.z);
    const visible = lineClear(robot, target, 0.08);
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
    const inReach = visible && distance <= weapon.reach + target.radius;
    const waypoint = inReach || clearDrive ? target : this.path[0];
    if (!waypoint)
      return (this.command = { throttle: -0.4, turn: 0.7, attack: false });
    const difference = angleDifference(heading(robot, waypoint), robot.angle);
    const turn = clamp(difference * 2.3, -0.85, 0.85);
    let throttle = Math.abs(difference) < 1.0 ? CONFIG.ai.approachSpeed : 0;
    if (visible && distance < robot.radius + target.radius + 0.18) throttle = 0;
    if (inReach && Math.abs(difference) > weapon.arc) throttle = 0;
    return (this.command = {
      throttle,
      turn,
      attack: inReach && Math.abs(difference) <= weapon.arc * 0.8,
    });
  }
}
