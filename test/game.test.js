import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG,
  OBSTACLES,
  ROBOT,
  WEAPONS,
  WEAPON_IDS,
  heading,
  angleDifference,
} from "../src/config.js";
import {
  moveCircle,
  positionFree,
  lineClear,
  separateRobots,
} from "../src/collision.js";
import { Navigation } from "../src/navigation.js";
import { createRobot, drive } from "../src/robots.js";
import { canReach, startAttack, updateAttack } from "../src/weapons.js";
import { Simulation } from "../src/simulation.js";
import { ChaseCamera } from "../src/camera.js";
import { Input } from "../src/input.js";

const idle = { throttle: 0, turn: 0, attack: false, rear: false };
const step = CONFIG.simulation.step;
function pair(weapon = "hammer", defender = "saw") {
  const a = createRobot(0, undefined, weapon),
    b = createRobot(1, undefined, defender);
  a.x = b.x = -12;
  a.z = 8;
  b.z = 5.2;
  a.angle = 0;
  b.angle = Math.PI;
  return [a, b];
}
function strike(a, b, dt = 0.7) {
  const events = [];
  startAttack(a, events);
  updateAttack(a, [a, b], dt, events);
  return events;
}

test("both starting bays are separated and clear of obstacles", () => {
  const [a, b] = new Simulation().robots;
  assert.ok(positionFree(a.x, a.z, a.radius));
  assert.ok(positionFree(b.x, b.z, b.radius));
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 20);
});
test("vehicle turns while stopped, advances in its heading and reverses", () => {
  const [a] = pair();
  const x = a.x,
    z = a.z;
  drive(a, { throttle: 0, turn: 1 }, 0.2);
  assert.equal(a.x, x);
  assert.equal(a.z, z);
  assert.ok(a.angle > 0);
  a.angle = Math.PI / 2;
  drive(a, { throttle: 1, turn: 0 }, 0.2);
  assert.ok(a.x > x);
  const forward = a.x;
  for (let i = 0; i < 60; i++) drive(a, { throttle: -1, turn: 0 }, step);
  assert.ok(a.x < forward);
  assert.ok(Math.abs(a.speedNow) <= ROBOT.reverseSpeed);
});
test("walls and cover stop the chassis and permit backing away", () => {
  const a = createRobot(0);
  a.x = -16;
  a.z = 10;
  moveCircle(a, -100, 0);
  assert.equal(a.x, -17 + a.radius);
  const box = OBSTACLES[0];
  a.x = box.x;
  a.z = box.z + box.hz + a.radius + 0.1;
  const before = a.z;
  moveCircle(a, 0, -20);
  assert.ok(a.z >= box.z + box.hz + a.radius - 0.001);
  assert.ok(positionFree(a.x, a.z, a.radius));
  moveCircle(a, 0, 2);
  assert.ok(a.z > before);
});
test("robot contact separates both chassis beside a wall", () => {
  const [a, b] = pair();
  a.x = -15.65;
  a.z = 10;
  b.x = -14;
  b.z = 10;
  separateRobots(a, b);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius - 0.001);
  assert.ok(positionFree(a.x, a.z, a.radius));
  assert.ok(positionFree(b.x, b.z, b.radius));
});
for (const id of WEAPON_IDS)
  test(`${id}: mechanical attack damages only at close range`, () => {
    const [a, b] = pair(id);
    b.z = -3;
    strike(a, b);
    assert.equal(b.hp, 100);
    a.cooldown = 0;
    b.z = 5.2;
    const events = strike(a, b);
    assert.equal(b.hp, 100 - WEAPONS[id].damage);
    assert.equal(a.hp, 100);
    assert.equal(events.filter((e) => e.type === "damage").length, 1);
    assert.ok(!("bullets" in new Simulation()));
  });
test("attacks have windup, hit once per swing and never hit behind or self", () => {
  const [a, b] = pair(),
    events = [];
  startAttack(a, events);
  updateAttack(a, [a, b], WEAPONS.hammer.hitTime - 0.001, events);
  assert.equal(b.hp, 100);
  updateAttack(a, [a, b], 0.002, events);
  assert.equal(b.hp, 76);
  updateAttack(a, [a, b], 0.18, events);
  assert.equal(b.hp, 76);
  assert.equal(a.hp, 100);
  a.attacking = false;
  a.cooldown = 0;
  b.z = 10.8;
  strike(a, b);
  assert.equal(b.hp, 76);
});
test("cover blocks close mechanical contact and coarse steps cannot skip the hit window", () => {
  const [a, b] = pair();
  a.x = 0;
  a.z = 0.9;
  b.x = 0;
  b.z = -3.9;
  const extended = { ...WEAPONS.hammer, reach: 5 };
  assert.equal(canReach(a, b, extended), false);
  assert.equal(lineClear(a, b, 0.08), false);
  const [c, d] = pair();
  strike(c, d, 0.9);
  assert.equal(d.hp, 76);
});
test("held attack obeys recovery time", () => {
  const [a, b] = pair(),
    events = [];
  let starts = 0;
  for (let i = 0; i < 180; i++) {
    if (startAttack(a, events)) starts++;
    updateAttack(a, [b], step, events);
  }
  assert.equal(starts, 3);
  assert.ok(a.cooldown > 0);
  assert.equal(startAttack(a, events), false);
});
test("wedge deflects frontal damage but leaves the back vulnerable", () => {
  const [a, b] = pair("hammer", "wedge");
  strike(a, b);
  assert.equal(b.hp, 82);
  const [c, d] = pair("hammer", "wedge");
  d.angle = 0;
  strike(c, d);
  assert.equal(d.hp, 76);
});
test("lifter rolls and interrupts a rival, which recovers automatically", () => {
  const [a, b] = pair("wedge");
  b.attacking = true;
  strike(a, b);
  assert.ok(b.flipTime > 0);
  assert.ok(b.stun > 0);
  assert.equal(b.attacking, false);
  const angle = b.angle;
  drive(b, { throttle: 1, turn: 1 }, 0.2);
  assert.equal(b.angle, angle);
  assert.equal(b.speedNow, 0);
  while (b.flipTime > 0) drive(b, idle, step);
  drive(b, { throttle: 1, turn: 1 }, 0.1);
  assert.ok(b.angle > angle);
  assert.ok(b.speedNow > 0);
});
test("impact forces do not move a robot through the arena wall", () => {
  const [a, b] = pair();
  b.z = -14 + b.radius;
  a.z = b.z + 2.8;
  strike(a, b);
  for (let i = 0; i < 120; i++) drive(b, idle, step);
  assert.ok(positionFree(b.x, b.z, b.radius));
  assert.ok(b.z >= -14 + b.radius);
});
test("A* routes around cover with chassis clearance", () => {
  const nav = new Navigation(),
    from = { x: 0, z: 5 },
    to = { x: 0, z: -8 };
  assert.equal(lineClear(from, to, ROBOT.radius), false);
  const path = nav.findPath(from, to);
  assert.ok(path.length >= 2);
  let last = from;
  for (const point of path) {
    assert.ok(positionFree(point.x, point.z, ROBOT.radius));
    assert.ok(lineClear(last, point, nav.radius));
    last = point;
  }
  assert.ok(Math.hypot(last.x - to.x, last.z - to.z) < 1.5);
});
test("AI approaches, navigates, and can only cause damage within melee reach", () => {
  const sim = new Simulation();
  sim.state = "playing";
  let travelled = 0,
    hits = 0;
  for (let i = 0; i < 60 * 120 && sim.state === "playing"; i++) {
    const before = { ...sim.robots[1] };
    sim.update(step, idle);
    travelled += Math.hypot(
      before.x - sim.robots[1].x,
      before.z - sim.robots[1].z,
    );
    for (const event of sim.drainEvents())
      if (event.type === "damage" && event.owner === 1) {
        hits++;
        assert.ok(
          Math.hypot(
            sim.robots[1].x - sim.robots[0].x,
            sim.robots[1].z - sim.robots[0].z,
          ) <=
            WEAPONS.saw.reach + ROBOT.radius + 0.001,
        );
      }
    assert.ok(positionFree(sim.robots[1].x, sim.robots[1].z, ROBOT.radius));
  }
  assert.ok(travelled > 10);
  assert.ok(hits > 0);
  assert.equal(sim.state, "result");
  assert.equal(sim.winner, 1);
  assert.ok(sim.elapsed > 8);
});
test("AI reaches opponents at eight arena positions and recovers from blocked motion", () => {
  for (const [x, z] of [
    [-10, 8],
    [-12, -10],
    [12, 10],
    [0, 10],
    [-2, 3],
    [4, -5],
    [14, 0],
    [0, -10],
  ]) {
    const sim = new Simulation();
    sim.state = "playing";
    sim.robots[0].x = x;
    sim.robots[0].z = z;
    for (let i = 0; i < 60 * 60 && sim.state === "playing"; i++) {
      sim.update(step, idle);
      sim.drainEvents();
    }
    assert.equal(sim.state, "result", `${x},${z}`);
    assert.equal(sim.winner, 1);
  }
  const sim = new Simulation();
  sim.ai.command = { throttle: 1, turn: 0, attack: false };
  sim.ai.reaction = 100;
  for (let i = 0; i < 60; i++)
    sim.ai.update(sim.robots[1], sim.robots[0], step);
  assert.ok(sim.ai.recoveryCount > 0);
  assert.ok(sim.ai.command.throttle < 0);
});
for (const winner of [0, 1])
  test(`complete melee match: ${winner === 0 ? "victory" : "defeat"} and clean reset`, () => {
    const sim = new Simulation();
    sim.state = "playing";
    const attacker = sim.robots[winner],
      target = sim.robots[1 - winner];
    attacker.x = target.x = -12;
    attacker.z = 8;
    target.z = 5.2;
    attacker.angle = 0;
    target.angle = 0;
    sim.ai.update = () =>
      winner === 1 ? { throttle: 0.5, turn: 0, attack: true } : idle;
    for (let i = 0; i < 60 * 40 && sim.state === "playing"; i++)
      sim.update(
        step,
        winner === 0 ? { throttle: 0.5, turn: 0, attack: true } : idle,
      );
    assert.equal(sim.state, "result");
    assert.equal(sim.winner, winner);
    assert.equal(target.hp, 0);
    const elapsed = sim.elapsed;
    sim.update(1, { throttle: 1, turn: 1, attack: true });
    assert.equal(sim.elapsed, elapsed);
    sim.reset();
    assert.equal(sim.robots.length, 2);
    assert.equal(sim.events.length, 0);
    assert.ok(
      sim.robots.every(
        (r) =>
          r.hp === 100 &&
          !r.attacking &&
          r.stun === 0 &&
          r.flipTime === 0 &&
          r.impulseX === 0 &&
          r.impulseZ === 0,
      ),
    );
  });
test("weapon selection works only at home and persists through restart", () => {
  const sim = new Simulation();
  assert.ok(sim.selectWeapon("wedge"));
  sim.reset();
  assert.equal(sim.robots[0].weaponId, "wedge");
  assert.equal(sim.selectWeapon("saw"), false);
  sim.home();
  assert.equal(sim.selectWeapon("invalid"), false);
  assert.equal(sim.playerWeapon, "wedge");
});
test("countdown and pause freeze attacks, damage, flip and timers", () => {
  const sim = new Simulation();
  sim.reset();
  const x = sim.robots[0].x;
  sim.update(0.5, { throttle: 1, turn: 1, attack: true });
  assert.equal(sim.robots[0].x, x);
  assert.equal(sim.robots[0].attacking, false);
  sim.pause();
  const count = sim.countdown;
  sim.update(100, { throttle: 1, attack: true });
  assert.equal(sim.countdown, count);
  sim.resume();
  while (sim.state === "countdown") sim.update(step, idle);
  sim.robots[0].flipTime = sim.robots[0].stun = 1;
  sim.pause();
  const snapshot = JSON.stringify(sim.robots);
  sim.update(100, { throttle: 1, turn: 1, attack: true });
  assert.equal(JSON.stringify(sim.robots), snapshot);
  assert.equal(sim.elapsed, 0);
  sim.resume();
  sim.update(step, idle);
  assert.ok(sim.elapsed > 0);
  assert.ok(sim.robots[0].flipTime < 1);
});
test("camera remains behind and looks forward at every robot heading", () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 3.13, 3.15, 15]) {
    const robot = { x: 14, z: -12, angle },
      camera = new ChaseCamera();
    const frame = camera.update(robot, step);
    const fx = Math.sin(angle),
      fz = -Math.cos(angle);
    assert.ok(
      (frame.position.x - robot.x) * fx + (frame.position.z - robot.z) * fz < 0,
    );
    assert.ok(
      (frame.target.x - robot.x) * fx + (frame.target.z - robot.z) * fz > 0,
    );
    assert.ok(frame.position.y > frame.target.y);
  }
});
test("rear camera reverses the view without changing the robot or controls", () => {
  const robot = { x: 0, z: 0, angle: 0.7 },
    camera = new ChaseCamera();
  const before = JSON.stringify(robot),
    front = camera.update(robot, step),
    rear = camera.update(robot, step, true);
  assert.ok(Math.abs(front.position.x + rear.position.x) < 1e-8);
  assert.ok(Math.abs(front.position.z + rear.position.z) < 1e-8);
  assert.equal(JSON.stringify(robot), before);
  assert.deepEqual(camera.update(robot, step), front);
});
test("camera smooths position, preserves vehicle orientation and adjusts aspect", () => {
  const camera = new ChaseCamera();
  camera.update({ x: 0, z: 0, angle: 0 }, step);
  const frame = camera.update({ x: 5, z: 0, angle: Math.PI / 2 }, step);
  assert.ok(camera.anchor.x > 0 && camera.anchor.x < 5);
  assert.ok(Math.abs(frame.position.z - frame.target.z) < 1e-8);
  const wide = new ChaseCamera().update(
      { x: 0, z: 0, angle: 0 },
      step,
      false,
      1.6,
    ),
    narrow = new ChaseCamera().update(
      { x: 0, z: 0, angle: 0 },
      step,
      false,
      0.8,
    );
  assert.ok(narrow.position.y > wide.position.y);
  assert.ok(narrow.position.z > wide.position.z);
});
test("keyboard P pauses once; C is a held rear view; controller uses RT and RS", (t) => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "window",
    ),
    navDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const handlers = {},
    actions = [];
  let pad = null;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: (name, callback) => (handlers[name] = callback),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => (pad ? [pad] : []) },
  });
  t.after(() => {
    if (windowDescriptor)
      Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    Object.defineProperty(globalThis, "navigator", navDescriptor);
  });
  const input = new Input(
    (action) => actions.push(action),
    () => {},
  );
  const key = (code, repeat = false) =>
    handlers.keydown({ code, repeat, preventDefault() {} });
  key("KeyP");
  key("KeyP", true);
  assert.deepEqual(actions, ["pause"]);
  handlers.keyup({ code: "KeyP" });
  key("KeyC");
  assert.equal(input.poll().rear, true);
  handlers.keyup({ code: "KeyC" });
  assert.equal(input.poll().rear, false);
  pad = {
    index: 0,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  pad.buttons[7] = { pressed: true, value: 0.8 };
  pad.buttons[11] = { pressed: true, value: 1 };
  assert.ok(input.poll().attack);
  assert.ok(input.poll().rear);
  pad.buttons[9] = { pressed: true, value: 1 };
  input.poll();
  input.poll();
  assert.equal(actions.filter((a) => a === "pause").length, 2);
  pad = null;
  input.poll();
  assert.equal(actions.at(-1), "disconnect");
});
test("fixed timestep matches movement across different frame schedules", () => {
  function run(frameDt) {
    const [a] = pair();
    let accumulator = 0;
    for (let i = 0; i < Math.round(2 / frameDt); i++) {
      accumulator += frameDt;
      while (accumulator + 1e-9 >= step) {
        drive(a, { throttle: 0.6, turn: 0 }, step);
        accumulator -= step;
      }
    }
    return a;
  }
  assert.ok(Math.abs(run(1 / 30).z - run(1 / 144).z) < 0.001);
});
