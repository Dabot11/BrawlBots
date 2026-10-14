import { CATEGORIES, deriveLoadout, statPercent } from "./loadout.js";
const $ = (id) => document.getElementById(id);
export class Garage {
  constructor(onAction) {
    this.onAction = onAction;
    this.category = 0;
    this.lastLoadout = null;
    this.state = null;
    this.device = "keyboard";
    $("garage-tabs").replaceChildren(
      ...CATEGORIES.map((slot, index) => {
        const button = document.createElement("button");
        button.id = `tab-${slot.id}`;
        button.textContent = slot.name;
        button.role = "tab";
        button.setAttribute("aria-controls", "garage-parts");
        button.onclick = () => {
          this.category = index;
          this.lastLoadout = null;
          onAction("category");
        };
        return button;
      }),
    );
    $("garage-play").onclick = () => onAction("play");
    $("garage-back").onclick = () => onAction("home");
    $("preview-left").onclick = () => onAction("preview-left");
    $("preview-right").onclick = () => onAction("preview-right");
    $("preview-test").onclick = () => onAction("preview-test");
  }
  moveCategory(delta) {
    this.category =
      (this.category + delta + CATEGORIES.length) % CATEGORIES.length;
    this.lastLoadout = null;
  }
  cycle(sim, delta) {
    const slot = CATEGORIES[this.category],
      ids = Object.keys(slot.catalog);
    return `part:${slot.id}:${ids[(ids.indexOf(sim.loadout[slot.id]) + delta + ids.length) % ids.length]}`;
  }
  update(sim) {
    const visible = sim.state === "garage";
    $("garage").hidden = !visible;
    if (!visible) {
      this.state = sim.state;
      return;
    }
    if (this.state !== "garage") {
      this.lastLoadout = null;
      $("garage-play").focus({ preventScroll: true });
    }
    this.state = sim.state;
    if (this.lastLoadout === sim.loadout) return;
    this.lastLoadout = sim.loadout;
    const slot = CATEGORIES[this.category];
    $("garage-category").textContent = slot.label;
    $("garage-parts").setAttribute("aria-labelledby", `tab-${slot.id}`);
    [...$("garage-tabs").children].forEach((button, index) =>
      button.setAttribute("aria-selected", String(index === this.category)),
    );
    const focusedPart = document.activeElement?.dataset.part;
    $("garage-parts").replaceChildren(
      ...Object.entries(slot.catalog).map(([id, part]) => {
        const button = document.createElement("button");
        button.className = `part-card${slot.id === "paint" ? " paint-card" : ""}`;
        button.setAttribute(
          "aria-pressed",
          String(sim.loadout[slot.id] === id),
        );
        button.dataset.part = id;
        const heading = document.createElement("strong");
        heading.textContent = part.name;
        const tag = document.createElement("small");
        tag.textContent = part.tag || "ACABADO";
        button.append(tag, heading);
        if (slot.id === "paint") {
          const swatch = document.createElement("span");
          swatch.className = "paint-swatch";
          swatch.style.background = part.hex;
          button.prepend(swatch);
          const note = document.createElement("span");
          note.className = "part-neutral";
          note.textContent = "Solo apariencia";
          button.append(note);
        } else {
          const plus = document.createElement("span");
          plus.className = "part-plus";
          plus.textContent = part.plus.startsWith("+")
            ? part.plus
            : `+ ${part.plus}`;
          const minus = document.createElement("span");
          minus.className = "part-minus";
          minus.textContent = part.minus;
          button.append(plus, minus);
        }
        button.onclick = () => this.onAction(`part:${slot.id}:${id}`);
        return button;
      }),
    );
    if (focusedPart)
      [...$("garage-parts").children]
        .find((button) => button.dataset.part === focusedPart)
        ?.focus({ preventScroll: true });
    const build = deriveLoadout(sim.loadout),
      stats = build.stats;
    const rows = [
      [
        "Integridad",
        `${stats.health} pts`,
        stats.health,
        125,
        `${Math.round(stats.armor * 100)}% blindaje general`,
      ],
      [
        "Ataque",
        `${build.weapon.damage} / golpe`,
        build.dps,
        28,
        `${build.dps.toFixed(1)} daño/s ideal`,
      ],
      [
        "Velocidad",
        `${stats.speed.toFixed(1)} m/s`,
        stats.speed,
        11,
        `${stats.acceleration.toFixed(1)} m/s² de aceleración`,
      ],
      [
        "Agilidad",
        `${Math.round((stats.turnSpeed * 180) / Math.PI)}°/s`,
        stats.turnSpeed,
        4.1,
        "Giro incluso estando detenido",
      ],
      [
        "Defensa frontal",
        `${Math.round((1 - (1 - stats.armor) * (1 - stats.frontArmor)) * 100)}%`,
        1 - (1 - stats.armor) * (1 - stats.frontArmor),
        0.5,
        "La parte trasera conserva su vulnerabilidad",
      ],
    ];
    $("garage-stats").replaceChildren(
      ...rows.map(([name, value, amount, max, detail]) => {
        const row = document.createElement("div");
        row.className = "build-stat";
        const label = document.createElement("span");
        label.textContent = name;
        const number = document.createElement("b");
        number.textContent = value;
        const track = document.createElement("div");
        track.className = "stat-track";
        const bar = document.createElement("i");
        bar.style.width = `${statPercent(amount, max)}%`;
        track.append(bar);
        const hint = document.createElement("small");
        hint.textContent = detail;
        row.append(label, number, track, hint);
        return row;
      }),
    );
    $("build-summary").textContent = CATEGORIES.map(
      (category) => category.catalog[sim.loadout[category.id]].name,
    ).join(" · ");
    $("garage-special").textContent =
      `Empuje recibido: ${Math.round(stats.stability * 100)}% · recuperación: ${Math.round(stats.recovery * 100)}% del tiempo base. El daño/s supone contacto continuo; alcance y preparación también cuentan.`;
    this.controls(this.device);
  }
  controls(device) {
    this.device = device;
    $("garage-hint").textContent =
      device === "gamepad"
        ? "↑ ↓ CATEGORÍA · LB / RB PIEZA · A COMBATIR · B VOLVER"
        : "W / S CATEGORÍA · Q / E PIEZA · ENTER CONFIRMAR · ESC VOLVER";
  }
}
