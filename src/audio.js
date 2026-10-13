export class Sound {
  constructor() {
    this.context = null;
    this.muted = false;
  }
  unlock() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) this.context = new Audio();
    }
    if (this.context?.state === "suspended")
      this.context.resume().catch(() => {});
  }
  tone(
    frequency,
    duration,
    type = "sine",
    volume = 0.06,
    endFrequency = frequency,
  ) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      now + duration,
    );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  event(event) {
    if (event.type === "fire") this.tone(180, 0.08, "sawtooth", 0.025, 45);
    if (event.type === "impact") this.tone(320, 0.06, "triangle", 0.04, 60);
    if (event.type === "damage") this.tone(90, 0.14, "square", 0.035, 30);
    if (event.type === "destroy") this.tone(65, 0.45, "sawtooth", 0.09, 12);
    if (event.type === "start") this.tone(520, 0.18, "sine", 0.08, 750);
    if (event.type === "result") {
      const notes = event.winner === 0 ? [440, 554, 659] : [220, 165, 110];
      notes.forEach((note, i) =>
        setTimeout(() => this.tone(note, 0.22, "triangle", 0.075), 130 * i),
      );
    }
  }
}
