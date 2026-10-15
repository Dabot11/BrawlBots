import { CONFIG, heading, angleDifference } from "./config.js";
import { attackProbe, attackPose } from "./combat.js";
import { Garage } from "./garage.js";
import { CATEGORIES } from "./loadout.js";
const $ = (id) => document.getElementById(id);

export class UI {
  constructor(onAction) {
    this.onAction = onAction;
    this.garage = new Garage(onAction);
    this.state = null;
    this.selected = 0;
    this.options = [];
    this.device = "keyboard";
    this.help = true;
    this.noticeTimer = 0;
    this.feedbackTime = 0;
    $("pause").onclick = () => onAction("pause");
    $("rear-view").onclick = () => onAction("rear");
    $("audio-settings").onclick = () => {
      const open = $("audio-panel").hidden;
      $("audio-panel").hidden = !open;
      $("audio-settings").setAttribute("aria-expanded", String(open));
    };
    $("brand").onclick = (event) => {
      event.preventDefault();
      onAction("brand");
    };
    $("sound").onclick = () => onAction("sound");
    $("help-toggle").onclick = () => {
      this.help = !this.help;
      this.controls();
    };
    this.controls();
  }
  controls() {
    const pad = this.device === "gamepad";
    $("drive-controls").innerHTML = pad
      ? "<kbd>LS</kbd><span>CONDUCIR</span>"
      : '<div class="key-cluster"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div><span>CONDUCIR</span>';
    $("attack-controls").innerHTML = pad
      ? "<kbd>RT</kbd><span>ATACAR</span>"
      : '<kbd class="wide-key">ESPACIO</kbd><span>ATACAR</span>';
    $("pause-controls").innerHTML = pad
      ? "<kbd>MENU</kbd><span>PAUSA</span>"
      : "<kbd>P / ESC</kbd><span>PAUSA</span>";
    $("rear-controls").innerHTML = pad
      ? "<kbd>RS</kbd><span>MIRAR ATRÁS</span>"
      : "<kbd>C</kbd><span>MIRAR ATRÁS</span>";
    $("menu-confirm").textContent = pad
      ? "A PARA CONFIRMAR · STICK / CRUCETA PARA ELEGIR"
      : "ENTER PARA CONFIRMAR · ↑ ↓ PARA ELEGIR";
    $("controls").hidden =
      !this.help || !["playing", "countdown"].includes(this.state);
    this.garage.controls(this.device);
    $("menu-confirm").hidden = !this.help;
    $("garage-hint").hidden = !this.help;
    $("help-toggle").setAttribute("aria-pressed", String(!this.help));
    $("help-toggle").setAttribute(
      "aria-label",
      this.help ? "Ocultar ayuda de controles" : "Mostrar ayuda de controles",
    );
  }
  setDevice(device, connected) {
    this.device = device;
    this.controls();
    $("device-status").textContent =
      device === "gamepad" && connected ? "MANDO CONECTADO" : "TECLADO LISTO";
    $("controller-hint").textContent = connected
      ? "Mando disponible. Teclado y control, cuando quieras."
      : "¿Tienes un mando? Pulsa un botón para conectarlo.";
  }
  closeAudio() {
    $("audio-panel").hidden = true;
    $("audio-settings").setAttribute("aria-expanded", "false");
  }
  handle(events) {
    for (const event of events) {
      if (event.type === "damage") {
        $("combat-feedback").textContent =
          event.owner === 0
            ? `IMPACTO −${event.amount}${event.absorbed ? ` · BLINDAJE ABSORBIÓ ${event.absorbed}` : ""}`
            : `RECIBISTE ${event.amount} DE DAÑO`;
        $("combat-feedback").dataset.kind = event.owner === 0 ? "hit" : "hurt";
        this.feedbackTime = 0.8;
      } else if (
        event.type === "miss" &&
        event.owner === 0 &&
        this.feedbackTime <= 0.2
      ) {
        const message = {
          range: "FALLO · FUERA DE ALCANCE",
          aim: "FALLO · GIRA HACIA EL RIVAL",
          cover: "FALLO · OBSTÁCULO ENTRE LOS ROBOTS",
        }[event.reason];
        if (message) {
          $("combat-feedback").textContent = message;
          $("combat-feedback").dataset.kind = "miss";
          this.feedbackTime = 0.65;
        }
      }
    }
  }
  notify(message, seconds = 3) {
    $("notice").textContent = message;
    this.noticeTimer = seconds;
  }
  loadout(sim) {
    $("home-build").textContent =
      "TU BOT / " +
      CATEGORIES.filter((slot) => slot.id !== "paint")
        .map((slot) => slot.catalog[sim.loadout[slot.id]].name)
        .join(" · ");
    this.garage.update(sim);
  }
  rearView(rear) {
    $("rear-view").setAttribute("aria-pressed", String(Boolean(rear)));
    $("rear-view").setAttribute(
      "aria-label",
      rear ? "Volver a vista frontal" : "Mirar hacia atrás",
    );
    $("rear-view").textContent = rear ? "Vista frontal" : "Ver atrás";
    $("view-mode").hidden = !rear;
  }
  menuMove(delta) {
    if (!this.options.length) return;
    this.selected =
      (this.selected + delta + this.options.length) % this.options.length;
    this.highlight();
    $("menu-buttons").children[this.selected]?.focus({ preventScroll: true });
  }
  highlight() {
    [...$("menu-buttons").children].forEach((button, i) => {
      button.classList.toggle("selected", i === this.selected);
    });
  }
  confirm() {
    if (this.state === "garage") {
      this.onAction("play");
      return;
    }
    if (this.options[this.selected])
      this.onAction(this.options[this.selected][1]);
  }
  showMenu(sim) {
    const home = sim.state === "home",
      paused = sim.state === "paused";
    const victory = sim.winner === 0,
      draw = sim.winner === -1;
    if (home) {
      this.notify("", 0);
      this.feedbackTime = 0;
    }
    document.querySelector(".home-features").hidden = !home;
    $("home-build").hidden = !home;
    $("result-summary").hidden = home || paused;
    if (!home && !paused) {
      const [a, b] = sim.robots;
      $("result-summary").textContent =
        `DAÑO CAUSADO ${a.damageDealt} · RECIBIDO ${a.damageTaken} · GOLPES ${a.hits}/${a.attacks} · INTEGRIDAD ${((a.hp / a.health) * 100).toFixed(2)}% / ${((b.hp / b.health) * 100).toFixed(2)}%`;
    }

    this.loadout(sim);
    $("menu").classList.toggle("compact-menu", !home);
    $("menu").classList.toggle("victory-menu", !home && !paused && victory);
    $("app").classList.toggle("home", home);
    $("app").classList.toggle("overlay", !home);
    const title = $("menu").querySelector("h1");
    title.innerHTML = home
      ? 'BRAWL<br /><span>BOTS<span class="title-dot">.</span></span>'
      : paused
        ? 'EN<br /><span>PAUSA<span class="title-dot">.</span></span>'
        : draw
          ? "<span>EMPATE</span>"
          : victory
            ? "<span>¡VICTORIA!</span>"
            : "ROBOT<br /><span>DESTRUIDO</span>";
    $("menu").querySelector(".eyebrow").innerHTML =
      '<span class="tiny-line"></span> ' +
      (home
        ? "INGENIERÍA CASERA. COMBATE SIN DISTANCIA."
        : paused
          ? "UN RESPIRO ENTRE CHISPAS"
          : draw
            ? "LOS DOS ROBOTS DIERON TODO"
            : victory
              ? "EL PATIO TIENE UN NUEVO CAMPEÓN"
              : "TODAVÍA QUEDAN PIEZAS POR RECUPERAR");
    $("menu").querySelector(".tagline").textContent = home
      ? "Construye tu ventaja."
      : paused
        ? "La arena puede esperar."
        : draw
          ? "Ambos robots quedaron fuera de combate."
          : victory
            ? "Óxido ha quedado fuera de combate."
            : "Remache necesita unas reparaciones.";
    $("menu").querySelector(".intro").innerHTML = home
      ? 'Elige tus piezas, ajusta tu estilo y entra al patio.<br class="desktop-break" /> Un duelo de metal. Cada golpe se siente.'
      : paused
        ? "Vuelve cuando estés listo. Cada pieza cuenta."
        : "Duración del duelo: " + this.time(sim.elapsed) + ". ¿Otra ronda?";
    this.options = home
      ? [
          ["Entrar al garaje", "garage"],
          ["Jugar", "play"],
        ]
      : paused
        ? [
            ["Reanudar", "resume"],
            ["Reiniciar partida", "restart"],
            ["Volver al inicio", "home"],
          ]
        : [
            ["Revancha", "restart"],
            ["Volver al inicio", "home"],
          ];
    this.selected = 0;
    $("menu-buttons").replaceChildren(
      ...this.options.map(([label, action], i) => {
        const button = document.createElement("button");
        button.className =
          "menu-button" + (i === 0 ? " primary selected" : " secondary");
        button.innerHTML = `<span>${label}</span><span aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="${i === 0 ? "M5 19 19 5M5 5h14v14" : "M4 12h15m-6-6 6 6-6 6"}" stroke="currentColor" stroke-width="1.5"/></svg></span>`;
        button.onclick = () => this.onAction(action);
        button.onfocus = () => {
          this.selected = i;
          this.highlight();
        };
        return button;
      }),
    );
    $("arena-tag").hidden = !home;
    this.controls();
    if (sim.resultReason === "time" && !home && !paused) {
      title.innerHTML = draw
        ? "<span>EMPATE</span>"
        : victory
          ? "<span>¡VICTORIA!</span>"
          : "FIN DEL<br /><span>DUELO</span>";
      $("menu").querySelector(".tagline").textContent = draw
        ? "Tiempo agotado. Misma integridad restante."
        : victory
          ? "Victoria por porcentaje de integridad restante."
          : "Óxido conservó más integridad al terminar el tiempo.";
    }
  }
  time(seconds) {
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  }
  update(sim, dt, command = {}) {
    this.garage.update(sim);
    if (sim.state !== "paused")
      this.feedbackTime = Math.max(0, this.feedbackTime - dt);
    $("combat-feedback").hidden =
      sim.state !== "playing" || this.feedbackTime <= 0;
    $("app").classList.toggle("garage-open", sim.state === "garage");
    $("app").dataset.state = sim.state;
    $("notice").hidden =
      !$("combat-feedback").hidden || ["home", "garage"].includes(sim.state);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer === 0) $("notice").textContent = "";
    const menuVisible = ["home", "paused", "result"].includes(sim.state);
    if (this.state !== sim.state) {
      this.state = sim.state;
      if (sim.state === "countdown") this.feedbackTime = 0;
      $("menu").hidden = !menuVisible;
      if (menuVisible) this.showMenu(sim);
      else {
        this.controls();
        this.options = [];
        $("app").classList.remove("home", "overlay");
      }
      $("hud").hidden = ["home", "garage"].includes(sim.state);
      $("rear-view").hidden = ["home", "garage"].includes(sim.state);
      $("weapon-status").hidden = !["playing", "countdown"].includes(sim.state);
      $("rear-view").disabled = !["playing", "countdown"].includes(sim.state);
      $("pause").setAttribute(
        "aria-label",
        sim.state === "paused" ? "Reanudar partida" : "Pausar partida",
      );
      $("pause").textContent = sim.state === "paused" ? ">" : "II";
      $("countdown").hidden = sim.state !== "countdown";
    }
    if (sim.state === "countdown")
      $("countdown").innerHTML =
        `<span>PREPARA TU ROBOT</span><b>${Math.max(1, Math.ceil(sim.countdown))}</b>`;
    $("player-health").textContent = sim.robots[0].hp;
    $("enemy-health").textContent = sim.robots[1].hp;
    $("player-fill").style.width =
      `${(sim.robots[0].hp / sim.robots[0].health) * 100}%`;
    $("enemy-fill").style.width =
      `${(sim.robots[1].hp / sim.robots[1].health) * 100}%`;
    const [player, rival] = sim.robots;
    const weapon = player.weapon;
    const probe = attackProbe(player, rival);
    const pose = attackPose(player);
    const names = {
      ready: "LISTO",
      windup: "PREPARANDO",
      strike: "GOLPEANDO",
      active: "CONTACTO",
      recovery: "RECUPERANDO",
    };
    const readiness = Math.max(0, 1 - player.cooldown / weapon.interval);
    $("weapon-ready").style.width = `${readiness * 100}%`;
    $("weapon-state").textContent =
      `${weapon.name} · ${player.flipTime > 0 ? "VOLCADO" : player.stun > 0 && !player.attacking ? `ATURDIDO ${player.stun.toFixed(1)}s` : names[pose.stage]}${pose.stage === "recovery" ? ` ${player.cooldown.toFixed(1)}s` : ""}`;
    $("weapon-status").dataset.ready = String(probe.canHit);
    $("weapon-status").classList.toggle(
      "is-attacking",
      Boolean(command.attack),
    );
    $("combat-hint").textContent =
      player.flipTime > 0
        ? `Recuperando estabilidad · ${player.flipTime.toFixed(1)}s`
        : probe.canHit
          ? `EN ALCANCE · MANTÉN ${this.device === "gamepad" ? "RT" : "ESPACIO"}`
          : probe.reason === "cover"
            ? "HAY UN OBSTÁCULO · RODEA LA COBERTURA"
            : probe.reason === "aim"
              ? `GIRA ${probe.difference < 0 ? "A LA IZQUIERDA" : "A LA DERECHA"}`
              : `ACÉRCATE · FALTAN ${probe.gap.toFixed(1)} m`;
    $("enemy-state").textContent =
      `${rival.weapon.name} · ${rival.hp <= 0 ? "DESTRUIDO" : rival.flipTime > 0 ? "VOLCADO" : rival.attacking && rival.attackElapsed < rival.weapon.hitTime ? "¡PREPARANDO GOLPE!" : rival.cooldown > 0 ? "RECUPERANDO" : "LISTO"}`;
    $("enemy-state").classList.toggle(
      "danger",
      rival.attacking && rival.attackElapsed < rival.weapon.hitTime,
    );
    const difference = angleDifference(heading(player, rival), player.angle);
    const direction =
      Math.abs(difference) > 2.1
        ? "detrás"
        : Math.abs(difference) < 0.7
          ? "al frente"
          : difference < 0
            ? "a la izquierda"
            : "a la derecha";
    $("enemy-direction").textContent =
      `Óxido · ${direction} · ${Math.round(Math.hypot(rival.x - player.x, rival.z - player.z))} m`;
    $("match-status").textContent =
      sim.state === "countdown"
        ? "PREPARADOS"
        : sim.state === "paused"
          ? "PAUSA"
          : sim.state === "result"
            ? "FIN DEL DUELO"
            : this.time(
                Math.ceil(Math.max(0, CONFIG.match.seconds - sim.elapsed)),
              );
  }
  sound(muted) {
    $("sound").textContent = muted ? "♫̸" : "♪";
    $("sound").setAttribute(
      "aria-label",
      muted ? "Activar sonido" : "Silenciar sonido",
    );
    $("sound").setAttribute("aria-pressed", String(muted));
  }
  error(message) {
    $("error").hidden = false;
    $("error").textContent = message;
  }
}
