import "./style.css";
import { CONFIG } from "./config.js";
import { Simulation } from "./simulation.js";
import { Input } from "./input.js";
import { Renderer } from "./render.js";
import { Sound } from "./audio.js";
import { UI } from "./ui.js";

const sim = new Simulation(),
  sound = new Sound();
let renderer,
  input,
  accumulator = 0;
const ui = new UI(action);

function start() {
  sim.reset();
  renderer?.clearEffects();
  input?.clear();
  accumulator = 0;
  sound.unlock();
  document.getElementById("viewport").focus({ preventScroll: true });
  ui.notify("Patio de Chatarra · Usa la cobertura y protege tus piezas.", 3);
}
function action(name) {
  if (name === "sound") {
    sound.unlock();
    sound.muted = !sound.muted;
    ui.sound(sound.muted);
    return;
  }
  if (name === "confirm") {
    sound.unlock();
    ui.confirm();
    return;
  }
  if (name === "up" || name === "down") {
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
    sim.home();
    renderer?.clearEffects();
    input?.clear();
    return;
  }
  if (name === "brand") {
    if (sim.state === "playing" || sim.state === "countdown") sim.pause();
    else if (sim.state !== "home") action("home");
    input?.clear();
    return;
  }
  if (name === "pause") {
    if (sim.state === "paused") action("resume");
    else {
      sim.pause();
      input?.clear();
    }
    return;
  }
  if (name === "disconnect") {
    const paused = sim.pause();
    input?.clear();
    ui.notify(
      paused
        ? "Mando desconectado. Reconéctalo o usa el teclado para reanudar."
        : "Mando desconectado. Puedes seguir con el teclado.",
      7,
    );
  }
}

input = new Input(action, (device, connected) =>
  ui.setDevice(device, connected),
);
function suspend() {
  input.clear();
  input.enabled = false;
  sim.pause();
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
    events.forEach((event) => sound.event(event));
    if (events.some((event) => event.type === "start"))
      ui.notify("¡A combatir!", 1.3);
    ui.update(sim, dt);
    renderer.update(sim, dt);
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
