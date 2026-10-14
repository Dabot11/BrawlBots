import { WEAPONS, WEAPON_IDS, heading, angleDifference } from "./config.js";
const $ = (id) => document.getElementById(id);

export class UI {
  constructor(onAction) {
    this.onAction = onAction;
    this.state = null;
    this.selected = 0;
    this.options = [];
    this.device = "keyboard";
    this.help = true;
    this.noticeTimer = 0;
    $("pause").onclick = () => onAction("pause");
    $("rear-view").onclick = () => onAction("rear");
    $("weapon-prev").onclick = () => onAction("previous-weapon");
    $("weapon-next").onclick = () => onAction("next-weapon");
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
    $("weapon-hint").textContent = pad
      ? "LB / RB o ← → PARA ELEGIR"
      : "Q / E o ← → PARA ELEGIR";
    $("menu-confirm").textContent = pad
      ? "A PARA CONFIRMAR · STICK / CRUCETA PARA ELEGIR"
      : "ENTER PARA CONFIRMAR · ↑ ↓ PARA ELEGIR";
    $("controls").hidden = !this.help;
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
  notify(message, seconds = 3) {
    $("notice").textContent = message;
    this.noticeTimer = seconds;
  }
  loadout(sim) {
    const weapon = WEAPONS[sim.playerWeapon];
    $("weapon-name").textContent = weapon.name;
    $("weapon-description").textContent = weapon.description;
    $("weapon-count").textContent =
      `${WEAPON_IDS.indexOf(sim.playerWeapon) + 1} / ${WEAPON_IDS.length}`;
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
    if (this.options[this.selected])
      this.onAction(this.options[this.selected][1]);
  }
  showMenu(sim) {
    const home = sim.state === "home",
      paused = sim.state === "paused";
    const victory = sim.winner === 0;
    if (home) this.notify("", 0);
    $("weapon-picker").hidden = !home;
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
        : victory
          ? "<span>¡VICTORIA!</span>"
          : "ROBOT<br /><span>DESTRUIDO</span>";
    $("menu").querySelector(".eyebrow").innerHTML =
      '<span class="tiny-line"></span> ' +
      (home
        ? "PEQUEÑOS ROBOTS. GRANDES BATALLAS."
        : paused
          ? "UN RESPIRO ENTRE CHISPAS"
          : victory
            ? "EL PATIO TIENE UN NUEVO CAMPEÓN"
            : "TODAVÍA QUEDAN PIEZAS POR RECUPERAR");
    $("menu").querySelector(".tagline").textContent = home
      ? "Arma tu robot. Domina la arena."
      : paused
        ? "La arena puede esperar."
        : victory
          ? "Óxido ha quedado fuera de combate."
          : "Remache necesita unas reparaciones.";
    $("menu").querySelector(".intro").innerHTML = home
      ? 'Picos, golpes y metal. Entra al patio,<br class="desktop-break" /> acércate al rival y deja que salten las chispas.'
      : paused
        ? "Vuelve cuando estés listo. Cada pieza cuenta."
        : "Duración del duelo: " + this.time(sim.elapsed) + ". ¿Otra ronda?";
    this.options = home
      ? [["Jugar", "play"]]
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
  }
  time(seconds) {
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  }
  update(sim, dt) {
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer === 0) $("notice").textContent = "";
    const menuVisible = ["home", "paused", "result"].includes(sim.state);
    if (this.state !== sim.state) {
      this.state = sim.state;
      $("menu").hidden = !menuVisible;
      if (menuVisible) this.showMenu(sim);
      else {
        this.options = [];
        $("app").classList.remove("home", "overlay");
      }
      $("hud").hidden = sim.state === "home";
      $("rear-view").hidden = sim.state === "home";
      $("weapon-status").hidden = sim.state === "home";
      $("countdown").hidden = sim.state !== "countdown";
    }
    if (sim.state === "countdown")
      $("countdown").innerHTML =
        `<span>PREPARA TU ROBOT</span><b>${Math.max(1, Math.ceil(sim.countdown))}</b>`;
    $("player-health").textContent = sim.robots[0].hp;
    $("enemy-health").textContent = sim.robots[1].hp;
    $("player-fill").style.width = `${sim.robots[0].hp}%`;
    $("enemy-fill").style.width = `${sim.robots[1].hp}%`;
    const [player, rival] = sim.robots;
    const weapon = WEAPONS[player.weaponId];
    const readiness = Math.max(0, 1 - player.cooldown / weapon.interval);
    $("weapon-ready").style.width = `${readiness * 100}%`;
    $("weapon-state").textContent =
      `${weapon.name} · ${player.flipTime > 0 ? "RECUPERANDO" : player.cooldown > 0 ? "PREPARANDO" : "LISTO"}`;
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
            : this.time(sim.elapsed);
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
