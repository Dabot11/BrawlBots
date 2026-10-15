import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
const root = resolve(process.argv[2] || "."),
  prefix = pathToFileURL(root + "/");
const { Simulation } = await import(new URL("src/simulation.js", prefix));
const { createRobot } = await import(new URL("src/robots.js", prefix));
const { RivalAI } = await import(new URL("src/ai.js", prefix));
const { Navigation } = await import(new URL("src/navigation.js", prefix));
const { CATEGORIES, DEFAULT_LOADOUT } = await import(
  new URL("src/loadout.js", prefix)
);
const weapons = Object.keys(CATEGORIES[0].catalog),
  builds = CATEGORIES.filter((c) => c.id !== "paint").reduce(
    (a, c) =>
      a.flatMap((b) =>
        Object.keys(c.catalog).map((id) => ({ ...b, [c.id]: id })),
      ),
    [{}],
  );
const idle = { throttle: 0, turn: 0, attack: false };
function duel(build, opponent, swapped, contact = false) {
  const sim = new Simulation(build),
    brain = new RivalAI(new Navigation());
  sim.reset();
  sim.robots[1] = createRobot(1, undefined, opponent.weapon, {
    ...opponent,
    paint: "orange",
  });
  if (contact) {
    const [a, b] = sim.robots;
    a.x = b.x = -12;
    a.z = 8;
    b.z = 5.2;
    a.angle = 0;
    b.angle = Math.PI;
  }
  if (swapped) {
    const [a, b] = sim.robots,
      point = { x: a.x, z: a.z, angle: a.angle };
    Object.assign(a, { x: b.x, z: b.z, angle: b.angle });
    Object.assign(b, point);
  }
  let hits = [0, 0];
  for (let i = 0; i < 60 * 124 && sim.state !== "result"; i++) {
    sim.update(
      1 / 60,
      sim.state === "playing"
        ? brain.update(sim.robots[0], sim.robots[1], 1 / 60)
        : idle,
    );
    for (const e of sim.drainEvents()) if (e.type === "damage") hits[e.owner]++;
  }
  return {
    winner: sim.state === "result" ? sim.winner : null,
    seconds: +sim.elapsed.toFixed(2),
    hits,
    reason: sim.resultReason || "knockout",
  };
}
const matrix = [];
for (const weapon of weapons)
  for (const opponent of weapons)
    for (const swapped of [false, true])
      for (const contact of [false, true])
        matrix.push({
          weapon,
          opponent,
          swapped,
          contact,
          ...duel(
            { ...DEFAULT_LOADOUT, weapon },
            { ...DEFAULT_LOADOUT, weapon: opponent },
            swapped,
            contact,
          ),
        });
const archetypes = [
  { ...DEFAULT_LOADOUT, weapon: "forks", wheels: "agile", shell: "light" },
  {
    ...DEFAULT_LOADOUT,
    weapon: "hammer",
    shell: "armored",
    module: "actuator",
  },
  { ...DEFAULT_LOADOUT, weapon: "wedge", wheels: "grip", module: "stabilizer" },
];
const assemblies = [];
for (const build of builds)
  for (let i = 0; i < archetypes.length; i++)
    for (const swapped of [false, true])
      assemblies.push({
        build,
        opponent: i,
        swapped,
        ...duel(build, archetypes[i], swapped),
      });
const report = {
  method:
    "Same public melee AI and physics for both robots, six-weapon matrix at contact and arena spawns, both spawn assignments; every assembly versus three archetypes. Simulation diagnostic, not human win rates.",
  matrix,
  assemblies,
};
mkdirSync("artifacts", { recursive: true });
const output = process.argv[3] || "artifacts/balance-audit.json";
writeFileSync(output, JSON.stringify(report, null, 2));
const summary = {
  matches: matrix.length + assemblies.length,
  unfinished: [...matrix, ...assemblies].filter((m) => m.winner === null)
    .length,
  zeroDamageAtContact: matrix.filter(
    (m) => m.contact && m.hits.some((h) => h === 0),
  ).length,
  matrix: Object.fromEntries(
    weapons.map((weapon) => {
      const cases = matrix.filter((m) => m.weapon === weapon);
      return [
        weapon,
        {
          wins: cases.filter((m) => m.winner === 0).length,
          draws: cases.filter((m) => m.winner === -1).length,
          matches: cases.length,
        },
      ];
    }),
  ),
};
console.log(JSON.stringify(summary, null, 2));
if (summary.unfinished || summary.zeroDamageAtContact) process.exitCode = 1;
