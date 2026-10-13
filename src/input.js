import { CONFIG, clamp } from "./config.js";

export class Input {
  constructor(onAction, onDevice) {
    this.keys = new Set();
    this.onAction = onAction;
    this.onDevice = onDevice;
    this.device = "keyboard";
    this.gamepadIndex = null;
    this.connected = false;
    this.previousButtons = [];
    this.previousDirection = 0;
    this.previousAxes = [0, 0];
    this.previousTrigger = 0;
    this.enabled = true;
    const relevant = [
      "KeyW",
      "KeyS",
      "KeyA",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "Escape",
      "Enter",
    ];
    window.addEventListener("keydown", (event) => {
      if (!relevant.includes(event.code)) return;
      event.preventDefault();
      if (event.repeat || !this.enabled) return;
      this.use("keyboard");
      this.keys.add(event.code);
      if (event.code === "Escape") onAction("pause");
      if (event.code === "Enter") onAction("confirm");
      if (event.code === "ArrowUp" || event.code === "KeyW") onAction("up");
      if (event.code === "ArrowDown" || event.code === "KeyS") onAction("down");
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    window.addEventListener("gamepadconnected", (event) => {
      if (event.gamepad.mapping === "standard") {
        this.connected = true;
        onDevice(this.device, true);
      }
    });
    window.addEventListener("gamepaddisconnected", (event) => {
      if (event.gamepad.index === this.gamepadIndex) this.disconnect();
    });
  }
  use(device) {
    if (this.device !== device) {
      this.device = device;
      this.onDevice(device, this.connected);
    }
  }
  clear() {
    this.keys.clear();
  }
  axis(value = 0) {
    const deadzone = CONFIG.input.deadzone;
    return Math.abs(value) < deadzone
      ? 0
      : Math.sign(value) *
          clamp((Math.abs(value) - deadzone) / (1 - deadzone), 0, 1);
  }
  disconnect() {
    const active = this.device === "gamepad";
    this.gamepadIndex = null;
    this.connected = false;
    this.previousButtons = [];
    this.previousDirection = 0;
    this.previousAxes = [0, 0];
    this.previousTrigger = 0;
    this.onDevice(this.device, false);
    if (active) this.onAction("disconnect");
  }
  poll() {
    const pads = Array.from(navigator.getGamepads?.() || []);
    // Nonstandard devices have no guaranteed Xbox button layout.
    let pad = pads.find(
      (p) => p && p.mapping === "standard" && p.index === this.gamepadIndex,
    );
    if (!pad) pad = pads.find((p) => p && p.mapping === "standard");
    if (this.gamepadIndex !== null && !pad) this.disconnect();
    const keyboard = {
      throttle:
        Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
        Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")),
      turn:
        Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
        Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")),
      fire: this.keys.has("Space"),
    };
    if (!pad)
      return this.enabled ? keyboard : { throttle: 0, turn: 0, fire: false };
    this.gamepadIndex = pad.index;
    if (!this.connected) {
      this.connected = true;
      this.onDevice(this.device, true);
    }
    const buttons = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const turn = this.axis(pad.axes[0]),
      throttle = -this.axis(pad.axes[1]);
    const trigger = pad.buttons[7]?.value || 0;
    const fire = trigger > 0.2;
    // Switch on fresh input, so an idle connected controller cannot steal keyboard focus.
    const freshButton = buttons.some(
      (pressed, i) => pressed && !this.previousButtons[i],
    );
    const freshAnalog =
      (Math.abs(turn) > 0.1 && Math.abs(turn - this.previousAxes[0]) > 0.08) ||
      (Math.abs(throttle) > 0.1 &&
        Math.abs(throttle - this.previousAxes[1]) > 0.08) ||
      (fire && trigger - this.previousTrigger > 0.08);
    if (this.enabled && (freshButton || freshAnalog)) this.use("gamepad");
    const direction =
      buttons[12] || pad.axes[1] < -0.55
        ? -1
        : buttons[13] || pad.axes[1] > 0.55
          ? 1
          : 0;
    if (this.enabled) {
      if (buttons[9] && !this.previousButtons[9]) this.onAction("pause");
      if (buttons[0] && !this.previousButtons[0]) this.onAction("confirm");
      if (direction && direction !== this.previousDirection)
        this.onAction(direction < 0 ? "up" : "down");
    }
    this.previousButtons = buttons;
    this.previousDirection = direction;
    this.previousAxes = [turn, throttle];
    this.previousTrigger = trigger;
    if (!this.enabled) return { throttle: 0, turn: 0, fire: false };
    return this.device === "gamepad" ? { throttle, turn, fire } : keyboard;
  }
}
