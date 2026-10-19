<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { usePlayAudio } from '../composables/usePlayAudio';
import { cancelSpeech, initAudio, playCue } from '../game/audio';
import { randomSeed } from '../game/rng';
import { PHONICS_COPY as copy, PHONICS_LESSONS } from '../phonics/copy';
import {
  isZoneUnlocked, parentSummary, readPhonicsProgress, recordRound,
  recordWrongBookReview, writePhonicsProgress,
} from '../phonics/progress';
import {
  dealPhonicsRound, dealWrongBook, optionLabel, scoreRound,
  type PhonicsQuestion, type PhonicsRoundScore, type PhonicsTap,
} from '../phonics/round';
import { phonicsAudioAvailable, speakPhonics } from '../phonics/speech';
import { PHONICS_ZONES, phonicsZone, type PhonicsZoneId } from '../phonics/zones';
import MazeDialog from './MazeDialog.vue';
import PhonicsArt from './PhonicsArt.vue';
import PlayChrome from './PlayChrome.vue';

const emit = defineEmits<{ home: [] }>();
const { soundOn, toastText, toastOn, toast, toggleSound } = usePlayAudio();
const save = ref(readPhonicsProgress());
const screen = ref<'map' | 'tutorial' | 'round' | 'summary'>('map');
const overlay = ref<'help' | 'result' | 'reviewDone' | null>(null);
const selectedZone = ref<PhonicsZoneId>(1);
const questions = ref<PhonicsQuestion[]>([]);
const answers = ref<PhonicsTap[]>([]);
const questionIndex = ref(0);
const reviewing = ref(false);
const feedback = ref<{ value: string; correct: boolean } | null>(null);
const result = ref<PhonicsRoundScore | null>(null);
const audioAvailable = ref(phonicsAudioAvailable());
const questionHeading = ref<HTMLElement | null>(null);
const confettiBits = ref<{
  i: number; left: string; bg: string; delay: string;
  duration: string; round: boolean; drift: string;
}[]>([]);
let advanceTimer = 0;
let confettiTimer = 0;
let disposed = false;
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

const question = computed(() => questions.value[questionIndex.value]);
const zone = computed(() => phonicsZone(
  screen.value === 'round' && question.value ? question.value.zoneId : selectedZone.value,
));
const lesson = computed(() => PHONICS_LESSONS[zone.value.id]);
const nextZone = computed(() => PHONICS_ZONES.find((item) => item.id === selectedZone.value + 1));
const summary = computed(() => parentSummary(save.value));
const wrongCount = computed(() => PHONICS_ZONES.reduce((count, item) => count + save.value.zones[item.id].wrongBook.length, 0));
const clearedCount = computed(() => PHONICS_ZONES.filter((item) => save.value.zones[item.id].cleared).length);
const visualMode = computed(() => !soundOn.value || !audioAvailable.value);
const correctOptions = computed(() => question.value ? [question.value.answer, ...(question.value.accept ?? [])] : []);
const answerText = computed(() => question.value
  ? correctOptions.value.map((id) => optionLabel(question.value!, id)).join(' / ') : '');
const choices = computed(() => {
  if (!question.value) return [];
  // Silent-letter ids identify positions, including repeated letters in one word.
  return zone.value.kind === 'silent'
    ? [...question.value.options].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    : question.value.options;
});
const prompt = computed(() => {
  if (zone.value.kind === 'silent') return copy.round.promptSilent;
  if (zone.value.kind === 'long-vowel') return copy.round.promptLong;
  const item = zone.value.items.find((entry) => entry.id === question.value?.itemId);
  return item?.position === 'end' ? copy.round.promptEnd : copy.round.prompt;
});

function clearEffects(): void {
  window.clearTimeout(advanceTimer);
  window.clearTimeout(confettiTimer);
  confettiBits.value = [];
  cancelSpeech();
}

function discardRound(): void {
  clearEffects();
  questions.value = [];
  answers.value = [];
  questionIndex.value = 0;
  feedback.value = null;
  result.value = null;
  reviewing.value = false;
  overlay.value = null;
}

function goMap(): void {
  discardRound();
  screen.value = 'map';
}

function goHome(): void {
  goMap();
  emit('home');
}

function enterZone(id: PhonicsZoneId): void {
  if (!isZoneUnlocked(save.value, id)) {
    toast(copy.map.enterLocked);
    return;
  }
  discardRound();
  selectedZone.value = id;
  screen.value = 'tutorial';
}

function readText(text: string): void {
  audioAvailable.value = phonicsAudioAvailable();
  cancelSpeech();
  if (visualMode.value) {
    toast(soundOn.value ? copy.noAudio : copy.muted);
    return;
  }
  initAudio(true);
  speakPhonics(true, text);
}

function readTutorial(): void {
  readText(zone.value.tutorial.map((word) => word.en.replaceAll('/', ',')).join('. '));
}

function speakTarget(): void {
  if (screen.value !== 'round' || overlay.value || feedback.value || !question.value) return;
  readText(question.value.say);
}

function focusQuestion(): void {
  void nextTick(() => {
    if (!disposed && screen.value === 'round' && !overlay.value) questionHeading.value?.focus({ preventScroll: true });
  });
}

function startRound(): void {
  clearEffects();
  questions.value = dealPhonicsRound(selectedZone.value, randomSeed());
  answers.value = [];
  questionIndex.value = 0;
  feedback.value = null;
  result.value = null;
  reviewing.value = false;
  overlay.value = null;
  screen.value = 'round';
  initAudio(soundOn.value);
  speakTarget();
  focusQuestion();
}

function startReview(): void {
  if (!wrongCount.value) return;
  discardRound();
  questions.value = PHONICS_ZONES.flatMap((item) => dealWrongBook(item.id, save.value.zones[item.id].wrongBook, randomSeed()));
  reviewing.value = true;
  screen.value = 'round';
  speakTarget();
  focusQuestion();
}

function burstConfetti(): void {
  if (reduceMotion) return;
  const palette = ['#e8a084', '#efc76b', '#b8cf9b', '#8ebebf'];
  confettiBits.value = Array.from({ length: 28 }, (_, i) => ({
    i, left: `${(i * 43 + 11) % 100}%`, bg: palette[i % palette.length]!,
    delay: `${i % 7 * 0.07}s`, duration: `${2.2 + i % 5 * 0.15}s`,
    round: i % 3 === 0, drift: `${(i % 5 - 2) * 25}px`,
  }));
  confettiTimer = window.setTimeout(() => { confettiBits.value = []; }, 4000);
}

function isCorrect(target: PhonicsQuestion, value: string): boolean {
  return value === target.answer || (target.accept?.includes(value) ?? false);
}

function finishRound(): void {
  cancelSpeech();
  if (reviewing.value) {
    // Commit the review as one round too: leaving early never edits the saved book.
    let updated = save.value;
    for (const item of PHONICS_ZONES) {
      const correctIds = questions.value.filter((target, index) => target.zoneId === item.id
        && isCorrect(target, answers.value[index]?.value ?? '')).map((target) => target.itemId);
      updated = recordWrongBookReview(updated, item.id, correctIds);
    }
    save.value = updated;
    writePhonicsProgress(save.value);
    overlay.value = 'reviewDone';
    return;
  }
  result.value = scoreRound(selectedZone.value, questions.value, answers.value);
  save.value = recordRound(save.value, selectedZone.value, result.value);
  writePhonicsProgress(save.value);
  overlay.value = 'result';
  if (result.value.passed) {
    playCue(soundOn.value, 'win');
    burstConfetti();
  }
}

function scheduleAdvance(): void {
  window.clearTimeout(advanceTimer);
  advanceTimer = window.setTimeout(() => {
    if (disposed || screen.value !== 'round' || overlay.value || !feedback.value) return;
    if (questionIndex.value + 1 === questions.value.length) {
      finishRound();
      return;
    }
    questionIndex.value += 1;
    feedback.value = null;
    speakTarget();
    focusQuestion();
  }, reduceMotion ? 0 : 600);
}

function onAnswer(value: string): void {
  const target = question.value;
  if (screen.value !== 'round' || overlay.value || feedback.value || !target || !target.options.includes(value)) return;
  cancelSpeech();
  const correct = isCorrect(target, value);
  answers.value.push({ itemId: target.itemId, value });
  feedback.value = { value, correct };
  playCue(soundOn.value, correct ? 'collect' : 'hint');
  scheduleAdvance();
}

function showHelp(): void {
  if (overlay.value) return;
  window.clearTimeout(advanceTimer);
  cancelSpeech();
  overlay.value = 'help';
}

function closeHelp(): void {
  if (overlay.value !== 'help') return;
  overlay.value = null;
  if (screen.value === 'round' && feedback.value) scheduleAdvance();
  else speakTarget();
}

function changeSound(): void {
  toggleSound();
  audioAvailable.value = phonicsAudioAvailable();
  if (soundOn.value) speakTarget();
}

onUnmounted(() => {
  disposed = true;
  clearEffects();
});
</script>

<template>
  <main class="app phonics-game" :data-phonics-screen="screen" :data-phonics-reviewing="reviewing">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo"><PhonicsArt /></div>
        <div><div class="eyebrow">{{ copy.titleEn }}</div><h1>{{ copy.title }}</h1></div>
      </div>
      <div class="top-actions">
        <button class="action-button" type="button" @click="goHome">{{ copy.home }}</button>
        <button class="icon-button" type="button" :aria-label="soundOn ? '關閉音效' : '開啟音效'" :aria-pressed="soundOn" title="開關音效" @click="changeSound">
          <svg aria-hidden="true"><use :href="soundOn ? '#i-sound' : '#i-muted'" /></svg>
        </button>
        <button class="icon-button" type="button" aria-label="遊戲說明" title="遊戲說明" :disabled="overlay !== null" @click="showHelp">
          <svg aria-hidden="true"><use href="#i-help" /></svg>
        </button>
      </div>
    </header>

    <section v-if="screen === 'map'" class="phonics-panel" aria-labelledby="phonics-map-title">
      <div class="phonics-section-head">
        <div><p class="eyebrow">{{ copy.mission }}</p><h2 id="phonics-map-title">{{ copy.map.title }}</h2></div>
        <span class="stage-chip">{{ clearedCount }} / 8 已蓋印</span>
      </div>
      <p>{{ copy.map.note }}</p>
      <p v-if="clearedCount === 8" class="phonics-success">{{ copy.map.allClear }}</p>
      <div class="phonics-map">
        <button
          v-for="item in PHONICS_ZONES" :key="item.id" type="button" class="phonics-zone"
          :class="{ locked: !isZoneUnlocked(save, item.id), stamped: save.zones[item.id].cleared }"
          :data-phonics-zone="item.id" :data-locked="!isZoneUnlocked(save, item.id)"
          :data-best-stars="save.zones[item.id].bestStars"
          :aria-label="`${item.id} ${item.nameZh}，${!isZoneUnlocked(save, item.id) ? copy.map.locked : copy.map.enter}，${copy.map.starsLabel} ${save.zones[item.id].bestStars}`"
          @click="enterZone(item.id)"
        >
          <PhonicsArt :zone="item.id" class="phonics-island" />
          <strong>{{ item.id }} · {{ item.nameZh }}</strong>
          <small lang="en">{{ item.nameEn }}</small>
          <span class="phonics-zone-state">
            <span class="phonics-stars" aria-hidden="true"><PhonicsArt v-for="n in 3" :key="n" kind="star" :filled="n <= save.zones[item.id].bestStars" /></span>
            <PhonicsArt v-if="!isZoneUnlocked(save, item.id)" kind="lock" class="phonics-state-art" />
            <PhonicsArt v-else-if="save.zones[item.id].cleared" kind="stamp" class="phonics-state-art" />
          </span>
          <small>{{ !isZoneUnlocked(save, item.id) ? copy.map.locked : save.zones[item.id].cleared ? copy.map.stamped : copy.map.open }}</small>
        </button>
      </div>
      <div class="phonics-actions">
        <button class="action-button" type="button" @click="screen = 'summary'">{{ copy.map.summary }}</button>
        <button v-if="wrongCount" class="action-button" type="button" data-phonics-review @click="startReview">重溫錯題（{{ wrongCount }}）</button>
      </div>
    </section>

    <section v-else-if="screen === 'tutorial'" class="phonics-panel phonics-tutorial" :data-phonics-tutorial="zone.id" aria-labelledby="phonics-tutorial-title">
      <PhonicsArt :zone="zone.id" class="phonics-tutorial-art" />
      <p class="eyebrow">{{ copy.tutorial.eyebrow }} · {{ zone.id }} / 8</p>
      <h2 id="phonics-tutorial-title">{{ lesson.title }}</h2>
      <p class="phonics-lesson">{{ lesson.body }}</p>
      <ul class="phonics-examples" aria-label="例字">
        <li v-for="word in zone.tutorial" :key="word.en"><strong lang="en">{{ word.en }}</strong><span>{{ word.zh }}</span></li>
      </ul>
      <p>答對 {{ zone.need }} / {{ zone.total }} 題，就可以蓋印。</p>
      <div class="phonics-actions">
        <button class="action-button" type="button" @click="readTutorial">讀一讀</button>
        <button class="primary-button" type="button" data-phonics-start @click="startRound">{{ copy.tutorial.begin }}</button>
        <button class="action-button" type="button" @click="goMap">{{ copy.tutorial.back }}</button>
      </div>
    </section>

    <section
      v-else-if="screen === 'round' && question" class="phonics-panel phonics-round"
      :data-phonics-answer="correctOptions.join(',')" :data-phonics-item="question.itemId"
      :data-phonics-active-zone="zone.id" aria-labelledby="phonics-question-title"
    >
      <div class="phonics-section-head">
        <strong>{{ reviewing ? copy.retry.title + ' · ' : '' }}{{ zone.nameZh }}</strong>
        <span class="stage-chip" data-phonics-progress>{{ copy.round.progress(questionIndex + 1, questions.length) }}</span>
      </div>
      <progress :value="questionIndex + 1" :max="questions.length" aria-label="答題進度" />
      <h2 id="phonics-question-title" ref="questionHeading" tabindex="-1">{{ prompt }}</h2>
      <div class="phonics-question-card">
        <strong lang="en" class="phonics-word" data-phonics-show>{{ question.show }}</strong>
        <p data-phonics-zh>{{ question.zh }}</p>
      </div>
      <div v-if="visualMode" class="phonics-visual-cue" data-phonics-visual>
        <PhonicsArt kind="mouth" :cue="question.cue" :label="copy.cue[question.cue]" />
        <div><strong>{{ copy.cue[question.cue] }}</strong><p>{{ !soundOn ? copy.muted : copy.noAudio }} 睇住上面嘅字同提示揀答案。</p></div>
      </div>
      <div class="phonics-choices" :class="{ 'phonics-letters': zone.kind === 'silent' }" role="group" :aria-label="prompt">
        <button
          v-for="option in choices" :key="`${question.itemId}-${option}`" class="phonics-choice" type="button"
          :class="{ flash: feedback && correctOptions.includes(option), shake: feedback && !feedback.correct && feedback.value === option }"
          :data-phonics-option="option" :disabled="feedback !== null || overlay !== null"
          :aria-label="zone.kind === 'silent' ? `第 ${Number(option.slice(1)) + 1} 個字母 ${optionLabel(question, option)}` : optionLabel(question, option)"
          @click="onAnswer(option)"
        >{{ optionLabel(question, option) }}</button>
      </div>
      <p class="phonics-feedback" :class="{ 'phonics-success': feedback?.correct }" role="status" aria-live="polite" aria-atomic="true">
        {{ feedback ? feedback.correct ? copy.round.correct : copy.round.wrong(answerText) : copy.round.guideSub }}
      </p>
      <div class="phonics-actions">
        <button id="phonicsAgainBtn" class="action-button hint" type="button" :disabled="feedback !== null || overlay !== null" @click="speakTarget">{{ copy.replay }}</button>
        <button class="action-button" type="button" @click="goMap">{{ copy.tutorial.back }}</button>
      </div>
    </section>

    <section v-else-if="screen === 'summary'" class="phonics-panel" aria-labelledby="phonics-summary-title" data-phonics-summary>
      <p class="eyebrow">{{ copy.summary.eyebrow }}</p>
      <h2 id="phonics-summary-title">{{ copy.summary.title }}</h2>
      <p>{{ copy.summary.body }}</p>
      <table class="phonics-summary-table">
        <thead><tr><th scope="col">{{ copy.summary.zone }}</th><th scope="col">{{ copy.summary.accuracy }}</th><th scope="col">{{ copy.map.starsLabel }}</th></tr></thead>
        <tbody><tr v-for="row in summary.zones" :key="row.id" :data-phonics-summary-zone="row.id">
          <th scope="row">{{ row.id }} · {{ row.nameZh }}</th>
          <td :aria-label="row.accuracy === null ? copy.summary.noData : undefined">{{ row.accuracy === null ? '—' : `${Math.round(row.accuracy * 100)}%` }}</td>
          <td>{{ row.bestStars }} / 3</td>
        </tr></tbody>
      </table>
      <h3>{{ copy.summary.review }}</h3>
      <p v-if="!summary.review.length">{{ copy.summary.reviewEmpty }}</p>
      <ul v-else class="phonics-review-list">
        <li v-for="item in summary.review" :key="item.id"><strong>{{ item.nameZh }}</strong>：{{ item.sounds.length ? item.sounds.join('、') : '再練習一輪，鞏固讀音。' }}</li>
      </ul>
      <div class="phonics-actions">
        <button v-if="wrongCount" class="primary-button" type="button" @click="startReview">重溫錯題（{{ wrongCount }}）</button>
        <button class="action-button" type="button" @click="goMap">{{ copy.summary.back }}</button>
      </div>
    </section>
    <p class="phonics-footnote">{{ copy.footnote }}</p>
  </main>

  <MazeDialog
    :open="overlay === 'help'" cancelable labelled-by="phonics-help-title"
    dialog-class="phonics-dialog" @close="closeHelp"
  >
    <div class="dialog-inner">
      <h2 id="phonics-help-title" class="dialog-title">{{ copy.help.title }}</h2>
      <p class="dialog-copy">{{ copy.help.task }}</p>
      <p class="dialog-copy">{{ copy.help.controls }}</p>
      <p class="dialog-copy">{{ copy.help.parent }}</p>
      <button class="primary-button" type="button" autofocus @click="closeHelp">{{ copy.help.back }}</button>
      <button class="secondary-button" type="button" @click="goHome">{{ copy.home }}</button>
    </div>
  </MazeDialog>

  <MazeDialog
    id="phonicsResult" :open="overlay === 'result'" labelled-by="phonics-result-title"
    dialog-class="phonics-dialog" :data-stars="result?.stars ?? 0" :data-passed="result?.passed ?? false"
  >
    <div v-if="result" class="dialog-inner">
      <p class="dialog-eyebrow">{{ result.passed ? copy.result.passEyebrow : copy.result.failEyebrow }}</p>
      <PhonicsArt v-if="result.passed" kind="stamp" class="phonics-result-stamp" label="小區過關印章" />
      <PhonicsArt v-else :zone="selectedZone" class="phonics-result-stamp" />
      <h2 id="phonics-result-title" class="dialog-title">{{ result.passed ? copy.result.passTitle : copy.result.failTitle }}</h2>
      <div v-if="result.passed" class="phonics-stars phonics-result-stars" :aria-label="copy.result.stars(result.stars)">
        <PhonicsArt v-for="n in 3" :key="n" kind="star" :filled="n <= result.stars" />
      </div>
      <p class="dialog-copy">{{ copy.result.score(questions.length - result.missedItemIds.length, questions.length) }}</p>
      <p class="dialog-copy">
        <template v-if="result.passed">{{ copy.result.passBody(phonicsZone(selectedZone).nameZh) }} {{ nextZone ? copy.result.unlocked(nextZone.nameZh) : copy.result.finished }}</template>
        <template v-else>今次差少少，慢慢睇字同提示，再試一次就會更熟練。<template v-if="nextZone && !isZoneUnlocked(save, nextZone.id)"> 下一個小區仍然鎖住。</template></template>
      </p>
      <div class="phonics-dialog-actions">
        <button v-if="result.passed && nextZone" class="primary-button" type="button" autofocus data-phonics-next-zone @click="enterZone(nextZone.id)">{{ copy.result.nextZone }}</button>
        <button v-if="!result.passed" class="primary-button" type="button" autofocus data-phonics-retry @click="startRound">{{ copy.result.retry }}</button>
        <button v-if="wrongCount" class="action-button" type="button" data-phonics-review @click="startReview">重溫錯題（{{ wrongCount }}）</button>
        <button class="action-button" type="button" @click="goMap">{{ copy.result.backToMap }}</button>
        <button class="action-button" type="button" @click="goHome">{{ copy.home }}</button>
      </div>
    </div>
  </MazeDialog>

  <MazeDialog :open="overlay === 'reviewDone'" labelled-by="phonics-review-title" dialog-class="phonics-dialog">
    <div class="dialog-inner">
      <p class="dialog-eyebrow">{{ copy.retry.eyebrow }}</p>
      <h2 id="phonics-review-title" class="dialog-title">{{ wrongCount ? copy.retry.remaining(wrongCount) : copy.retry.done }}</h2>
      <p class="dialog-copy">{{ copy.retry.body }}</p>
      <div class="phonics-dialog-actions">
        <button v-if="wrongCount" class="primary-button" type="button" autofocus @click="startReview">重溫錯題</button>
        <button class="action-button" type="button" @click="goMap">{{ copy.retry.back }}</button>
        <button class="action-button" type="button" @click="goHome">{{ copy.home }}</button>
      </div>
    </div>
  </MazeDialog>

  <PlayChrome :toast-on="toastOn" :toast-text="toastText" :confetti-bits="confettiBits" />
</template>

<style>
.app.phonics-game{max-width:1000px}
.phonics-game .brand-logo{background:#e0eeeb}
.phonics-panel{min-width:0;padding:24px;border:2px solid #d2dfd5;border-radius:26px;background:#f1f6ef;color:#304b43}
.phonics-panel h2{margin:0;font-size:24px;line-height:1.4}
.phonics-panel p{line-height:1.7}
.phonics-section-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.phonics-section-head .eyebrow{margin:0 0 4px}
.phonics-map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.phonics-zone{min-width:0;min-height:56px;display:flex;flex-direction:column;gap:5px;padding:12px;text-align:left;border:2px solid #c9d9cd;border-radius:22px;background:#fffdf7;box-shadow:0 4px 0 #d8e4db}
.phonics-zone strong{font-size:17px}
.phonics-zone small{font-size:12px;color:#526c61}
.phonics-zone.locked{background:#e7eeea;border-style:dashed;box-shadow:none}
.phonics-zone.stamped{border-color:#91b48b}
.phonics-zone .phonics-island{height:110px;object-fit:contain}
.phonics-zone-state{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:30px}
.phonics-stars{display:inline-flex;align-items:center;gap:3px}
.phonics-stars .phonics-art{width:26px;height:26px}
.phonics-zone-state .phonics-state-art{width:32px;height:30px}
.phonics-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:22px}
.phonics-game .action-button,.phonics-dialog .action-button{min-height:56px;height:auto;min-width:0;white-space:normal;line-height:1.4;padding:12px 16px;max-width:100%}
.phonics-actions .primary-button{width:auto;min-width:0;flex:1 1 180px}
.phonics-tutorial-art{max-width:240px;margin:0 auto 12px}
.phonics-lesson{font-size:17px}
.phonics-examples{list-style:none;margin:18px 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px}
.phonics-examples li{padding:12px;border-radius:16px;background:#fffdf7;display:flex;flex-direction:column;gap:4px}
.phonics-examples strong{font-size:20px;overflow-wrap:anywhere}
.phonics-examples span{font-size:14px}
.phonics-round{max-width:720px;margin:0 auto}
.phonics-round progress{display:block;width:100%;height:12px;margin:16px 0 22px;accent-color:#648e6e}
.phonics-question-card{margin:18px 0;padding:22px 16px;background:#fffdf7;border-radius:20px;text-align:center}
.phonics-word{display:block;font-size:clamp(28px,7vw,44px);line-height:1.4;overflow-wrap:anywhere}
.phonics-question-card p{margin:12px 0 0;font-size:17px}
.phonics-visual-cue{display:flex;align-items:center;gap:12px;margin-bottom:18px;padding:12px;border-radius:18px;background:#faeed8}
.phonics-visual-cue>.phonics-art{width:88px;height:70px}
.phonics-visual-cue p{font-size:14px;margin:4px 0 0}
.phonics-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.phonics-choices.phonics-letters{display:flex;flex-wrap:wrap;gap:8px}
.phonics-choice{min-width:0;min-height:64px;padding:12px;border:2px solid #aec5bd;border-radius:18px;background:#fffdf7;font-size:24px;overflow-wrap:anywhere;box-shadow:0 3px 0 #d2dfd5}
.phonics-letters .phonics-choice{flex:0 0 56px;min-width:56px;min-height:56px;padding:8px}
.phonics-choice:disabled{opacity:1;color:#304b43}
.phonics-choice.flash{background:#e1efd5;border-color:#548343}
.phonics-choice.shake{background:#fbe3d8;border-color:#b65f48;animation:phonics-shake .4s ease}
.phonics-feedback{min-height:3.4em;margin:16px 0 0;font-weight:800;color:#854a35}
.phonics-success{color:#426d37}
.phonics-summary-table{width:100%;border-collapse:collapse;font-size:15px;background:#fffdf7}
.phonics-summary-table th,.phonics-summary-table td{text-align:left;padding:12px 8px;border-bottom:1px solid #d2dfd5}
.phonics-review-list{padding-left:22px;line-height:1.9}
.phonics-footnote{text-align:center;font-size:12px;line-height:1.7;color:#627565;margin:20px 0 0}
.phonics-dialog{width:min(560px,calc(100vw - 32px))}
.phonics-dialog .phonics-result-stamp{width:150px;height:112px;margin:0 auto 12px}
.phonics-result-stars{display:flex;justify-content:center;margin:12px 0}
.phonics-result-stars .phonics-art{width:48px;height:44px}
.phonics-dialog-actions{display:flex;flex-direction:column;align-items:stretch;gap:14px}
.phonics-dialog-actions .action-button{width:100%;flex:none}
@keyframes phonics-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media(max-width:700px){
  .phonics-panel{padding:18px 14px}
  .phonics-map{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .phonics-zone{padding:10px}
  .phonics-zone strong{font-size:16px}
  .phonics-zone .phonics-island{height:88px}
  .phonics-choice{min-height:56px;font-size:22px}
  .phonics-summary-table{font-size:13px}
  .phonics-summary-table th,.phonics-summary-table td{padding:12px 5px}
}
@media(max-width:360px){.phonics-visual-cue{flex-wrap:wrap}.phonics-zone strong{font-size:14px}}
@media(prefers-reduced-motion:reduce){.phonics-choice.shake{animation:none}}
</style>
