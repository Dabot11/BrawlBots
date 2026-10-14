import "./style.css";
import { CONFIG, WEAPON_IDS } from "./config.js";
import { Simulation } from "./simulation.js";
import { Input } from "./input.js";
import { Renderer } from "./render.js";
import { Sound } from "./audio.js";
import { UI } from "./ui.js";
import { readLoadout, saveLoadout } from "./loadout.js";

let storage;
try {
  storage = window.localStorage;
} catch {}
const sim = new Simulation(readLoadout(storage)),
  sound = new Sound();
let renderer,
  input,
  accumulator = 0;
let rearToggled = false;
const ui = new UI(action);

function start() {
  sim.reset();
  rearToggled = false;
  renderer?.clearEffects();
  renderer?.resetView(sim.robots[0]);
  input?.clear();
  accumulator = 0;
  sound.unlock();
  sound.cancelTransient();
  document.getElementById("viewport").focus({ preventScroll: true });
  ui.notify("Patio de Chatarra · Acércate, golpea y protege tus flancos.", 3);
}
function action(name) {
  if (name === "garage") {
    if (sim.garage()) {
      sound.unlock();
      sound.ui("enter");
      renderer?.resetPreview();
    }
    return;
  }
  if (name === "category") {
    sound.unlock();
    sound.ui("select");
    ui.garage.update(sim);
    return;
  }
  if (name.startsWith("part:")) {
    const [, category, id] = name.split(":");
    if (sim.selectPart(category, id)) {
      saveLoadout(storage, sim.loadout);
      sound.unlock();
      sound.ui("equip");
      ui.loadout(sim);
    }
    return;
  }
  if (name === "preview-left" || name === "preview-right") {
    renderer?.rotatePreview(name === "preview-left" ? -0.45 : 0.45);
    return;
  }
  if (name === "preview-test") {
    renderer?.testPreview();
    sound.unlock();
    sound.event({ type: "attack", owner: 0, weapon: sim.playerWeapon }, sim);
    return;
  }
  if (name === "back") {
    if (sim.state === "garage") action("home");
    return;
  }

  if (name === "previous-weapon" || name === "next-weapon") {
    if (sim.state === "garage") {
      action(ui.garage.cycle(sim, name === "next-weapon" ? 1 : -1));
      return;
    }
    if (sim.state === "home") {
      const delta = name === "next-weapon" ? 1 : -1;
      const index =
        (WEAPON_IDS.indexOf(sim.playerWeapon) + delta + WEAPON_IDS.length) %
        WEAPON_IDS.length;
      action(`part:weapon:${WEAPON_IDS[index]}`);
    }
    return;
  }
  if (name === "rear") {
    if (["playing", "countdown"].includes(sim.state))
      rearToggled = !rearToggled;
    return;
  }
  if (name === "sound") {
    sound.unlock();
    sound.setMuted(!sound.muted);
    ui.sound(sound.muted);
    return;
  }
  if (name === "confirm") {
    sound.unlock();
    if (
      sim.state === "garage" &&
      input?.device === "keyboard" &&
      document.activeElement?.matches("#garage button")
    ) {
      document.activeElement.click();
      return;
    }
    ui.confirm();
    return;
  }
  if (name === "up" || name === "down") {
    if (sim.state === "garage") {
      ui.garage.moveCategory(name === "up" ? -1 : 1);
      action("category");
      return;
    }
    if (["home", "paused", "result"].includes(sim.state))
      ui.menuMove(name === "up" ? -1 : 1);
    return;
  }
  if (name === "play" || name === "restart") {
    start();
    return;
  }
  if (name === "resume") {
    sim.resume();
    input?.clear();
    sound.unlock();
    return;
  }
  if (name === "home") {
    rearToggled = false;
    sim.home();
    sound.cancelTransient();
    renderer?.clearEffects();
    input?.clear();
    return;
  }
  if (name === "brand") {
    if (sim.state === "playing" || sim.state === "countdown") {
      sim.pause();
      sound.silenceMotor();
    } else if (sim.state !== "home") action("home");
    input?.clear();
    return;
  }
  if (name === "pause") {
    rearToggled = false;
    if (sim.state === "garage") {
      action("home");
      return;
    }
    if (sim.state === "paused") action("resume");
    else {
      sim.pause();
      sound.silenceMotor();
      input?.clear();
    }
    return;
  }
  if (name === "disconnect") {
    const paused = sim.pause();
    if (paused) sound.silenceMotor();
    input?.clear();
    ui.notify(
      paused
        ? "Mando desconectado. Reconéctalo o usa el teclado para reanudar."
        : "Mando desconectado. Puedes seguir con el teclado.",
      7,
    );
  }
}

document.getElementById("volume").value = Math.round(sound.volume * 100);
document.getElementById("volume-value").textContent =
  `${Math.round(sound.volume * 100)}%`;
ui.sound(sound.muted);
document.getElementById("volume").oninput = (event) => {
  sound.unlock();
  sound.setVolume(Number(event.target.value) / 100);
  document.getElementById("volume-value").textContent =
    `${event.target.value}%`;
};
input = new Input(action, (device, connected) =>
  ui.setDevice(device, connected),
);
function suspend() {
  rearToggled = false;
  input.clear();
  input.enabled = false;
  sim.pause();
  sound.cancelTransient();
  accumulator = 0;
  if (sim.state === "paused")
    ui.notify(
      "Partida pausada al perder el foco. Reanuda cuando estés listo.",
      5,
    );
}
window.addEventListener("blur", suspend);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspend();
  else input.enabled = document.hasFocus();
});
window.addEventListener("focus", () => {
  input.enabled = true;
  input.clear();
});
try {
  renderer = new Renderer(document.getElementById("viewport"));
  renderer.renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    sim.pause();
    ui.error(
      "Se perdió el contexto gráfico. Recarga la página para volver a jugar.",
    );
  });
  let previous = performance.now();
  function frame(now) {
    const dt = Math.min(
      CONFIG.simulation.maxFrame,
      Math.max(0, (now - previous) / 1000),
    );
    previous = now;
    const command = input.poll();
    if (sim.state === "playing" || sim.state === "countdown") {
      accumulator += dt;
      while (accumulator >= CONFIG.simulation.step) {
        sim.update(CONFIG.simulation.step, command);
        accumulator -= CONFIG.simulation.step;
      }
    } else accumulator = 0;
    const events = sim.drainEvents();
    renderer.handle(events);
    events.forEach((event) => sound.event(event, sim));
    sound.update(sim);
    if (events.some((event) => event.type === "start"))
      ui.notify("¡A combatir!", 1.3);
    if (events.some((event) => event.type === "flip" && event.target === 0))
      ui.notify("¡Te han volcado! Recuperando estabilidad…", 1.4);
    ui.update(sim, dt);
    const rear =
      ["playing", "countdown"].includes(sim.state) &&
      (rearToggled || command.rear);
    ui.rearView(rear);
    renderer.update(sim, dt, rear);
    requestAnimationFrame(frame);
  }
  ui.update(sim, 0);
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  ui.error(
    "No se pudo iniciar WebGL. Activa la aceleración gráfica y abre el juego en una versión reciente de Chrome.",
  );
}
