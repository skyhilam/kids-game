import { onMounted, onUnmounted, ref } from 'vue';
import {
  cancelSpeech,
  initAudio,
  loadVoices,
  playCue,
  resumeAudio,
  speak,
  suspendAudio,
} from '../game/audio';

/** Shared mute chrome + Web Audio unlock for picnic, brush, and delivery. */
export function usePlayAudio() {
  const soundOn = ref(true);
  const toastText = ref('');
  const toastOn = ref(false);
  let toastTimer = 0;

  function toast(text: string): void {
    window.clearTimeout(toastTimer);
    toastText.value = text;
    toastOn.value = true;
    toastTimer = window.setTimeout(() => { toastOn.value = false; }, 2600);
  }

  function toggleSound(): void {
    soundOn.value = !soundOn.value;
    if (soundOn.value) {
      initAudio(true);
      playCue(true, 'unmute');
      speak(true, '聲音已開啟。');
    } else {
      cancelSpeech();
      suspendAudio();
    }
    toast(soundOn.value ? '聲音已開啟' : '聲音已關閉');
  }

  function onVisibility(): void {
    if (document.hidden) {
      cancelSpeech();
      suspendAudio();
    } else if (soundOn.value) {
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
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
  });

  onUnmounted(() => {
    if (window.speechSynthesis?.removeEventListener) {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.clearTimeout(toastTimer);
    cancelSpeech();
    suspendAudio();
  });

  return {
    soundOn,
    toastText,
    toastOn,
    toast,
    toggleSound,
  };
}
