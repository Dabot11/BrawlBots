import { CONFIG, OBSTACLES, ROBOT } from "./config.js";
import { positionFree, lineClear } from "./collision.js";

export class Navigation {
  constructor(obstacles = OBSTACLES, radius = ROBOT.radius + 0.2) {
    this.obstacles = obstacles;
    this.radius = radius;
    this.spacing = 1;
    this.width = CONFIG.arena.halfWidth * 2 + 1;
    this.depth = CONFIG.arena.halfDepth * 2 + 1;
    this.nodes = Array.from({ length: this.width * this.depth }, (_, id) => {
      const x = (id % this.width) - CONFIG.arena.halfWidth;
      const z = Math.floor(id / this.width) - CONFIG.arena.halfDepth;
      return { id, x, z, free: positionFree(x, z, radius, obstacles) };
    });
  }

  nearest(point) {
    let closest = null,
      best = Infinity;
    for (const node of this.nodes) {
      const distance = (node.x - point.x) ** 2 + (node.z - point.z) ** 2;
      if (node.free && distance < best) {
        best = distance;
        closest = node;
      }
    }
    return closest;
  }

  findPath(from, to) {
    if (lineClear(from, to, this.radius, this.obstacles))
      return [{ x: to.x, z: to.z }];
    const start = this.nearest(from),
      goal = this.nearest(to);
    if (!start || !goal) return [];
    const open = [start.id],
      parents = new Map(),
      scores = new Map([[start.id, 0]]);
    const costs = new Map([
      [start.id, Math.hypot(start.x - goal.x, start.z - goal.z)],
    ]);
    const closed = new Set();
    while (open.length) {
      open.sort((a, b) => costs.get(a) - costs.get(b));
      const id = open.shift(),
        current = this.nodes[id];
      if (id === goal.id) {
        const path = [goal];
        let cursor = id;
        while (parents.has(cursor)) {
          cursor = parents.get(cursor);
          path.unshift(this.nodes[cursor]);
        }
        path.shift();
        // Collapse only segments with clearance for the complete chassis.
        const smooth = [];
        let anchor = from,
          index = 0;
        while (index < path.length) {
          let end = index;
          while (
            end + 1 < path.length &&
            lineClear(anchor, path[end + 1], this.radius, this.obstacles)
          )
            end++;
          smooth.push({ x: path[end].x, z: path[end].z });
          anchor = path[end];
          index = end + 1;
        }
        if (lineClear(anchor, to, this.radius, this.obstacles))
          smooth.push({ x: to.x, z: to.z });
        return smooth;
      }
      closed.add(id);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const nx = current.x + dx,
          nz = current.z + dz;
        if (
          Math.abs(nx) > CONFIG.arena.halfWidth ||
          Math.abs(nz) > CONFIG.arena.halfDepth
        )
          continue;
        const next =
          this.nodes[
            (nz + CONFIG.arena.halfDepth) * this.width +
              nx +
              CONFIG.arena.halfWidth
          ];
        if (
          !next.free ||
          closed.has(next.id) ||
          !lineClear(current, next, this.radius, this.obstacles)
        )
          continue;
        const g = scores.get(id) + Math.hypot(dx, dz);
        if (g < (scores.get(next.id) ?? Infinity)) {
          parents.set(next.id, id);
          scores.set(next.id, g);
          costs.set(next.id, g + Math.hypot(next.x - goal.x, next.z - goal.z));
          if (!open.includes(next.id)) open.push(next.id);
        }
      }
    }
    return [];
  }
}
