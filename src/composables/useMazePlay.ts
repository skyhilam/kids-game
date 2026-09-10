import { onMounted, onUnmounted, ref } from 'vue';
import {
  cancelSpeech,
  initAudio,
  loadVoices,
  playNotes,
  resumeAudio,
  speak,
  suspendAudio,
} from '../game/audio';
import type { SessionCopy } from '../game/copy';
import type { LevelDef, MoveOk, NodeId, StallReason } from '../game/types';
import { useGameSession } from './useGameSession';

export type MazeSpeech = {
  welcome: string;
  rescue: string;
  win: string;
  winAllDone: string;
  collected?: string;
  stuck: Partial<Record<StallReason, string>>;
};

export function useMazePlay(options: {
  catalog: readonly LevelDef[];
  copy: SessionCopy;
  speech: MazeSpeech;
  confettiPalette: readonly string[];
}) {
  const soundOn = ref(true);
  const toastText = ref('');
  const toastOn = ref(false);
  const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
  let toastTimer = 0;
  let confettiTimer = 0;
  const palette = options.confettiPalette;

  function onSettled(result: MoveOk): void {
    if (result.collectedNow && options.speech.collected) {
      playNotes(soundOn.value, [[523, 0, 0.18], [659, 0.13, 0.18], [784, 0.26, 0.27]]);
      speak(soundOn.value, options.speech.collected);
    }
    if (result.won) {
      playNotes(soundOn.value, [[523, 0, 0.22], [659, 0.15, 0.22], [784, 0.3, 0.22], [1047, 0.48, 0.5]]);
      return;
    }
    if (result.stalled) {
      playNotes(soundOn.value, [[440, 0, 0.2, 0.035], [523, 0.18, 0.3, 0.04]]);
      const line = options.speech.stuck[result.stalled];
      if (line) speak(soundOn.value, line);
    }
  }

  const session = useGameSession({ onSettled }, {
    catalog: options.catalog,
    copy: options.copy,
  });

  function toast(text: string): void {
    window.clearTimeout(toastTimer);
    toastText.value = text;
    toastOn.value = true;
    toastTimer = window.setTimeout(() => { toastOn.value = false; }, 2600);
  }

  function clearConfetti(): void {
    window.clearTimeout(confettiTimer);
    confettiBits.value = [];
  }

  function burstConfetti(): void {
    if (session.reduceMotion) return;
    clearConfetti();
    confettiBits.value = Array.from({ length: 36 }, (_, i) => ({
      i,
      left: `${(i * 47 + 13) % 100}%`,
      bg: palette[i % palette.length],
      delay: `${i % 9 * 0.07}s`,
      duration: `${2.3 + (i % 7) * 0.15}s`,
      round: i % 3 === 0,
      drift: `${(i % 5 - 2) * 28}px`,
    }));
    confettiTimer = window.setTimeout(() => { confettiBits.value = []; }, 4400);
  }

  function onWinRevealed(): void {
    burstConfetti();
    speak(soundOn.value, session.allDone.value ? options.speech.winAllDone : options.speech.win);
  }

  function speakAnnounce(): void {
    speak(soundOn.value, session.announce.value);
  }

  function move(to: NodeId): void {
    const result = session.requestMove(to);
    if (!result.ok) {
      if (result.reason === 'used-road') toast('此段橙色道路已經通行，請改選其他路線。');
      return;
    }
    playNotes(soundOn.value, [[430, 0, 0.10, 0.045], [510, 0.07, 0.12, 0.035]]);
  }

  function welcomeStart(): void {
    if (!session.welcomeStart()) return;
    initAudio(soundOn.value);
    playNotes(soundOn.value, [[523, 0, 0.16], [659, 0.12, 0.22]]);
    speak(soundOn.value, options.speech.welcome);
  }

  function onHint(): void {
    const result = session.requestHint();
    if (result === 'blocked') return;
    playNotes(soundOn.value, [[660, 0, 0.15], [880, 0.11, 0.22]]);
    if (result === 'hint') speak(soundOn.value, session.guideMain.value);
    else speak(soundOn.value, options.speech.rescue);
  }

  function toggleSound(): void {
    soundOn.value = !soundOn.value;
    if (soundOn.value) {
      initAudio(true);
      playNotes(true, [[659, 0, 0.17]]);
      speak(true, '聲音已開啟。');
    } else {
      cancelSpeech();
      suspendAudio();
    }
    toast(soundOn.value ? '聲音已開啟' : '聲音已關閉');
  }

  function onRestart(): void {
    if (!session.restart()) return;
    clearConfetti();
    cancelSpeech();
    playNotes(soundOn.value, [[523, 0, 0.18]]);
    speakAnnounce();
  }

  function onJump(index: number): void {
    if (!session.jump(index)) return;
    clearConfetti();
    speakAnnounce();
  }

  function onRetry(): void {
    if (!session.retry()) return;
    clearConfetti();
    speakAnnounce();
  }

  function onNext(): void {
    if (!session.next()) return;
    clearConfetti();
    speakAnnounce();
  }

  function onReplay(): void {
    if (!session.replay()) return;
    clearConfetti();
    speakAnnounce();
  }

  function showHelp(): void {
    cancelSpeech();
    session.showHelp();
  }

  function onResize(): void {
    session.applyLayout();
  }

  function onVisibility(): void {
    if (document.hidden) {
      cancelSpeech();
      suspendAudio();
    } else if (session.started.value && soundOn.value) {
      resumeAudio(true);
    }
  }

  function onPageHide(): void {
    cancelSpeech();
    suspendAudio();
  }

  onMounted(() => {
    loadVoices();
    if (window.speechSynthesis?.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
  });

  onUnmounted(() => {
    if (window.speechSynthesis?.removeEventListener) {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.clearTimeout(toastTimer);
    clearConfetti();
    cancelSpeech();
    suspendAudio();
  });

  return {
    session,
    soundOn,
    toastText,
    toastOn,
    confettiBits,
    move,
    welcomeStart,
    onHint,
    toggleSound,
    onRestart,
    onJump,
    onRetry,
    onNext,
    onReplay,
    showHelp,
    onWinRevealed,
  };
}
