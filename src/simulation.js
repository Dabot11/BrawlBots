import { createRobot, drive } from "./robots.js";
import { Navigation } from "./navigation.js";
import { RivalAI } from "./ai.js";
import { separateRobots } from "./collision.js";
import { startAttack, updateAttack } from "./weapons.js";
import { WEAPON_IDS } from "./config.js";

export class Simulation {
  constructor() {
    this.playerWeapon = "hammer";
    this.ai = new RivalAI(new Navigation());
    this.state = "home";
    this.reset();
    this.state = "home";
  }
  reset() {
    this.robots = [
      createRobot(0, undefined, this.playerWeapon),
      createRobot(1),
    ];
    this.events = [];
    this.elapsed = 0;
    this.countdown = 3;
    this.winner = null;
    this.ai.reset();
    this.state = "countdown";
    this.resumeState = "playing";
  }
  home() {
    this.reset();
    this.state = "home";
  }
  selectWeapon(id) {
    if (this.state !== "home" || !WEAPON_IDS.includes(id)) return false;
    this.playerWeapon = this.robots[0].weaponId = id;
    return true;
  }
  pause() {
    if (this.state === "playing" || this.state === "countdown") {
      this.resumeState = this.state;
      this.state = "paused";
      return true;
    }
    return false;
  }
  resume() {
    if (this.state === "paused") this.state = this.resumeState;
  }
  update(dt, playerInput) {
    if (this.state === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.state = "playing";
        this.events.push({ type: "start" });
      }
      return;
    }
    if (this.state !== "playing") return;
    this.elapsed += dt;
    const [player, rival] = this.robots;
    const rivalInput = this.ai.update(rival, player, dt);
    drive(player, playerInput, dt);
    drive(rival, rivalInput, dt);
    separateRobots(player, rival);
    for (const [robot, input] of [
      [player, playerInput],
      [rival, rivalInput],
    ]) {
      if (input.attack) startAttack(robot, this.events);
      updateAttack(robot, this.robots, dt, this.events);
    }
    if (player.hp <= 0 || rival.hp <= 0) {
      this.winner = player.hp <= 0 ? 1 : 0;
      this.state = "result";
      player.speedNow = rival.speedNow = 0;
      player.attacking = rival.attacking = false;
      this.events.push({ type: "result", winner: this.winner });
    }
  }
  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
