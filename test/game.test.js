import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG,
  OBSTACLES,
  ROBOT,
  WEAPON,
  heading,
  angleDifference,
} from "../src/config.js";
import {
  moveCircle,
  positionFree,
  lineClear,
  segmentCircle,
  separateRobots,
} from "../src/collision.js";
import { Navigation } from "../src/navigation.js";
import { createRobot, drive } from "../src/robots.js";
import { fire, advanceProjectiles } from "../src/weapons.js";
import { Simulation } from "../src/simulation.js";

const idle = { throttle: 0, turn: 0, fire: false };
const step = CONFIG.simulation.step;

test("both starting bays are separated and clear of obstacles", () => {
  const a = createRobot(0),
    b = createRobot(1);
  assert.ok(positionFree(a.x, a.z, a.radius));
  assert.ok(positionFree(b.x, b.z, b.radius));
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 20);
});

test("vehicle turns while stopped; forward, reverse and firing share the same heading", () => {
  const robot = createRobot(0);
  robot.x = -12;
  robot.z = 8;
  robot.angle = 0;
  drive(robot, { throttle: 0, turn: 1 }, 0.2);
  assert.equal(robot.x, -12);
  assert.equal(robot.z, 8);
  assert.ok(robot.angle > 0);
  robot.angle = Math.PI / 2;
  drive(robot, { throttle: 1, turn: 0 }, 0.2);
  assert.ok(robot.x > -12);
  const bullets = [],
    events = [];
  fire(robot, bullets, events, 1);
  assert.ok(bullets[0].dx > 0.99);
  assert.ok(Math.abs(bullets[0].dz) < 1e-8);
  const x = robot.x;
  for (let i = 0; i < 60; i++) drive(robot, { throttle: -1, turn: 0 }, step);
  assert.ok(robot.x < x);
  assert.ok(Math.abs(robot.speedNow) <= ROBOT.reverseSpeed);
});

test("driving stays inside walls, cannot cross cover, and can reverse away", () => {
  const robot = createRobot(0);
  robot.x = -16;
  robot.z = 10;
  moveCircle(robot, -100, 0);
  assert.equal(robot.x, -CONFIG.arena.halfWidth + robot.radius);
  const b = OBSTACLES[0];
  robot.x = b.x;
  robot.z = b.z + b.hz + robot.radius + 0.1;
  const original = robot.z;
  moveCircle(robot, 0, -20);
  assert.ok(robot.z >= b.z + b.hz + robot.radius - 0.001);
  assert.ok(positionFree(robot.x, robot.z, robot.radius));
  moveCircle(robot, 0, 2);
  assert.ok(robot.z > original);
});

test("robot contact separates both chassis without crossing a wall", () => {
  const a = createRobot(0),
    b = createRobot(1);
  a.x = -15.65;
  a.z = 10;
  b.x = -14;
  b.z = 10;
  separateRobots(a, b);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius - 0.001);
  assert.ok(positionFree(a.x, a.z, a.radius));
  assert.ok(positionFree(b.x, b.z, b.radius));
});

test("swept projectile hits fast targets only once and never damages its owner", () => {
  const owner = createRobot(0),
    target = createRobot(1);
  owner.x = -12;
  owner.z = 8;
  target.x = -12;
  target.z = 3;
  const bullet = { id: 0, owner: 0, x: -12, z: 7, dx: 0, dz: -1, life: 1 };
  const events = [];
  let bullets = advanceProjectiles([bullet], [owner, target], 0.4, events);
  assert.equal(target.hp, 90);
  assert.equal(owner.hp, 100);
  assert.equal(bullets.length, 0);
  bullets = advanceProjectiles(bullets, [owner, target], 0.4, events);
  assert.equal(target.hp, 90);
  assert.notEqual(
    segmentCircle({ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 15, z: 0 }, 1),
    null,
  );
});

test("nearest cover blocks damage, including a muzzle pressed against cover", () => {
  const owner = createRobot(0),
    target = createRobot(1);
  owner.x = 0;
  owner.z = 4;
  target.x = 0;
  target.z = -7;
  const events = [];
  const bullets = advanceProjectiles(
    [{ owner: 0, x: 0, z: 3, dx: 0, dz: -1, life: 2 }],
    [owner, target],
    0.6,
    events,
  );
  assert.equal(bullets.length, 0);
  assert.equal(target.hp, 100);
  assert.equal(events[0].type, "impact");
  owner.z = OBSTACLES[0].z + OBSTACLES[0].hz + owner.radius;
  owner.angle = 0;
  const near = [];
  fire(owner, near, events, 1);
  assert.equal(
    advanceProjectiles(near, [owner, target], 0.6, events).length,
    0,
  );
  assert.equal(target.hp, 100);
});

test("automatic cannon respects cadence; bullets expire and leave the arena", () => {
  const robot = createRobot(0),
    bullets = [],
    events = [];
  fire(robot, bullets, events, 1);
  assert.equal(fire(robot, bullets, events, 2), false);
  assert.equal(bullets.length, 1);
  robot.cooldown = 0;
  assert.equal(fire(robot, bullets, events, 2), true);
  assert.equal(
    advanceProjectiles(
      [{ owner: 0, x: -12, z: 0, dx: 0, dz: 0, life: 0.01 }],
      [],
      0.1,
      events,
    ).length,
    0,
  );
  assert.equal(
    advanceProjectiles(
      [{ owner: 0, x: 16.9, z: 0, dx: 1, dz: 0, life: 1 }],
      [],
      0.1,
      events,
    ).length,
    0,
  );
  assert.equal(robot.cooldown, WEAPON.interval);
});

test("A* routes around cover with chassis clearance", () => {
  const nav = new Navigation(),
    from = { x: 0, z: 5 },
    to = { x: 0, z: -8 };
  assert.equal(lineClear(from, to, ROBOT.radius), false);
  const path = nav.findPath(from, to);
  assert.ok(path.length >= 2);
  let last = from;
  for (const waypoint of path) {
    assert.ok(positionFree(waypoint.x, waypoint.z, ROBOT.radius));
    assert.ok(lineClear(last, waypoint, nav.radius));
    last = waypoint;
  }
  assert.ok(Math.hypot(last.x - to.x, last.z - to.z) < 1.5);
});

test("AI navigates from its spawn, has a clear firing angle and defeats an idle player", () => {
  const sim = new Simulation();
  sim.state = "playing";
  const initial = { ...sim.robots[1] };
  let travelled = 0,
    shots = 0;
  for (let i = 0; i < 60 * 120 && sim.state === "playing"; i++) {
    const before = { ...sim.robots[1] };
    sim.update(step, idle);
    travelled += Math.hypot(
      before.x - sim.robots[1].x,
      before.z - sim.robots[1].z,
    );
    for (const event of sim.drainEvents())
      if (event.type === "fire" && event.owner === 1) {
        shots++;
        assert.ok(lineClear(sim.robots[1], sim.robots[0], 0.15));
        assert.ok(
          Math.abs(
            angleDifference(
              heading(sim.robots[1], sim.robots[0]),
              sim.robots[1].angle,
            ),
          ) < 0.4,
        );
      }
    assert.ok(positionFree(sim.robots[1].x, sim.robots[1].z, ROBOT.radius));
  }
  assert.ok(travelled > 10);
  assert.ok(
    Math.hypot(initial.x - sim.robots[1].x, initial.z - sim.robots[1].z) > 5,
  );
  assert.ok(shots >= 10);
  assert.equal(sim.state, "result");
  assert.equal(sim.winner, 1);
  assert.ok(sim.elapsed > 8);
});

test("AI detects blocked motion and performs a reverse recovery", () => {
  const sim = new Simulation(),
    rival = sim.robots[1];
  sim.ai.command = { throttle: 1, turn: 0, fire: false };
  sim.ai.reaction = 100;
  for (let i = 0; i < 60; i++) sim.ai.update(rival, sim.robots[0], step);
  assert.ok(sim.ai.recoveryCount > 0);
  assert.ok(sim.ai.command.throttle < 0);
  assert.equal(sim.ai.command.fire, false);
});

test("AI reaches stationary opponents in eight positions around the arena", () => {
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
    sim.reset();
    sim.state = "playing";
    sim.robots[0].x = x;
    sim.robots[0].z = z;
    assert.ok(positionFree(x, z, ROBOT.radius));
    for (let i = 0; i < 60 * 45 && sim.state === "playing"; i++) {
      sim.update(step, idle);
      sim.drainEvents();
    }
    assert.equal(sim.state, "result", `opponent at ${x},${z}`);
    assert.equal(sim.winner, 1);
  }
});

for (const winner of [0, 1])
  test(`full match resolves ${winner === 0 ? "victory" : "defeat"} and reset removes previous match state`, () => {
    const sim = new Simulation();
    sim.state = "playing";
    sim.robots[winner].x = -12;
    sim.robots[winner].z = 8;
    sim.robots[winner].angle = 0;
    sim.robots[1 - winner].x = -12;
    sim.robots[1 - winner].z = 1;
    sim.ai.update = () => (winner === 1 ? { ...idle, fire: true } : idle);
    for (let i = 0; i < 60 * 15 && sim.state === "playing"; i++)
      sim.update(step, winner === 0 ? { ...idle, fire: true } : idle);
    assert.equal(sim.state, "result");
    assert.equal(sim.winner, winner);
    assert.equal(sim.robots[1 - winner].hp, 0);
    const elapsed = sim.elapsed;
    sim.update(1, { throttle: 1, turn: 1, fire: true });
    assert.equal(sim.elapsed, elapsed);
    sim.reset();
    assert.equal(sim.state, "countdown");
    assert.equal(sim.robots.length, 2);
    assert.equal(sim.bullets.length, 0);
    assert.equal(sim.events.length, 0);
    assert.equal(sim.nextBullet, 0);
    assert.equal(sim.robots[0].hp, 100);
    assert.equal(sim.robots[1].hp, 100);
  });

test("countdown and pause freeze damage, driving and timers until explicit resume", () => {
  const sim = new Simulation();
  sim.reset();
  const before = { ...sim.robots[0] };
  sim.update(0.5, { throttle: 1, turn: 1, fire: true });
  assert.equal(sim.robots[0].x, before.x);
  assert.equal(sim.bullets.length, 0);
  sim.pause();
  const count = sim.countdown;
  sim.update(100, { throttle: 1, fire: true });
  assert.equal(sim.countdown, count);
  sim.resume();
  assert.equal(sim.state, "countdown");
  while (sim.state === "countdown") sim.update(step, idle);
  assert.equal(sim.state, "playing");
  sim.pause();
  const hp = sim.robots[0].hp;
  sim.update(100, { throttle: 1, turn: 1, fire: true });
  assert.equal(sim.robots[0].hp, hp);
  assert.equal(sim.elapsed, 0);
  sim.resume();
  sim.update(step, idle);
  assert.ok(sim.elapsed > 0);
});

test("fixed timestep produces matching movement across different frame schedules", () => {
  function run(frameDt) {
    const robot = createRobot(0);
    robot.x = -12;
    robot.z = 10;
    robot.angle = 0;
    let accumulator = 0;
    for (let frame = 0; frame < Math.round(2 / frameDt); frame++) {
      accumulator += frameDt;
      while (accumulator + 1e-9 >= step) {
        drive(robot, { throttle: 0.6, turn: 0 }, step);
        accumulator -= step;
      }
    }
    return robot;
  }
  const a = run(1 / 30),
    b = run(1 / 144);
  assert.ok(Math.abs(a.z - b.z) < 0.001);
  assert.ok(Math.abs(a.speedNow - b.speedNow) < 0.001);
});
