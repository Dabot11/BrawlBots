import { createRobot, drive } from "./robots.js";
import { Navigation } from "./navigation.js";
import { RivalAI } from "./ai.js";
import { separateRobots } from "./collision.js";
import { startAttack, updateAttack, applyHit } from "./weapons.js";
import {
  normalizeLoadout,
  DEFAULT_LOADOUT,
  RIVAL_LOADOUT,
  CATEGORIES,
} from "./loadout.js";

export class Simulation {
  constructor(loadout = DEFAULT_LOADOUT) {
    this.loadout = normalizeLoadout(loadout);
    this.ai = new RivalAI(new Navigation());
    this.state = "home";
    this.reset();
    this.state = "home";
  }
  reset() {
    this.robots = [
      createRobot(0, undefined, this.loadout.weapon, this.loadout),
      createRobot(1, undefined, RIVAL_LOADOUT.weapon, RIVAL_LOADOUT),
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
  get playerWeapon() {
    return this.loadout.weapon;
  }
  garage() {
    if (this.state !== "home") return false;
    this.state = "garage";
    return true;
  }
  selectPart(category, id) {
    if (!["home", "garage"].includes(this.state)) return false;
    const slot = CATEGORIES.find((item) => item.id === category);
    if (!slot || !Object.hasOwn(slot.catalog, id)) return false;
    this.loadout = { ...this.loadout, [category]: id };
    this.robots[0] = createRobot(
      0,
      undefined,
      this.loadout.weapon,
      this.loadout,
    );
    return true;
  }
  selectWeapon(id) {
    return this.selectPart("weapon", id);
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
    if (playerInput.attack) startAttack(player, this.events);
    if (rivalInput.attack) startAttack(rival, this.events);
    const hits = [];
    // Evaluate both striking windows before damage or stun: ties have no owner priority.
    for (const robot of this.robots)
      updateAttack(robot, this.robots, dt, this.events, hits);
    for (const hit of hits)
      applyHit(hit.attacker, hit.target, hit.weapon, this.events);
    if (player.hp <= 0 || rival.hp <= 0) {
      this.winner =
        player.hp <= 0 && rival.hp <= 0 ? -1 : player.hp <= 0 ? 1 : 0;
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
