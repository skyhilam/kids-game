import { speak, speakEnglish } from '../game/audio';
import { WORD_EN, WORD_ZH, type WordId } from '../sticker/words';

export type ListenLang = 'en' | 'yue';

export const LISTEN_LANG_DEFAULT: ListenLang = 'en';
export const LISTEN_LANG_KEY = 'kids-listen-lang';

export function parseListenLang(value: unknown): ListenLang {
  return value === 'yue' ? 'yue' : 'en';
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readListenLang(store?: Storage | null): ListenLang {
  try {
    return parseListenLang((store ?? storage())?.getItem(LISTEN_LANG_KEY));
  } catch {
    return LISTEN_LANG_DEFAULT;
  }
}

export function writeListenLang(lang: ListenLang, store?: Storage | null): void {
  try {
    (store ?? storage())?.setItem(LISTEN_LANG_KEY, lang);
  } catch {
    /* Persistence is optional. */
  }
}

/** Speak the target in exactly one language. Mute and missing Yue voices stay silent. */
export function speakListenWord(soundOn: boolean, lang: ListenLang, id: WordId): void {
  if (!soundOn) return;
  if (lang === 'en') {
    speakEnglish(true, WORD_EN[id]);
    return;
  }
  speak(true, WORD_ZH[id]);
}
