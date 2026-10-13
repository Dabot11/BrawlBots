import { createRobot, drive } from "./robots.js";
import { Navigation } from "./navigation.js";
import { RivalAI } from "./ai.js";
import { separateRobots } from "./collision.js";
import { fire, advanceProjectiles } from "./weapons.js";

export class Simulation {
  constructor() {
    this.ai = new RivalAI(new Navigation());
    this.state = "home";
    this.reset();
    this.state = "home";
  }
  reset() {
    this.robots = [createRobot(0), createRobot(1)];
    this.bullets = [];
    this.events = [];
    this.nextBullet = 0;
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
      robot.cooldown = Math.max(0, robot.cooldown - dt);
      if (input.fire && fire(robot, this.bullets, this.events, this.nextBullet))
        this.nextBullet++;
    }
    this.bullets = advanceProjectiles(
      this.bullets,
      this.robots,
      dt,
      this.events,
    );
    if (player.hp <= 0 || rival.hp <= 0) {
      this.winner = player.hp <= 0 ? 1 : 0;
      this.state = "result";
      this.bullets = [];
      player.speedNow = rival.speedNow = 0;
      this.events.push({ type: "result", winner: this.winner });
    }
  }
  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
