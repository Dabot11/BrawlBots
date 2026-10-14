import { ROBOT, WEAPONS, WEAPON_IDS, clamp } from "./config.js";

// Independent slots; every functional upgrade spends mobility, durability or power.
export const WHEELS = Object.freeze({
  standard: {
    name: "Mixtas",
    tag: "VERSÁTILES",
    plus: "Control predecible",
    minus: "Sin especialización",
    speed: 1,
    turn: 1,
    acceleration: 1,
    stability: 1,
  },
  road: {
    name: "Velocidad",
    tag: "RECTAS",
    plus: "+18% velocidad máxima",
    minus: "−16% giro · −15% aceleración",
    speed: 1.18,
    turn: 0.84,
    acceleration: 0.85,
    stability: 1.12,
  },
  agile: {
    name: "Ágiles",
    tag: "ESQUIVAR",
    plus: "+22% giro · +12% aceleración",
    minus: "−12% velocidad máxima",
    speed: 0.88,
    turn: 1.22,
    acceleration: 1.12,
    stability: 1.05,
  },
  grip: {
    name: "Todo terreno",
    tag: "TRACCIÓN",
    plus: "−38% empuje recibido · +8% aceleración",
    minus: "−12% velocidad · −14% giro",
    speed: 0.88,
    turn: 0.86,
    acceleration: 1.08,
    stability: 0.62,
  },
});
export const SHELLS = Object.freeze({
  balanced: {
    name: "Aleación",
    tag: "EQUILIBRADA",
    plus: "100 puntos de integridad",
    minus: "Sin blindaje adicional",
    health: 100,
    armor: 0,
    speed: 1,
    turn: 1,
  },
  light: {
    name: "Ultraligera",
    tag: "MOVILIDAD",
    plus: "+9% velocidad · +10% giro",
    minus: "85 de integridad · sin blindaje",
    health: 85,
    armor: 0,
    speed: 1.09,
    turn: 1.1,
  },
  armored: {
    name: "Acorazada",
    tag: "RESISTENCIA",
    plus: "110 de integridad · 6% blindaje",
    minus: "−10% velocidad · −12% giro",
    health: 110,
    armor: 0.06,
    speed: 0.9,
    turn: 0.88,
  },
});
export const MODULES = Object.freeze({
  none: {
    name: "Sin auxiliar",
    tag: "LIGERO",
    plus: "Conserva toda la movilidad y potencia",
    minus: "Sin ayuda especializada",
    speed: 1,
    turn: 1,
    acceleration: 1,
    damage: 1,
    frontArmor: 0,
    stability: 1,
    recovery: 1,
  },
  motor: {
    name: "Sobremarcha",
    tag: "VELOCIDAD",
    plus: "+10% velocidad · +14% aceleración",
    minus: "−12% daño · −10% giro",
    speed: 1.1,
    turn: 0.9,
    acceleration: 1.14,
    damage: 0.88,
    frontArmor: 0,
    stability: 1,
    recovery: 1,
  },
  actuator: {
    name: "Servo de impacto",
    tag: "POTENCIA",
    plus: "+14% daño por golpe",
    minus: "−8% velocidad · −8% giro",
    speed: 0.92,
    turn: 0.92,
    acceleration: 1,
    damage: 1.14,
    frontArmor: 0,
    stability: 1,
    recovery: 1,
  },
  shield: {
    name: "Defensas",
    tag: "PROTECCIÓN",
    plus: "16% protección en el arco frontal",
    minus: "−6% daño · −6% velocidad · −4% giro",
    speed: 0.94,
    turn: 0.96,
    acceleration: 1,
    damage: 0.94,
    frontArmor: 0.16,
    stability: 1,
    recovery: 1,
  },
  stabilizer: {
    name: "Estabilizador",
    tag: "ANTIVUELCO",
    plus: "−32% duración de interrupciones y vuelcos",
    minus: "−8% daño · −4% velocidad",
    speed: 0.96,
    turn: 1,
    acceleration: 1,
    damage: 0.92,
    frontArmor: 0,
    stability: 0.85,
    recovery: 0.68,
  },
});
export const PAINTS = Object.freeze({
  mint: { name: "Menta", hex: "#62d5b7" },
  orange: { name: "Mandarina", hex: "#eb8544" },
  blue: { name: "Cobalto", hex: "#548be8" },
  pink: { name: "Orquídea", hex: "#cf78b2" },
  cream: { name: "Marfil", hex: "#ddd9b4" },
  red: { name: "Carmín", hex: "#d75b54" },
});
export const WEAPON_TRAITS = Object.freeze({
  spike: {
    tag: "ESTOCADA",
    plus: "Impulso frontal y recuperación rápida",
    minus: "Arco estrecho: exige apuntar",
    speed: 0.98,
    turn: 0.98,
  },
  forks: {
    tag: "CONTACTO",
    plus: "Contacto amplio y rápido",
    minus: "Menos daño por golpe que el pico",
    speed: 0.97,
    turn: 0.97,
  },
  mace: {
    tag: "CONTROL",
    plus: "Barrido amplio y mucho empuje",
    minus: "Preparación lenta · más peso",
    speed: 0.94,
    turn: 0.93,
  },
  hammer: {
    tag: "IMPACTO",
    plus: "Golpe fuerte e interrupción",
    minus: "Recuperación lenta · −8% giro",
    speed: 0.93,
    turn: 0.92,
  },
  saw: {
    tag: "PRESIÓN",
    plus: "Sigue cortando al recibir golpes",
    minus: "Menor alcance y sin interrupción",
    speed: 0.95,
    turn: 0.96,
  },
  wedge: {
    tag: "VUELCO",
    plus: "Vuelca y bloquea 25% del daño frontal",
    minus: "Daño bajo · la herramienta más pesada",
    speed: 0.91,
    turn: 0.9,
  },
});
export const CATEGORIES = Object.freeze([
  {
    id: "weapon",
    name: "Arma",
    label: "01 / HERRAMIENTA",
    catalog: Object.fromEntries(
      WEAPON_IDS.map((id) => [id, { ...WEAPONS[id], ...WEAPON_TRAITS[id] }]),
    ),
  },
  { id: "wheels", name: "Ruedas", label: "02 / TRACCIÓN", catalog: WHEELS },
  { id: "shell", name: "Carcasa", label: "03 / ESTRUCTURA", catalog: SHELLS },
  { id: "module", name: "Auxiliar", label: "04 / MÓDULO", catalog: MODULES },
  { id: "paint", name: "Color", label: "05 / ACABADO", catalog: PAINTS },
]);
export const DEFAULT_LOADOUT = Object.freeze({
  weapon: "hammer",
  wheels: "standard",
  shell: "balanced",
  module: "none",
  paint: "mint",
});
export const RIVAL_LOADOUT = Object.freeze({
  weapon: "saw",
  wheels: "standard",
  shell: "balanced",
  module: "none",
  paint: "orange",
});
export const STORAGE_KEY = "brawl-bots-garage-v1";
export function normalizeLoadout(value = {}) {
  const loadout = {};
  for (const category of CATEGORIES) {
    const selected = value?.[category.id];
    loadout[category.id] = Object.hasOwn(category.catalog, selected)
      ? selected
      : DEFAULT_LOADOUT[category.id];
  }
  return loadout;
}
export function deriveLoadout(value) {
  const loadout = normalizeLoadout(value);
  const wheel = WHEELS[loadout.wheels],
    shell = SHELLS[loadout.shell],
    mod = MODULES[loadout.module],
    tool = WEAPON_TRAITS[loadout.weapon];
  const weapon = {
    ...WEAPONS[loadout.weapon],
    damage: Math.max(
      1,
      Math.round(WEAPONS[loadout.weapon].damage * mod.damage),
    ),
  };
  const frontArmor = Math.min(
    0.42,
    1 - (1 - (weapon.frontArmor || 0)) * (1 - mod.frontArmor),
  );
  const stats = {
    ...ROBOT,
    health: shell.health,
    speed: ROBOT.speed * wheel.speed * shell.speed * mod.speed * tool.speed,
    reverseSpeed:
      ROBOT.reverseSpeed * wheel.speed * shell.speed * mod.speed * tool.speed,
    turnSpeed: ROBOT.turnSpeed * wheel.turn * shell.turn * mod.turn * tool.turn,
    acceleration: ROBOT.acceleration * wheel.acceleration * mod.acceleration,
    armor: shell.armor,
    frontArmor,
    stability: wheel.stability * mod.stability * (weapon.stability || 1),
    recovery: mod.recovery,
  };
  return {
    loadout,
    stats,
    weapon,
    dps: weapon.damage / weapon.interval,
    resistance: stats.health / (1 - stats.armor),
    frontalResistance: stats.health / ((1 - stats.armor) * (1 - frontArmor)),
  };
}
export function readLoadout(storage) {
  try {
    return normalizeLoadout(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULT_LOADOUT };
  }
}
export function saveLoadout(storage, loadout) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeLoadout(loadout)));
    return true;
  } catch {
    return false;
  }
}
export function statPercent(value, maximum) {
  return clamp((value / maximum) * 100, 0, 100);
}
