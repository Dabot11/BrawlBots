const AUDIO_KEY = "brawl-bots-audio-v1";
export class Sound {
  constructor() {
    this.context = null;
    this.volume = 0.45;
    this.muted = false;
    this.voices = new Set();
    this.lastCountdown = null;
    try {
      const saved = JSON.parse(window.localStorage.getItem(AUDIO_KEY));
      if (typeof saved?.volume === "number" && Number.isFinite(saved.volume))
        this.volume = Math.max(0, Math.min(1, saved.volume));
      if (typeof saved?.muted === "boolean") this.muted = saved.muted;
    } catch {}
  }
  unlock() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) {
        this.context = new Audio();
        this.initGraph();
      }
    }
    if (this.context?.state === "suspended")
      this.context.resume().catch(() => {});
  }
  initGraph() {
    const ctx = this.context;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;
    this.master.connect(this.compressor);
    this.compressor.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = this.noise.getChannelData(0);
    let seed = 113;
    for (let i = 0; i < samples.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    this.motor = ctx.createOscillator();
    this.motor.type = "triangle";
    this.motor.frequency.value = 55;
    this.motorHarmonic = ctx.createOscillator();
    this.motorHarmonic.type = "sine";
    this.motorHarmonic.frequency.value = 110;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorGain);
    this.motorHarmonic.connect(this.motorGain);
    this.motorGain.connect(this.master);
    this.motor.start();
    this.motorHarmonic.start();
  }
  save() {
    try {
      window.localStorage.setItem(
        AUDIO_KEY,
        JSON.stringify({ volume: this.volume, muted: this.muted }),
      );
    } catch {}
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyVolume();
    this.save();
  }
  setMuted(value) {
    this.muted = value;
    this.applyVolume();
    this.save();
  }
  applyVolume() {
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.context.currentTime,
        0.02,
      );
  }
  voice(source, duration, volume, filter, pan = 0, offset = 0) {
    const ctx = this.context;
    if (this.voices.size >= 32) {
      source.disconnect();
      return;
    }
    const gain = ctx.createGain(),
      panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.75, Math.min(0.75, pan));
    const now = ctx.currentTime + offset;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 2.4, now + 0.006);
    gain.gain.setValueAtTime(
      volume * 2.4,
      now + Math.min(0.025, duration * 0.2),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter || gain);
    if (filter) filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    source.start(now);
    source.stop(now + duration + 0.02);
  }
  tone(
    frequency,
    duration,
    type = "sine",
    volume = 0.08,
    endFrequency = frequency,
    pan = 0,
    offset = 0,
  ) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const oscillator = this.context.createOscillator(),
      now = this.context.currentTime + offset;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      now + duration,
    );
    this.voice(oscillator, duration, volume, null, pan, offset);
  }
  scrape(frequency, duration, volume, type = "bandpass", pan = 0) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const source = this.context.createBufferSource(),
      filter = this.context.createBiquadFilter();
    source.buffer = this.noise;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    this.voice(source, duration, volume, filter, pan);
  }
  ui(kind) {
    if (kind === "equip") {
      this.tone(540, 0.08, "triangle", 0.065, 280);
      this.scrape(1800, 0.09, 0.08);
    } else
      this.tone(
        kind === "enter" ? 360 : 640,
        0.09,
        "sine",
        0.055,
        kind === "enter" ? 620 : 760,
      );
  }
  cancelTransient() {
    this.silenceMotor();
    for (const source of this.voices) {
      try {
        source.stop();
      } catch {}
    }
    this.lastCountdown = null;
  }
  setMotorLevel(value) {
    if (!this.motorGain) return;
    const now = this.context.currentTime;
    if (this.motorLevel !== value) {
      const gain = this.motorGain.gain;
      if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
      else {
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
      }
      gain.linearRampToValueAtTime(value, now + 0.04);
      this.motorLevel = value;
    }
  }
  silenceMotor() {
    this.setMotorLevel(0);
  }
  update(sim) {
    if (!this.context || !this.motorGain) return;
    const player = sim.robots[0],
      now = this.context.currentTime;
    const drive =
      sim.state === "playing"
        ? Math.min(1, Math.abs(player.speedNow) / player.speed)
        : 0;
    this.motor.frequency.setTargetAtTime(48 + drive * 65, now, 0.08);
    this.motorHarmonic.frequency.setTargetAtTime(96 + drive * 130, now, 0.08);
    const motorLevel = drive > 0.02 ? 0.022 + drive * 0.025 : 0;
    this.setMotorLevel(motorLevel);
    if (sim.state === "countdown") {
      const number = Math.ceil(sim.countdown);
      if (number !== this.lastCountdown) {
        this.tone(360, 0.13, "sine", 0.13, 320);
        this.lastCountdown = number;
      }
    } else if (sim.state !== "paused") this.lastCountdown = null;
  }
  event(event, sim) {
    const player = sim?.robots[0];
    let pan = 0;
    if (player && Number.isFinite(event.x) && Number.isFinite(event.z))
      pan =
        ((event.x - player.x) * Math.cos(player.angle) +
          (event.z - player.z) * Math.sin(player.angle)) /
        10;
    const loudness = event.owner === 1 ? 0.65 : 1;
    if (event.type === "attack") {
      if (event.weapon === "saw") {
        this.scrape(1200, 0.15, 0.07 * loudness);
        this.tone(140, 0.13, "sawtooth", 0.022 * loudness, 180);
      } else if (event.weapon === "hammer") {
        this.scrape(450, 0.22, 0.1 * loudness, "lowpass");
        this.tone(130, 0.2, "triangle", 0.055 * loudness, 55);
      } else if (event.weapon === "mace") {
        this.scrape(850, 0.23, 0.09 * loudness);
        this.tone(170, 0.18, "triangle", 0.045 * loudness, 85);
      } else if (event.weapon === "wedge") {
        this.scrape(380, 0.19, 0.07 * loudness, "lowpass");
        this.tone(90, 0.18, "triangle", 0.04 * loudness, 190);
      } else if (event.weapon === "forks") {
        this.tone(340, 0.11, "triangle", 0.035 * loudness, 140);
        this.tone(460, 0.1, "sine", 0.025 * loudness, 180, 0, 0.025);
        this.scrape(2600, 0.09, 0.035 * loudness);
      } else {
        this.tone(240, 0.13, "triangle", 0.045 * loudness, 90);
        this.scrape(2200, 0.09, 0.04 * loudness);
      }
    }
    if (event.type === "damage") {
      this.tone(95, 0.18, "sine", 0.22, 38, pan);
      this.tone(780, 0.14, "triangle", 0.075, 530, pan);
      this.scrape(2600, 0.11, 0.18, "highpass", pan);
    }
    if (event.type === "flip") {
      this.tone(100, 0.3, "triangle", 0.09, 260);
      this.scrape(480, 0.23, 0.09, "lowpass");
    }
    if (event.type === "destroy") {
      this.scrape(380, 0.65, 0.32, "lowpass", pan);
      this.tone(60, 0.55, "sine", 0.26, 18, pan);
      this.tone(920, 0.3, "triangle", 0.06, 110, pan);
    }
    if (event.type === "start") {
      this.tone(520, 0.15, "sine", 0.13, 740);
      this.tone(1040, 0.2, "sine", 0.06, 1040, 0, 0.1);
    }
    if (event.type === "result") {
      const notes =
        event.winner === 0
          ? [330, 440, 554, 659]
          : event.winner === -1
            ? [392, 392]
            : [294, 220, 165];
      notes.forEach((note, index) =>
        this.tone(note, 0.32, "triangle", 0.095, note, 0, index * 0.14),
      );
    }
  }
}
