import { CONFIG } from "./config.js";

// Position follows smoothly; viewing direction stays bound to vehicle heading.
export class ChaseCamera {
  constructor(settings = CONFIG.camera) {
    this.settings = settings;
    this.anchor = null;
  }
  reset(robot) {
    this.anchor = { x: robot.x, z: robot.z };
  }
  update(robot, dt, rear = false, aspect = 1.6) {
    if (!this.anchor) this.reset(robot);
    const smoothing = 1 - Math.exp(-this.settings.smoothing * dt);
    this.anchor.x += (robot.x - this.anchor.x) * smoothing;
    this.anchor.z += (robot.z - this.anchor.z) * smoothing;
    const angle = robot.angle + (rear ? Math.PI : 0);
    const x = Math.sin(angle),
      z = -Math.cos(angle);
    const zoom = aspect < 1.25 ? Math.min(1.6, 1.25 / aspect) : 1;
    return {
      position: {
        x: this.anchor.x - x * this.settings.distance * zoom,
        y: this.settings.height * zoom,
        z: this.anchor.z - z * this.settings.distance * zoom,
      },
      target: {
        x: this.anchor.x + x * this.settings.lookAhead,
        y: this.settings.targetHeight,
        z: this.anchor.z + z * this.settings.lookAhead,
      },
    };
  }
}
