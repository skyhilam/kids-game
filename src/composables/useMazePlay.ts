import { onMounted, onUnmounted, ref } from 'vue';
import {
  cancelSpeech,
  initAudio,
  playCue,
  speak,
} from '../game/audio';
import type { SessionCopy } from '../game/copy';
import type { LevelDef, LevelSource, MoveOk, NodeId, StallReason } from '../game/types';
import { useGameSession } from './useGameSession';
import { usePlayAudio } from './usePlayAudio';

export type MazeSpeech = {
  welcome: string;
  rescue: string;
  win: string;
  winAllDone: string;
  collected?: string;
  stuck: Partial<Record<StallReason, string>>;
};

export function useMazePlay(options: {
  catalog: LevelSource;
  picks?: readonly LevelDef[];
  copy: SessionCopy;
  speech: MazeSpeech;
  confettiPalette: readonly string[];
}) {
  const { soundOn, toastText, toastOn, toast, toggleSound } = usePlayAudio();
  const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
  let confettiTimer = 0;
  const palette = options.confettiPalette;

  function onSettled(result: MoveOk): void {
    if (result.collectedNow && options.speech.collected) {
      playCue(soundOn.value, 'collect');
      speak(soundOn.value, options.speech.collected);
    }
    if (result.won) {
      playCue(soundOn.value, 'win');
      return;
    }
    if (result.stalled) {
      playCue(soundOn.value, 'fail');
      const line = options.speech.stuck[result.stalled];
      if (line) speak(soundOn.value, line);
    }
  }

  const session = useGameSession({ onSettled }, {
    catalog: options.catalog,
    picks: options.picks,
    copy: options.copy,
  });

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
    playCue(soundOn.value, 'move');
  }

  function welcomeStart(): void {
    if (!session.welcomeStart()) return;
    initAudio(soundOn.value);
    playCue(soundOn.value, 'welcome');
    speak(soundOn.value, options.speech.welcome);
  }

  function onHint(): void {
    const result = session.requestHint();
    if (result === 'blocked') return;
    playCue(soundOn.value, 'hint');
    if (result === 'hint') speak(soundOn.value, session.guideMain.value);
    else speak(soundOn.value, options.speech.rescue);
  }

  function onRestart(): void {
    if (!session.restart()) return;
    clearConfetti();
    cancelSpeech();
    playCue(soundOn.value, 'restart');
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

  onMounted(() => {
    window.addEventListener('resize', onResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', onResize);
    clearConfetti();
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
