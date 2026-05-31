/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private musicVolume: GainNode | null = null;
  private sfxVolume: GainNode | null = null;

  // Sound nodes
  private p1EngineOsc: OscillatorNode | null = null;
  private p1EngineGain: GainNode | null = null;
  private p2EngineOsc: OscillatorNode | null = null;
  private p2EngineGain: GainNode | null = null;

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private currentTrackType: string | null = null;
  private musicInterval: any = null;
  private musicFilter: BiquadFilterNode | null = null;

  // Cached values to avoid Web Audio parameter planning flood
  private lastP1Freq: number = 0;
  private lastP2Freq: number = 0;
  private lastP1Volume: number = 0;
  private lastP2Volume: number = 0;

  constructor() {
    // Lazy initialized on first user interaction due to browser security rules
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterVolume.connect(this.ctx.destination);

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);

      this.musicVolume = this.ctx.createGain();
      this.musicVolume.gain.setValueAtTime(0.65, this.ctx.currentTime);
      
      this.musicVolume.connect(this.musicFilter);
      this.musicFilter.connect(this.masterVolume);

      this.sfxVolume = this.ctx.createGain();
      this.sfxVolume.gain.setValueAtTime(0.6, this.ctx.currentTime);
      this.sfxVolume.connect(this.masterVolume);

      this.startContinuousEngines();
    } catch (e) {
      console.warn("Web Audio API is not supported in this environment.", e);
    }
  }

  toggleMute(): boolean {
    this.init();
    if (!this.masterVolume || !this.ctx) return this.isMuted;
    this.isMuted = !this.isMuted;
    const targetGain = this.isMuted ? 0 : 0.5;
    this.masterVolume.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    return this.isMuted;
  }

  getMuteState(): boolean {
    return this.isMuted;
  }

  playClick() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playBeep(frequency: number, duration: number) {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + duration);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playCrash() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    // Bass boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxVolume);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);

    // Noise burst for debris
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.4);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxVolume);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.4);
  }

  playOilSlick() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playBoost() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playSuccess() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const time = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 ascending arpeggio
    notes.forEach((note, index) => {
      if (!this.ctx || !this.sfxVolume) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.sfxVolume);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, time + index * 0.1);
      
      gain.gain.setValueAtTime(0.12, time + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.002, time + index * 0.1 + 0.25);
      
      osc.start(time + index * 0.1);
      osc.stop(time + index * 0.1 + 0.3);
    });
  }

  playCountdown3() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.type = 'square';
    osc.frequency.setValueAtTime(370, time); // F#4
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.18); // retro pitch sweep drop

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.start();
    osc.stop(time + 0.18);
  }

  playCountdown2() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.type = 'square';
    osc.frequency.setValueAtTime(494, time); // B4
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.18); // retro pitch sweep drop

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.start();
    osc.stop(time + 0.18);
  }

  playCountdown1() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.type = 'square';
    osc.frequency.setValueAtTime(659, time); // E5
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.18); // retro sweep drop

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.start();
    osc.stop(time + 0.18);
  }

  playCountdownGo() {
    this.init();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const time = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggiated fanfare
    
    chords.forEach((note, index) => {
      if (!this.ctx || !this.sfxVolume) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.sfxVolume);

      osc.type = index % 2 === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(note, time + index * 0.04);
      osc.frequency.exponentialRampToValueAtTime(note * 1.3, time + index * 0.04 + 0.35);

      gain.gain.setValueAtTime(0.24, time + index * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, time + index * 0.04 + 0.4);

      osc.start(time + index * 0.04);
      osc.stop(time + index * 0.04 + 0.4);
    });

    // laser/engine whistle flourish
    const whistle = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();
    whistle.connect(whistleGain);
    whistleGain.connect(this.sfxVolume);
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(1100, time);
    whistle.frequency.exponentialRampToValueAtTime(2400, time + 0.4);
    whistleGain.gain.setValueAtTime(0.15, time);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    whistle.start(time);
    whistle.stop(time + 0.4);
  }

  private startContinuousEngines() {
    if (!this.ctx || !this.sfxVolume) return;

    // P1 (Black Car) Engine
    this.p1EngineOsc = this.ctx.createOscillator();
    this.p1EngineOsc.type = 'sawtooth';
    this.p1EngineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    this.p1EngineGain = this.ctx.createGain();
    this.p1EngineGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // start silent

    const p1Filter = this.ctx.createBiquadFilter();
    p1Filter.type = 'lowpass';
    p1Filter.frequency.setValueAtTime(150, this.ctx.currentTime);

    this.p1EngineOsc.connect(p1Filter);
    p1Filter.connect(this.p1EngineGain);
    this.p1EngineGain.connect(this.sfxVolume);
    this.p1EngineOsc.start();

    // P2 (White Car) Engine
    this.p2EngineOsc = this.ctx.createOscillator();
    this.p2EngineOsc.type = 'sawtooth';
    this.p2EngineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    this.p2EngineGain = this.ctx.createGain();
    this.p2EngineGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // start silent

    const p2Filter = this.ctx.createBiquadFilter();
    p2Filter.type = 'lowpass';
    p2Filter.frequency.setValueAtTime(150, this.ctx.currentTime);

    this.p2EngineOsc.connect(p2Filter);
    p2Filter.connect(this.p2EngineGain);
    this.p2EngineGain.connect(this.sfxVolume);
    this.p2EngineOsc.start();
  }

  setEnginePitch(p1SpeedRatio: number, p2SpeedRatio: number, active: boolean) {
    this.init();
    if (!this.ctx) return;

    if (!active) {
      if (this.p1EngineGain) this.p1EngineGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
      if (this.p2EngineGain) this.p2EngineGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
      this.lastP1Volume = 0;
      this.lastP2Volume = 0;
      this.lastP1Freq = 0;
      this.lastP2Freq = 0;
      return;
    }

    // Set volumes
    const p1Vol = 0.08 + p1SpeedRatio * 0.05;
    const p2Vol = 0.08 + p2SpeedRatio * 0.05;

    if (Math.abs(p1Vol - this.lastP1Volume) > 0.005) {
      if (this.p1EngineGain) {
        this.p1EngineGain.gain.setTargetAtTime(p1Vol, this.ctx.currentTime, 0.1);
        this.lastP1Volume = p1Vol;
      }
    }
    if (Math.abs(p2Vol - this.lastP2Volume) > 0.005) {
      if (this.p2EngineGain) {
        this.p2EngineGain.gain.setTargetAtTime(p2Vol, this.ctx.currentTime, 0.1);
        this.lastP2Volume = p2Vol;
      }
    }

    // Set frequencies: from idling hum (~45Hz) to top speed roar (~120Hz)
    const p1Freq = 45 + p1SpeedRatio * 75;
    const p2Freq = 45 + p2SpeedRatio * 75;

    if (Math.abs(p1Freq - this.lastP1Freq) > 1.5) {
      if (this.p1EngineOsc) {
        this.p1EngineOsc.frequency.setTargetAtTime(p1Freq, this.ctx.currentTime, 0.15);
        this.lastP1Freq = p1Freq;
      }
    }
    if (Math.abs(p2Freq - this.lastP2Freq) > 1.5) {
      if (this.p2EngineOsc) {
        this.p2EngineOsc.frequency.setTargetAtTime(p2Freq, this.ctx.currentTime, 0.15);
        this.lastP2Freq = p2Freq;
      }
    }
  }

  setMusicPauseFilter(isPaused: boolean) {
    this.init();
    if (!this.ctx || !this.musicFilter) return;
    const targetFreq = isPaused ? 320 : 20000;
    this.musicFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.12);
  }

  private triggerKick(time: number) {
    if (!this.ctx || !this.musicVolume || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    osc.connect(gain);
    gain.connect(this.musicVolume);

    osc.start(time);
    osc.stop(time + 0.14);
  }

  private triggerHihat(time: number, isShort: boolean = true) {
    if (!this.ctx || !this.musicVolume || this.isMuted) return;

    const duration = isShort ? 0.045 : 0.13;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isShort ? 0.06 : 0.045, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.005);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicVolume);

    source.start(time);
    source.stop(time + duration);
  }

  private triggerSnare(time: number) {
    if (!this.ctx || !this.musicVolume || this.isMuted) return;

    // Triangle bass thump
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(170, time);
    bodyOsc.frequency.linearRampToValueAtTime(80, time + 0.075);

    bodyGain.gain.setValueAtTime(0.16, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, time + 0.075);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.musicVolume);
    bodyOsc.start(time);
    bodyOsc.stop(time + 0.08);

    // Filtered noise snap
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1100, time);
    noiseFilter.Q.setValueAtTime(1.8, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.musicVolume);

    noise.start(time);
    noise.stop(time + 0.15);
  }

  private triggerChord(midiNotes: number[], time: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.07) {
    if (!this.ctx || !this.musicVolume || this.isMuted) return;

    const midiToFreq = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

    midiNotes.forEach((note) => {
      if (!this.ctx || !this.musicVolume) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(midiToFreq(note), time);

      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.01);

      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(time);
      osc.stop(time + duration);
    });
  }

  private triggerArpNote(note: number, time: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.06) {
    if (!this.ctx || !this.musicVolume || this.isMuted) return;

    const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(midiToFreq(note), time);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.005);

    osc.connect(gain);
    gain.connect(this.musicVolume);
    osc.start(time);
    osc.stop(time + duration);
  }

  playMusic(trackType: 'ui' | 'speedwayA' | 'speedwayB' | 'speedwayC' | number = 'ui') {
    this.init();
    if (!this.ctx || !this.musicVolume) return;

    // Normalize track input argument
    let track: 'ui' | 'speedwayA' | 'speedwayB' | 'speedwayC';
    if (typeof trackType === 'number') {
      if (trackType === 1 || trackType === 2) {
        track = 'speedwayA';
      } else if (trackType === 3 || trackType === 4) {
        track = 'speedwayB';
      } else {
        track = 'speedwayC';
      }
    } else {
      track = trackType;
    }

    // Avoid restarting the same track
    if (this.isMusicPlaying && this.currentTrackType === track) {
      return;
    }

    this.stopMusic();

    this.isMusicPlaying = true;
    this.currentTrackType = track;
    this.setMusicPauseFilter(false); // remove filter overlay

    let intervalMs = 230; // ~ 130 BPM
    let step = 0;

    const playStep = () => {
      if (!this.ctx || !this.musicVolume || this.isMuted || !this.isMusicPlaying) return;

      const time = this.ctx.currentTime;
      const stepIndex = step % 16;

      if (track === 'ui') {
        const stepDurSec = 0.23;
        // J-Pop Royal Road chord progression
        // Fmaj7 -> G7 -> Em7 -> Am7
        const chordProgressions = [
          [53, 57, 60, 64], // Fmaj7 (steps 0-3)
          [55, 59, 62, 65], // G7 (steps 4-7)
          [52, 55, 59, 62], // Em7 (steps 8-11)
          [57, 60, 64, 67]  // Am7 (steps 12-15)
        ];
        const bassProgressions = [41, 43, 40, 45]; // F2, G2, E2, A2

        const chordIdx = Math.floor(stepIndex / 4);
        const currentChord = chordProgressions[chordIdx];
        const currentBass = bassProgressions[chordIdx];

        // 1. Chords (On downbeats)
        if (stepIndex % 4 === 0) {
          this.triggerChord(currentChord, time, stepDurSec * 3.8, 'triangle', 0.055);
        }

        // 2. Bouncing Bass Line
        if (stepIndex % 2 === 0) {
          this.triggerArpNote(currentBass, time, stepDurSec * 0.95, 'triangle', 0.15);
        } else {
          this.triggerArpNote(currentBass + 12, time, stepDurSec * 0.45, 'sine', 0.08); // upbeat bounce
        }

        // 3. Cute J-Pop Arpeggiated Melody (16th-notes)
        const melodyCycle = [64, 67, 69, 71, 72, 71, 69, 67, 64, 67, 69, 72, 76, 74, 72, 67];
        const melodyNote1 = melodyCycle[stepIndex];
        const melodyNote2 = melodyCycle[(stepIndex + 3) % 16];

        this.triggerArpNote(melodyNote1, time, stepDurSec * 0.45, 'sine', 0.045);
        // Half-beat arpeggio accent
        this.triggerArpNote(melodyNote2, time + stepDurSec / 2, stepDurSec * 0.25, 'square', 0.015);

        // 4. Drum Section
        if (stepIndex % 4 === 0) {
          this.triggerKick(time);
        }
        if (stepIndex % 4 === 2) {
          this.triggerHihat(time, true);
        }
        if (stepIndex === 4 || stepIndex === 12) {
          this.triggerSnare(time);
        }
      } 
      else if (track === 'speedwayA') {
        // Neon D&B J-EDM track - 148 BPM
        const stepDurSec = 0.202;
        // Progression: Am -> F -> G -> Em
        const chords = [
          [57, 60, 64, 69], // Am
          [53, 57, 60, 65], // F
          [55, 59, 62, 67], // G
          [52, 55, 59, 64]  // Em
        ];
        const bassNotes = [33, 29, 31, 32]; // A1, F1, G1, E1

        const chordIdx = Math.floor(stepIndex / 4);
        
        // Chords on beat 1 & 3 of measures
        if (stepIndex % 4 === 0) {
          this.triggerChord(chords[chordIdx], time, stepDurSec * 3.5, 'sine', 0.045);
        }

        // Rolling bassline
        this.triggerArpNote(bassNotes[chordIdx] + 12, time, stepDurSec * 0.7, 'triangle', 0.15);
        if (stepIndex % 2 === 1) {
          this.triggerArpNote(bassNotes[chordIdx] + 24, time, stepDurSec * 0.3, 'sine', 0.08);
        }

        // Accelerated lead line
        const leads = [69, 72, 76, 72, 71, 74, 77, 74, 71, 67, 71, 67, 69, 72, 76, 81];
        this.triggerArpNote(leads[stepIndex], time, stepDurSec * 0.5, 'sawtooth', 0.024);
        this.triggerArpNote(leads[(stepIndex + 2) % 16], time + stepDurSec / 2, stepDurSec * 0.2, 'square', 0.012);

        // D&B Glitch Beats
        if (stepIndex === 0 || stepIndex === 2 || stepIndex === 8 || stepIndex === 10 || stepIndex === 14) {
          this.triggerKick(time);
        }
        if (stepIndex === 4 || stepIndex === 12) {
          this.triggerSnare(time);
        }
        this.triggerHihat(time, stepIndex % 2 === 0);
        this.triggerHihat(time + stepDurSec / 2, true);
      } 
      else if (track === 'speedwayB') {
        // Touge J-Hardcore Synth track - 160 BPM
        const stepDurSec = 0.187;
        // Progression: C -> D -> Em -> Bm
        const chords = [
          [48, 60, 64, 67], // C
          [50, 62, 66, 69], // D
          [40, 64, 67, 71], // Em
          [35, 59, 62, 66]  // Bm
        ];
        const bassNotes = [36, 38, 40, 35]; 

        const chordIdx = Math.floor(stepIndex / 4);

        // Pounding Sidechained Bass simulation (Volume starts low at step trigger and sweeps louder)
        if (this.ctx) {
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

          bassOsc.type = 'sawtooth';
          bassOsc.frequency.setValueAtTime(midiToFreq(bassNotes[chordIdx]), time);
          
          // Sidechain pump envelope shape
          bassGain.gain.setValueAtTime(0.01, time);
          bassGain.gain.linearRampToValueAtTime(0.18, time + stepDurSec * 0.7);
          bassGain.gain.exponentialRampToValueAtTime(0.001, time + stepDurSec - 0.005);

          bassOsc.connect(bassGain);
          bassGain.connect(this.musicVolume);
          bassOsc.start(time);
          bassOsc.stop(time + stepDurSec);
        }

        // Triumphant J-Hardcore Anthem Melody
        const melody = [76, 76, 76, 79, 78, 74, 76, 71, 72, 74, 76, 74, 72, 74, 76, 83];
        this.triggerArpNote(melody[stepIndex], time, stepDurSec * 0.7, 'sawtooth', 0.025);
        this.triggerArpNote(melody[(stepIndex + 4) % 16], time + stepDurSec / 2, stepDurSec * 0.35, 'square', 0.015);

        // 4-on-the-Floor heavy kick
        if (stepIndex % 2 === 0) {
          this.triggerKick(time);
        }
        if (stepIndex === 4 || stepIndex === 12) {
          this.triggerSnare(time);
        }
        if (stepIndex % 4 === 2) {
          this.triggerHihat(time, false); // open sizzling hihat on upbeat
        } else {
          this.triggerHihat(time, true);
        }
      } 
      else if (track === 'speedwayC') {
        // Neo-Tokyo Speedcore Climax track - 172 BPM
        const stepDurSec = 0.174;
        // Dramatic: Gm -> Eb -> Bb -> D
        const chords = [
          [55, 58, 62, 67], // Gm
          [51, 55, 58, 63], // Eb
          [58, 62, 65, 70], // Bb
          [50, 54, 57, 62]  // D
        ];
        const bassNotes = [31, 27, 34, 30];

        const chordIdx = Math.floor(stepIndex / 4);

        if (stepIndex % 4 === 0) {
          this.triggerChord(chords[chordIdx], time, stepDurSec * 3.8, 'square', 0.035);
        }

        // Fast mechanical bass ticks
        this.triggerArpNote(bassNotes[chordIdx] + 12, time, stepDurSec * 0.7, 'sawtooth', 0.14);
        if (stepIndex % 2 === 1) {
          this.triggerArpNote(bassNotes[chordIdx] + 24, time, stepDurSec * 0.3, 'triangle', 0.08);
        }

        // High speed minor piano runs
        const run = [79, 82, 86, 87, 91, 87, 86, 82, 79, 82, 86, 89, 93, 89, 86, 82];
        this.triggerArpNote(run[stepIndex], time, stepDurSec * 0.45, 'triangle', 0.05);
        this.triggerArpNote(run[(stepIndex + 3) % 16], time + stepDurSec / 2, stepDurSec * 0.2, 'square', 0.015);

        // Rapid Double-Step glitchy drum beat
        if (stepIndex === 0 || stepIndex === 3 || stepIndex === 6 || stepIndex === 8 || stepIndex === 11 || stepIndex === 14) {
          this.triggerKick(time);
        }
        if (stepIndex === 4 || stepIndex === 10 || stepIndex === 12 || stepIndex === 15) {
          this.triggerSnare(time);
        }
        this.triggerHihat(time, stepIndex % 2 === 0);
        this.triggerHihat(time + stepDurSec / 2, true);
      }

      step++;
    };

    // Determine the interval timer speed based on track
    if (track === 'ui') intervalMs = 230;
    else if (track === 'speedwayA') intervalMs = 202;
    else if (track === 'speedwayB') intervalMs = 187;
    else if (track === 'speedwayC') intervalMs = 174;

    this.musicInterval = setInterval(playStep, intervalMs);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.isMusicPlaying = false;
    this.currentTrackType = null;
  }
}

const audioEngine = new AudioEngine();
export default audioEngine;
