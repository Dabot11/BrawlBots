import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  DEFAULT_LOADOUT,
  WHEELS,
  SHELLS,
  MODULES,
  PAINTS,
  deriveLoadout,
  normalizeLoadout,
  readLoadout,
  saveLoadout,
  STORAGE_KEY,
} from "../src/loadout.js";
import { createRobot, drive } from "../src/robots.js";
import { startAttack, updateAttack } from "../src/weapons.js";
import { Simulation } from "../src/simulation.js";
import { CONFIG } from "../src/config.js";
import { RivalAI } from "../src/ai.js";
import { Navigation } from "../src/navigation.js";
const step = CONFIG.simulation.step;
const idle = { throttle: 0, turn: 0, attack: false };
function robot(loadout, id = 0) {
  return createRobot(id, undefined, loadout.weapon, loadout);
}
function hit(attacker, defender) {
  attacker.x = defender.x = -12;
  attacker.z = 8;
  defender.z = 5.2;
  attacker.angle = 0;
  defender.angle = Math.PI;
  const events = [];
  startAttack(attacker, events);
  updateAttack(attacker, [defender], 0.7, events);
  return events;
}
const builds = CATEGORIES.filter((slot) => slot.id !== "paint").reduce(
  (items, slot) =>
    items.flatMap((build) =>
      Object.keys(slot.catalog).map((id) => ({ ...build, [slot.id]: id })),
    ),
  [{}],
);
test("all 360 assemblies stay within combat bounds, and paint never changes power", () => {
  assert.equal(builds.length, 360);
  for (const build of builds) {
    const { stats, weapon, dps } = deriveLoadout(build);
    assert.ok(stats.health >= 85 && stats.health <= 110);
    assert.ok(stats.speed >= 4.7 && stats.speed <= 10.1);
    assert.ok(stats.turnSpeed >= 1.5 && stats.turnSpeed <= 3.6);
    assert.ok(stats.frontArmor <= 0.42 && stats.armor <= 0.08);
    assert.ok(dps >= 6 && dps <= 27);
    assert.ok(weapon.reach <= 2 && weapon.duration < weapon.interval);
    assert.equal(stats.radius, 1.35);
    for (const paint of Object.keys(PAINTS)) {
      const painted = deriveLoadout({ ...build, paint });
      assert.deepEqual(painted.stats, stats);
      assert.deepEqual(painted.weapon, weapon);
    }
  }
});
test("every specialized wheel, shell and auxiliary has a measurable advantage and a cost", () => {
  const metrics = (b) => [
    b.stats.health / (1 - b.stats.armor),
    b.stats.speed,
    b.stats.turnSpeed,
    b.stats.acceleration,
    b.dps,
    b.stats.frontArmor,
    -b.stats.stability,
    -b.stats.recovery,
  ];
  const base = metrics(deriveLoadout(DEFAULT_LOADOUT));
  for (const [slot, catalog] of [
    ["wheels", WHEELS],
    ["shell", SHELLS],
    ["module", MODULES],
  ]) {
    for (const id of Object.keys(catalog)) {
      if (id === DEFAULT_LOADOUT[slot]) continue;
      const result = metrics(deriveLoadout({ ...DEFAULT_LOADOUT, [slot]: id }));
      assert.ok(
        result.some((value, i) => value > base[i] + 0.001),
        `${slot}/${id}: needs a benefit`,
      );
      assert.ok(
        result.some((value, i) => value < base[i] - 0.001),
        `${slot}/${id}: needs a cost`,
      );
    }
  }
});
test("motor and agility pieces change actual driving, and armor trades speed for durability", () => {
  const base = robot(DEFAULT_LOADOUT),
    fast = robot({
      ...DEFAULT_LOADOUT,
      wheels: "road",
      shell: "light",
      module: "motor",
    }),
    agile = robot({ ...DEFAULT_LOADOUT, wheels: "agile", shell: "light" }),
    heavy = robot({ ...DEFAULT_LOADOUT, shell: "armored" });
  for (const b of [base, fast, agile, heavy]) {
    b.x = -12;
    b.z = 8;
    b.angle = 0;
    for (let i = 0; i < 60; i++) drive(b, { throttle: 1, turn: 0 }, step);
  }
  assert.ok(fast.z < base.z);
  assert.ok(heavy.z > base.z);
  drive(base, { throttle: 0, turn: 1 }, 0.2);
  drive(agile, { throttle: 0, turn: 1 }, 0.2);
  assert.ok(agile.angle > base.angle);
  assert.ok(heavy.health > base.health);
});
test("actuator increases real hit damage, motor sacrifices it, and shield protects only the front", () => {
  const normal = robot(DEFAULT_LOADOUT),
    power = robot({ ...DEFAULT_LOADOUT, module: "actuator" }),
    speed = robot({ ...DEFAULT_LOADOUT, module: "motor" });
  const a = robot(DEFAULT_LOADOUT, 1),
    b = robot(DEFAULT_LOADOUT, 1),
    c = robot(DEFAULT_LOADOUT, 1);
  hit(normal, a);
  hit(power, b);
  hit(speed, c);
  assert.ok(b.hp < a.hp && a.hp < c.hp);
  const guarded = robot(
      { ...DEFAULT_LOADOUT, shell: "armored", module: "shield" },
      1,
    ),
    open = robot({ ...DEFAULT_LOADOUT, shell: "armored", module: "shield" }, 1);
  hit(robot(DEFAULT_LOADOUT), guarded);
  const attacker = robot(DEFAULT_LOADOUT);
  attacker.x = open.x = -12;
  attacker.z = 8;
  open.z = 5.2;
  open.angle = attacker.angle = 0;
  startAttack(attacker, []);
  updateAttack(attacker, [open], 0.7, []);
  assert.ok(guarded.hp > open.hp);
});
test("grip resists knockback and stabilizer shortens actual flips and interruptions", () => {
  const plain = robot(DEFAULT_LOADOUT, 1),
    grip = robot({ ...DEFAULT_LOADOUT, wheels: "grip" }, 1);
  hit(robot(DEFAULT_LOADOUT), plain);
  hit(robot(DEFAULT_LOADOUT), grip);
  assert.ok(Math.abs(grip.impulseZ) < Math.abs(plain.impulseZ));
  const normal = robot(DEFAULT_LOADOUT, 1),
    stable = robot({ ...DEFAULT_LOADOUT, module: "stabilizer" }, 1);
  hit(robot({ ...DEFAULT_LOADOUT, weapon: "wedge" }), normal);
  hit(robot({ ...DEFAULT_LOADOUT, weapon: "wedge" }), stable);
  assert.ok(stable.flipTime < normal.flipTime && stable.stun < normal.stun);
  for (let i = 0; i < 45; i++) {
    drive(normal, idle, step);
    drive(stable, idle, step);
  }
  assert.equal(stable.flipTime, 0);
  assert.ok(normal.flipTime > 0);
});
test("garage freezes combat, locks during a duel and preserves the full assembly through restart", () => {
  const sim = new Simulation();
  assert.ok(sim.garage());
  for (const [slot, id] of Object.entries({
    weapon: "wedge",
    wheels: "grip",
    shell: "armored",
    module: "stabilizer",
    paint: "blue",
  }))
    assert.ok(sim.selectPart(slot, id));
  const snapshot = JSON.stringify(sim.robots);
  sim.update(10, { throttle: 1, turn: 1, attack: true });
  assert.equal(JSON.stringify(sim.robots), snapshot);
  assert.equal(sim.selectPart("shell", "__proto__"), false);
  const build = { ...sim.loadout };
  sim.reset();
  assert.deepEqual(sim.robots[0].loadout, build);
  assert.equal(sim.robots[0].hp, 110);
  assert.equal(sim.selectPart("wheels", "agile"), false);
  sim.pause();
  assert.equal(sim.selectPart("module", "motor"), false);
  sim.home();
  assert.deepEqual(sim.loadout, build);
});
test("saved builds survive reload; corrupt, unavailable and obsolete storage fall back safely", () => {
  const data = new Map(),
    storage = {
      getItem: (key) => data.get(key) || null,
      setItem: (key, value) => data.set(key, value),
    };
  const build = {
    ...DEFAULT_LOADOUT,
    weapon: "mace",
    shell: "light",
    paint: "pink",
  };
  assert.ok(saveLoadout(storage, build));
  assert.deepEqual(readLoadout(storage), build);
  data.set(STORAGE_KEY, "bad JSON");
  assert.deepEqual(readLoadout(storage), DEFAULT_LOADOUT);
  data.set(
    STORAGE_KEY,
    JSON.stringify({
      weapon: "cannon",
      wheels: "__proto__",
      shell: "light",
      paint: "missing",
      injected: 1000,
    }),
  );
  assert.deepEqual(readLoadout(storage), {
    ...DEFAULT_LOADOUT,
    shell: "light",
  });
  assert.deepEqual(normalizeLoadout(null), DEFAULT_LOADOUT);
  assert.deepEqual(readLoadout(undefined), DEFAULT_LOADOUT);
  assert.equal(saveLoadout(undefined, build), false);
});
test("slow armor and fast lightweight builds still navigate and finish real AI duels", () => {
  for (const build of [
    {
      ...DEFAULT_LOADOUT,
      weapon: "wedge",
      wheels: "grip",
      shell: "armored",
      module: "shield",
    },
    {
      ...DEFAULT_LOADOUT,
      weapon: "spike",
      wheels: "road",
      shell: "light",
      module: "motor",
    },
    { ...DEFAULT_LOADOUT, weapon: "mace", wheels: "agile", module: "actuator" },
  ]) {
    const sim = new Simulation(build),
      playerAI = new RivalAI(new Navigation());
    sim.reset();
    for (let i = 0; i < 60 * 100 && sim.state !== "result"; i++) {
      sim.update(step, playerAI.update(sim.robots[0], sim.robots[1], step));
      sim.drainEvents();
    }
    assert.equal(sim.state, "result", JSON.stringify(build));
    assert.ok(sim.elapsed > 1);
  }
});
test("simultaneous mechanical strikes resolve together, including a double knockout", () => {
  const sim = new Simulation();
  sim.reset();
  sim.state = "playing";
  sim.robots = [robot(DEFAULT_LOADOUT), robot(DEFAULT_LOADOUT, 1)];
  const [a, b] = sim.robots;
  a.x = b.x = -12;
  a.z = 8;
  b.z = 5.2;
  a.angle = 0;
  b.angle = Math.PI;
  const events = [];
  startAttack(a, events);
  startAttack(b, events);
  a.attackElapsed = b.attackElapsed = a.weapon.hitTime - step * 0.5;
  sim.ai.update = () => idle;
  sim.update(step, idle);
  assert.equal(a.hp, 76);
  assert.equal(b.hp, 76);
  sim.reset();
  sim.state = "playing";
  sim.robots = [robot(DEFAULT_LOADOUT), robot(DEFAULT_LOADOUT, 1)];
  const [c, d] = sim.robots;
  c.x = d.x = -12;
  c.z = 8;
  d.z = 5.2;
  c.angle = 0;
  d.angle = Math.PI;
  c.hp = d.hp = 20;
  startAttack(c, []);
  startAttack(d, []);
  c.attackElapsed = d.attackElapsed = c.weapon.hitTime - step * 0.5;
  sim.update(step, idle);
  assert.equal(c.hp, 0);
  assert.equal(d.hp, 0);
  assert.equal(sim.winner, -1);
  assert.equal(sim.state, "result");
});
test("saw sustains contact through stun, but a flip still disables the blade", () => {
  const saw = robot({ ...DEFAULT_LOADOUT, weapon: "saw" }),
    target = robot(DEFAULT_LOADOUT, 1);
  saw.x = target.x = -12;
  saw.z = 8;
  target.z = 5.2;
  saw.angle = 0;
  target.angle = Math.PI;
  saw.stun = 0.3;
  assert.ok(startAttack(saw, []));
  updateAttack(saw, [target], 0.1, []);
  assert.equal(target.hp, 93);
  saw.attacking = false;
  saw.cooldown = 0;
  saw.flipTime = 0.5;
  assert.equal(startAttack(saw, []), false);
  const hammer = robot(DEFAULT_LOADOUT);
  hammer.stun = 0.3;
  assert.equal(startAttack(hammer, []), false);
});
