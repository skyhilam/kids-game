export type Wave = 'sine' | 'triangle' | 'square';

export type Tone = {
  hz: number;
  offset: number;
  length: number;
  volume?: number;
  wave?: Wave;
  /** Optional end frequency for a slide; keeps win/fail timbres distinct. */
  glide?: number;
};

export const CUES = {
  /** Short bright tick on every successful step. */
  move: [
    { hz: 784, offset: 0, length: 0.07, volume: 0.09, wave: 'triangle' },
    { hz: 1047, offset: 0.04, length: 0.06, volume: 0.055, wave: 'triangle' },
  ],
  /** Cheerful mid phrase when a picnic burger / parcel arrives. */
  collect: [
    { hz: 659, offset: 0, length: 0.12, volume: 0.09, wave: 'triangle' },
    { hz: 831, offset: 0.1, length: 0.12, volume: 0.085, wave: 'triangle' },
    { hz: 988, offset: 0.2, length: 0.2, volume: 0.07, wave: 'sine' },
  ],
  /** Rising major sparkle — longer and higher than move/collect. */
  win: [
    { hz: 523, offset: 0, length: 0.16, volume: 0.1, wave: 'triangle' },
    { hz: 659, offset: 0.12, length: 0.16, volume: 0.1, wave: 'triangle' },
    { hz: 784, offset: 0.24, length: 0.16, volume: 0.1, wave: 'triangle' },
    { hz: 1047, offset: 0.4, length: 0.28, volume: 0.11, wave: 'sine' },
    { hz: 1319, offset: 0.56, length: 0.38, volume: 0.08, wave: 'sine' },
  ],
  /** Dark descending square slide — stuck, cavity, or equivalent. */
  fail: [
    { hz: 311, offset: 0, length: 0.22, volume: 0.055, wave: 'square', glide: 247 },
    { hz: 196, offset: 0.16, length: 0.4, volume: 0.05, wave: 'square', glide: 147 },
  ],
  welcome: [
    { hz: 523, offset: 0, length: 0.16, volume: 0.08, wave: 'triangle' },
    { hz: 659, offset: 0.12, volume: 0.08, length: 0.22, wave: 'sine' },
  ],
  hint: [
    { hz: 698, offset: 0, length: 0.12, volume: 0.07, wave: 'triangle' },
    { hz: 880, offset: 0.1, length: 0.18, volume: 0.075, wave: 'sine' },
  ],
  restart: [
    { hz: 523, offset: 0, length: 0.16, volume: 0.07, wave: 'triangle' },
  ],
  unmute: [
    { hz: 659, offset: 0, length: 0.15, volume: 0.08, wave: 'triangle' },
  ],
} as const satisfies Record<string, readonly Tone[]>;

export type CueName = keyof typeof CUES;

let audio: AudioContext | null = null;
let voice: SpeechSynthesisVoice | null = null;

export function loadVoices(): void {
  try {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    voice = voices.find((item) => /^(zh[-_]HK|yue)([-_]|$)/i.test(item.lang))
      || voices.find((item) => /cantonese|廣東話|粤语|粵語/i.test(item.name))
      || null;
  } catch {
    voice = null;
  }
}

export function initAudio(soundOn: boolean): void {
  if (!soundOn) return;
  try {
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && AC) audio = new AC();
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

export function playNotes(soundOn: boolean, notes: readonly Tone[]): void {
  if (!soundOn) return;
  initAudio(true);
  if (!audio) return;
  try {
    notes.forEach((tone) => {
      if (!audio) return;
      const now = audio.currentTime + tone.offset;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const volume = tone.volume ?? 0.07;
      osc.type = tone.wave ?? 'sine';
      osc.frequency.setValueAtTime(tone.hz, now);
      if (tone.glide && tone.glide > 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(tone.glide, 1), now + Math.max(tone.length, 0.02));
      }
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.length);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + tone.length + 0.04);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  } catch {
    /* Sound is optional; gameplay must remain available. */
  }
}

export function playCue(soundOn: boolean, name: CueName): void {
  playNotes(soundOn, CUES[name]);
}

export function speak(soundOn: boolean, text: string): void {
  if (!soundOn || !window.speechSynthesis) return;
  try {
    loadVoices();
    if (!voice) return;
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(text);
    message.voice = voice;
    message.lang = voice.lang;
    message.rate = 0.83;
    message.pitch = 1.08;
    message.volume = 0.85;
    window.speechSynthesis.speak(message);
  } catch {
    /* Speech is optional. */
  }
}

export function cancelSpeech(): void {
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function suspendAudio(): void {
  if (audio) audio.suspend().catch(() => {});
}

export function resumeAudio(soundOn: boolean): void {
  if (soundOn && audio) audio.resume().catch(() => {});
}
