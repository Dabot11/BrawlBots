import test from "node:test";
import assert from "node:assert/strict";
import { attackProbe, attackPose, impactPose } from "../src/combat.js";
import { createRobot, drive } from "../src/robots.js";
import { startAttack, updateAttack } from "../src/weapons.js";
import { CATEGORIES, DEFAULT_LOADOUT } from "../src/loadout.js";
import { WEAPON_IDS, CONFIG } from "../src/config.js";
import { Simulation } from "../src/simulation.js";
import { Input } from "../src/input.js";
const idle = { throttle: 0, turn: 0, attack: false },
  step = 1 / 60;
function pair(weapon = "hammer", defender = "saw", build = {}) {
  const a = createRobot(0, undefined, weapon, {
      ...DEFAULT_LOADOUT,
      ...build,
      weapon,
    }),
    b = createRobot(1, undefined, defender);
  a.x = b.x = -12;
  a.z = 8;
  b.z = 5.2;
  a.angle = 0;
  b.angle = Math.PI;
  return [a, b];
}
function hit(a, b) {
  a.cooldown = 0;
  a.attacking = false;
  const events = [];
  assert.ok(startAttack(a, events));
  updateAttack(a, [b], 0.7, events);
  return events;
}
test("edge contact counts without requiring the victim centre inside the attack arc", () => {
  const [a, b] = pair("spike");
  b.x = a.x + Math.sin(0.65) * 2.8;
  b.z = a.z - Math.cos(0.65) * 2.8;
  assert.ok(attackProbe(a, b).canHit);
  hit(a, b);
  assert.ok(b.hp < 100);
});
test("contact probe distinguishes range, aim and cover without damaging through walls", () => {
  const [a, b] = pair();
  b.z = -2;
  assert.equal(attackProbe(a, b).reason, "range");
  b.z = 10.8;
  assert.equal(attackProbe(a, b).reason, "aim");
  a.x = b.x = 0;
  a.z = 0.9;
  b.z = -3.9;
  assert.equal(attackProbe(a, b, { ...a.weapon, reach: 5 }).reason, "cover");
  assert.equal(attackProbe(a, a).reason, "invalid");
});
test("every assembly damages every opposing tool at physical frontal contact and reports the exact loss", () => {
  const builds = CATEGORIES.filter((c) => c.id !== "paint").reduce(
    (a, c) =>
      a.flatMap((b) =>
        Object.keys(c.catalog).map((id) => ({ ...b, [c.id]: id })),
      ),
    [{}],
  );
  let checks = 0;
  for (const build of builds)
    for (const enemy of WEAPON_IDS) {
      const [a, b] = pair(build.weapon, enemy, build);
      const previous = b.hp,
        events = hit(a, b),
        damage = events.find((e) => e.type === "damage");
      assert.ok(damage && damage.amount > 0, JSON.stringify(build));
      assert.equal(damage.amount, previous - b.hp);
      assert.equal(a.damageDealt, damage.amount);
      assert.equal(b.damageTaken, damage.amount);
      checks++;
    }
  assert.equal(checks, 2160);
});
test("one swing cannot deal repeated damage while remaining in the active window", () => {
  const [a, b] = pair();
  const events = [];
  startAttack(a, events);
  for (let i = 0; i < 60; i++) updateAttack(a, [b], step, events);
  assert.equal(a.hits, 1);
  assert.equal(events.filter((e) => e.type === "damage").length, 1);
});
test("a failed swing reports its reason once, and does not invent damage", () => {
  const [a, b] = pair();
  b.z = -2;
  const events = [];
  startAttack(a, events);
  for (let i = 0; i < 60; i++) updateAttack(a, [b], step, events);
  assert.equal(b.hp, 100);
  assert.deepEqual(
    events.filter((e) => e.type === "miss").map((e) => e.reason),
    ["range"],
  );
  assert.equal(a.hits, 0);
});
test("light tools cannot keep cancelling a slow weapon before it lands", () => {
  const [fast, heavy] = pair("forks", "hammer");
  heavy.attacking = true;
  heavy.attackElapsed = 0.1;
  hit(fast, heavy);
  assert.equal(heavy.attacking, true);
  const events = [];
  updateAttack(heavy, [fast], 0.4, events);
  assert.ok(fast.hp < 100);
});
test("heavy interruptions grant a brief resistance instead of allowing repeated loss of control", () => {
  const [a, b] = pair("hammer", "hammer");
  b.attacking = true;
  hit(a, b);
  assert.equal(b.attacking, false);
  assert.ok(b.controlGrace > 0);
  b.stun = 0;
  b.attacking = true;
  b.attackElapsed = 0.1;
  hit(a, b);
  assert.equal(b.attacking, true);
  assert.equal(b.stun, 0);
  for (let i = 0; i < 60; i++) drive(b, idle, step);
  b.x = a.x;
  b.z = a.z - 2.8;
  b.impulseX = b.impulseZ = 0;
  hit(a, b);
  assert.ok(b.stun > 0);
});
test("overkill feedback reports remaining health, not a fictitious larger loss", () => {
  const [a, b] = pair();
  b.hp = 3;
  const damage = hit(a, b).find((e) => e.type === "damage");
  assert.equal(damage.amount, 3);
  assert.equal(a.damageDealt, 3);
});
test("hammer preparation and impact pose follow the actual collision window", () => {
  const [a] = pair();
  a.attacking = true;
  a.attackElapsed = a.weapon.windup;
  assert.ok(attackPose(a).hammer > 1);
  a.attackElapsed = a.weapon.hitTime;
  assert.equal(attackPose(a).stage, "active");
  assert.ok(attackPose(a).hammer < 0);
  a.attacking = false;
  a.cooldown = 0.4;
  assert.equal(attackPose(a).stage, "recovery");
  a.cooldown = 0;
  assert.equal(attackPose(a).stage, "ready");
});
test("impact reaction is bounded, directional and returns to rest", () => {
  const [a] = pair();
  a.hitReaction = 0.34;
  a.hitStrength = 1;
  a.hitX = 1;
  a.hitZ = 0;
  const pose = impactPose(a);
  assert.ok(Math.abs(pose.roll) <= 0.2);
  a.hitReaction = 0;
  assert.deepEqual(impactPose(a), { pitch: 0, roll: -0, bounce: 0 });
});
test("round time freezes when paused and decides by integrity percentage, not raw armor HP", () => {
  const sim = new Simulation({ ...DEFAULT_LOADOUT, shell: "armored" });
  sim.reset();
  sim.state = "playing";
  sim.ai.update = () => idle;
  sim.elapsed = CONFIG.match.seconds - 0.01;
  sim.robots[0].hp = 55;
  sim.robots[1].hp = 53;
  sim.pause();
  sim.update(10, idle);
  assert.equal(sim.state, "paused");
  sim.resume();
  sim.update(step, idle);
  assert.equal(sim.state, "result");
  assert.equal(sim.winner, 1);
  assert.equal(sim.resultReason, "time");
  sim.home();
  assert.equal(sim.resultReason, null);
  assert.equal(sim.robots[0].damageDealt, 0);
});
test("same remaining integrity percentage produces a timed draw", () => {
  const sim = new Simulation({ ...DEFAULT_LOADOUT, shell: "armored" });
  sim.reset();
  sim.state = "playing";
  sim.ai.update = () => idle;
  sim.elapsed = CONFIG.match.seconds;
  sim.robots[0].hp = 55;
  sim.robots[1].hp = 50;
  sim.update(step, idle);
  assert.equal(sim.winner, -1);
  assert.equal(sim.resultReason, "time");
});
test("HUD focus cannot steal Space, while garage buttons and native volume arrows still work", (t) => {
  const descriptors = {
      window: Object.getOwnPropertyDescriptor(globalThis, "window"),
      navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    },
    handlers = {};
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener: (key, fn) => (handlers[key] = fn) },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  t.after(() => {
    for (const [key, value] of Object.entries(descriptors)) {
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
    }
  });
  let state = "playing",
    clicks = 0;
  const input = new Input(
      () => {},
      () => {},
      () => state,
    ),
    button = { click: () => clicks++ };
  const key = (code, target) =>
    handlers.keydown({ code, target, repeat: false, preventDefault() {} });
  key("Space", { closest: () => button, matches: () => false });
  assert.ok(input.poll().attack);
  assert.equal(clicks, 0);
  handlers.keyup({ code: "Space" });
  key("Space", { type: "range", matches: () => true });
  assert.ok(input.poll().attack);
  handlers.keyup({ code: "Space" });
  key("ArrowRight", { type: "range", matches: () => true });
  assert.equal(input.poll().turn, 0);
  state = "garage";
  key("Space", { closest: () => button, matches: () => false });
  assert.equal(clicks, 1);
  assert.equal(input.poll().attack, false);
  state = "playing";
  key("Space", { matches: () => false });
  handlers.keyup({ code: "Space" });
  assert.equal(
    input.poll().attack,
    true,
    "a short tap survives before a physics step",
  );
  assert.equal(
    input.poll().attack,
    true,
    "render-only frames cannot consume a tap",
  );
  input.consumeAttack();
  assert.equal(input.poll().attack, false);
  key("Space", { matches: () => false });
  handlers.keyup({ code: "Space" });
  input.clear();
  assert.equal(input.poll().attack, false, "pause clears buffered input");
  navigator.getGamepads = () => {
    throw new Error("blocked device API");
  };
  assert.doesNotThrow(() => input.poll());
});
test("a committed heavy strike completes after being hit, so mace cannot permanently cancel hammer", () => {
  const [mace, hammer] = pair("mace", "hammer");
  hammer.attacking = true;
  hammer.attackElapsed = hammer.weapon.windup + 0.01;
  hit(mace, hammer);
  assert.equal(hammer.attacking, true);
  updateAttack(hammer, [mace], 0.2, []);
  assert.ok(mace.hp < 100);
});
test("the actual mace/hammer AI duel lets both robots deal damage", async () => {
  const { RivalAI } = await import("../src/ai.js");
  const { Navigation } = await import("../src/navigation.js");
  const sim = new Simulation(),
    brain = new RivalAI(new Navigation());
  sim.reset();
  sim.state = "playing";
  sim.robots = pair("hammer", "mace");
  for (let i = 0; i < 60 * 30 && sim.state !== "result"; i++)
    sim.update(step, brain.update(sim.robots[0], sim.robots[1], step));
  assert.equal(sim.state, "result");
  assert.ok(sim.robots.every((robot) => robot.damageDealt > 0));
});
