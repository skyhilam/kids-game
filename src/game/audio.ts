type Note = [number, number, number, number?];

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

export function playNotes(soundOn: boolean, notes: Note[]): void {
  if (!soundOn) return;
  initAudio(true);
  if (!audio) return;
  try {
    notes.forEach(([hz, offset, length, volume = 0.07]) => {
      if (!audio) return;
      const now = audio.currentTime + offset;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.016);
      gain.gain.exponentialRampToValueAtTime(0.001, now + length);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + length + 0.04);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  } catch {
    /* Sound is optional; gameplay must remain available. */
  }
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
