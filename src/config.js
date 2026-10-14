// World units are metres; angles are radians. Forward is local -Z.
export const CONFIG = {
  simulation: { step: 1 / 60, maxFrame: 0.1 },
  arena: { halfWidth: 17, halfDepth: 14 },
  camera: {
    height: 7.8,
    distance: 9.6,
    lookAhead: 3.5,
    targetHeight: 0.7,
    fov: 58,
    smoothing: 10,
    home: { height: 23, distance: 16, fov: 48 },
  },
  input: { deadzone: 0.18 },
  ai: {
    reaction: 0.22,
    repath: 0.55,
    approachSpeed: 0.76,
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

// Reach is measured from the chassis centre to the mechanical striking edge.
export const WEAPONS = Object.freeze({
  spike: {
    name: "Pico",
    description: "Estocada precisa y un pequeño impulso frontal.",
    damage: 18,
    reach: 1.8,
    arc: 0.45,
    interval: 0.85,
    windup: 0.12,
    hitTime: 0.18,
    activeTime: 0.13,
    duration: 0.4,
    knockback: 3,
    stun: 0.1,
    lunge: 2.3,
  },
  forks: {
    name: "Picos dobles",
    description: "Dos puntas: menos precisión, más oportunidades de contacto.",
    damage: 16,
    reach: 1.9,
    arc: 0.8,
    interval: 0.8,
    windup: 0.1,
    hitTime: 0.16,
    activeTime: 0.14,
    duration: 0.38,
    knockback: 2.5,
    stun: 0.1,
    lunge: 1.6,
  },
  mace: {
    name: "Mazo",
    description: "Golpe lateral amplio para empujar al rival.",
    damage: 20,
    reach: 1.85,
    arc: 1.0,
    interval: 1.15,
    windup: 0.22,
    hitTime: 0.33,
    activeTime: 0.14,
    duration: 0.58,
    knockback: 6,
    stun: 0.25,
  },
  hammer: {
    name: "Martillo",
    description: "Golpe pesado desde arriba que interrumpe al rival.",
    damage: 24,
    reach: 1.95,
    arc: 0.65,
    interval: 1.25,
    windup: 0.24,
    hitTime: 0.36,
    activeTime: 0.14,
    duration: 0.62,
    knockback: 4.5,
    stun: 0.3,
  },
  saw: {
    name: "Sierra",
    steady: true,
    description: "Mantén el ataque para cortar a corta distancia.",
    damage: 6,
    reach: 1.7,
    arc: 0.65,
    interval: 0.3,
    windup: 0.03,
    hitTime: 0.05,
    activeTime: 0.15,
    duration: 0.21,
    knockback: 0.6,
    stun: 0,
  },
  wedge: {
    name: "Cuña volteadora",
    description: "Blindaje frontal y una pala que vuelca e interrumpe.",
    damage: 12,
    reach: 1.6,
    arc: 0.8,
    interval: 1.65,
    windup: 0.14,
    hitTime: 0.25,
    activeTime: 0.14,
    duration: 0.58,
    knockback: 3.5,
    stun: 1.0,
    flip: 1.0,
    frontArmor: 0.25,
    stability: 0.6,
  },
});
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));

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
