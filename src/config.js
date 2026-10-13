// World units are metres; angles are radians. Forward is local -Z.
export const CONFIG = {
  simulation: { step: 1 / 60, maxFrame: 0.1 },
  arena: { halfWidth: 17, halfDepth: 14 },
  camera: {
    height: 23,
    distance: 16,
    fov: 48,
    smoothing: 5,
    followX: 6.5,
    followZ: 4.0,
  },
  input: { deadzone: 0.18 },
  ai: {
    reaction: 0.22,
    repath: 0.55,
    aimAngle: 0.13,
    range: 10,
    preferredRange: 6.5,
  },
  effects: { maxParticles: 160, pixelRatio: 1.75 },
};

export const ROBOT = Object.freeze({
  name: "Remache",
  health: 100,
  radius: 1.35,
  speed: 7.2,
  reverseSpeed: 4.4,
  acceleration: 18,
  braking: 23,
  turnSpeed: 2.65,
});

export const WEAPON = Object.freeze({
  name: "Cañón de pulso",
  damage: 10,
  speed: 25,
  interval: 0.36,
  life: 1.7,
  radius: 0.12,
});

export const OBSTACLES = Object.freeze([
  { x: 0, z: -1.5, hx: 2.4, hz: 1.2, height: 1.6, kind: "container" },
  { x: -6.5, z: 3, hx: 1.5, hz: 1.4, height: 1.7, kind: "crate" },
  { x: 5.5, z: 4.7, hx: 2.1, hz: 0.8, height: 1.4, kind: "barrier" },
  { x: -8, z: -7.3, hx: 1.8, hz: 1.0, height: 1.4, kind: "crate" },
  { x: 8, z: -6.5, hx: 1.25, hz: 1.7, height: 1.5, kind: "container" },
]);

export const SPAWNS = Object.freeze([
  { x: -10, z: 8, angle: Math.PI / 2 },
  { x: 11, z: -9, angle: -Math.PI / 2 },
]);

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const angleDifference = (target, current) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));
export const heading = (from, to) =>
  Math.atan2(to.x - from.x, -(to.z - from.z));
