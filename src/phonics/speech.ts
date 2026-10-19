import { speakEnglish } from '../game/audio';

/** Speak an English phonics target. Mute and missing speech stay silent. */
export function speakPhonics(soundOn: boolean, text: string): void {
  try {
    if (!soundOn) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    speakEnglish(true, text);
  } catch {
    /* Speech is optional. A zone must stay completable without it. */
  }
}

/** True only when the browser exposes speech synthesis. Safe during SSR and tests. */
export function phonicsAudioAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis != null;
  } catch {
    return false;
  }
}
