import { speakEnglish } from '../game/audio';
import { WORD_EN, type WordId } from './words';

export const STICKER_ONBOARD_KEY = 'kids-sticker-onboard';

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Hear the English label. The sprite id is never spoken. */
export function speakStickerWord(soundOn: boolean, id: WordId): void {
  speakEnglish(soundOn, WORD_EN[id]);
}

export function readStickerOnboardSeen(store?: Storage | null): boolean {
  try {
    return (store ?? storage())?.getItem(STICKER_ONBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

export function markStickerOnboardSeen(store?: Storage | null): void {
  try {
    (store ?? storage())?.setItem(STICKER_ONBOARD_KEY, '1');
  } catch {
    /* Persistence is optional. */
  }
}

/** Wrong drop names the correct slot in text, so missing audio is not a dead end. */
export function wrongDropFeedback(sticker: WordId): {
  hintSlot: WordId;
  speakId: WordId;
  message: string;
} {
  return {
    hintSlot: sticker,
    speakId: sticker,
    message: `再試一次，正確格係 ${WORD_EN[sticker]}。`,
  };
}
