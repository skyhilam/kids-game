<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { usePlayAudio } from '../composables/usePlayAudio';
import { initAudio, playCue } from '../game/audio';
import { randomSeed } from '../game/rng';
import { STAGE_LABEL, type LoadBand } from '../game/stages';
import { FORMULA_COPY as copy, FORMULA_ZONE_COPY } from '../formula/copy';
import { hintFor, type HintCard } from '../formula/hints';
import {
  isZoneUnlocked,
  readFormulaProgress,
  recordRound,
  retryWrong,
  toWrongBookItem,
  writeFormulaProgress,
  type FormulaSave,
  type WrongBookItem,
} from '../formula/progress';
import { gradeResponse, judgeRound } from '../formula/rules';
import {
  ZONE_IDS,
  type FormulaQuestion,
  type FormulaTag,
  type GradedAttempt,
  type RoundResult,
  type ZoneId,
} from '../formula/types';
import { dealFactorRematch, nextZoneId, zoneDef, zoneHasHints, type TutorialStep } from '../formula/zones';
import FormulaScene from './formula/FormulaScene.vue';
import FormulaSummary from './formula/FormulaSummary.vue';
import FormulaWorldMap from './formula/FormulaWorldMap.vue';
import GameSprite from './GameSprite.vue';
import MazeDialog from './MazeDialog.vue';
import ParentGuide from './ParentGuide.vue';
import PlayChrome from './PlayChrome.vue';

type Screen = 'map' | 'round' | 'summary' | 'retry';
type Overlay = 'welcome' | 'help' | 'tutorial' | 'result' | 'retryDone' | null;
type Feedback = { correct: boolean; answer: string };

const emit = defineEmits<{ home: [] }>();
const props = defineProps<{
  /** Optional fixed deal seed for every zone entry. The live game omits it. */
  openingSeed?: number;
}>();
const { soundOn, toastText, toastOn, toast, toggleSound } = usePlayAudio();

const save = ref<FormulaSave>(readFormulaProgress());
const screen = ref<Screen>('map');
const overlay = ref<Overlay>('welcome');

const zone = ref<ZoneId>(1);
const sectionIndex = ref(0);
const seed = ref(0);
const queue = ref<FormulaQuestion[]>([]);
const qIndex = ref(0);
const attempts = ref<GradedAttempt[]>([]);
const wrongs = ref<WrongBookItem[]>([]);
const rematch = ref(false);
const tutorialStep = ref(0);
const result = ref<RoundResult | null>(null);

const retryQueue = ref<WrongBookItem[]>([]);
const retryIndex = ref(0);

const feedback = ref<Feedback | null>(null);
const fillText = ref('');
const hintOpen = ref(false);
const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
let confettiTimer = 0;
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const zoneCopy = computed(() => FORMULA_ZONE_COPY[zone.value]);
const def = computed(() => zoneDef(zone.value));
const section = computed(() => def.value.sections[sectionIndex.value] ?? def.value.sections[0]!);
const tutorial = computed<readonly TutorialStep[]>(() => section.value.tutorial);
const stampedCount = computed(() => ZONE_IDS.filter((id) => save.value.zones[id]?.stamped).length);
const wrongCount = computed(() => save.value.wrongBook.length);
const playing = computed(() => overlay.value === null);

const stageBand = computed<LoadBand>(() => {
  if (screen.value !== 'round') return 'easy';
  if (zone.value <= 2) return 'easy';
  if (zone.value <= 5) return 'basic';
  return 'puzzle';
});
const stageLabel = computed(() => STAGE_LABEL[stageBand.value]);

const current = computed<FormulaQuestion | null>(() => {
  if (screen.value === 'round') return queue.value[qIndex.value] ?? null;
  if (screen.value === 'retry') {
    const item = retryQueue.value[retryIndex.value];
    return item ? questionFromWrong(item) : null;
  }
  return null;
});

const answering = computed(() => (screen.value === 'round' || screen.value === 'retry') && current.value !== null);
const hintsAvailable = computed(() => answering.value && current.value !== null && zoneHasHints(current.value.zone));
const hint = computed<HintCard | null>(() => {
  if (!hintsAvailable.value || !current.value) return null;
  try {
    return hintFor(current.value);
  } catch {
    return null;
  }
});

const sectionLabel = computed(() => {
  if (screen.value !== 'round' || zone.value !== 7) return '';
  return section.value.key === 'euler' ? copy.round.sectionEuler : copy.round.sectionVolume;
});

const headline = computed(() => {
  if (screen.value === 'round') return `${zone.value}. ${zoneCopy.value.title} · ${zoneCopy.value.en}`;
  if (screen.value === 'retry') return copy.retry.title;
  if (screen.value === 'summary') return copy.summary.title;
  return copy.map.title;
});

const progressText = computed(() => {
  if (screen.value === 'round') return copy.round.progress(qIndex.value + 1, queue.value.length);
  if (screen.value === 'retry') return copy.retry.progress(retryIndex.value + 1, retryQueue.value.length);
  return `${stampedCount.value} / ${ZONE_IDS.length}`;
});

const message = computed(() => {
  if (feedback.value) return feedback.value.correct ? copy.round.correct : copy.round.wrong(feedback.value.answer);
  if (screen.value === 'round' && current.value) {
    return current.value.mode === 'pick' ? copy.round.pickPrompt : copy.round.fillPrompt;
  }
  if (screen.value === 'retry') return copy.retry.body;
  if (screen.value === 'summary') return copy.summary.body;
  if (stampedCount.value === ZONE_IDS.length) return copy.map.allClear;
  return copy.map.note;
});

const nextZone = computed<ZoneId | null>(() => nextZoneId(zone.value));
const nextUnlocked = computed(() => nextZone.value !== null && isZoneUnlocked(save.value, nextZone.value));

function questionFromWrong(item: WrongBookItem): FormulaQuestion {
  const tag: { tag?: FormulaTag } = item.tag !== undefined ? { tag: item.tag } : {};
  if (item.mode === 'pick') {
    return { id: item.id, zone: item.zone, prompt: item.prompt, answer: item.answer, mode: 'pick', choices: [...item.choices], ...tag };
  }
  return { id: item.id, zone: item.zone, prompt: item.prompt, answer: item.answer, mode: 'fill', ...tag };
}

function persist(next: FormulaSave): void {
  save.value = next;
  writeFormulaProgress(next);
}

function resetQuestionUi(): void {
  feedback.value = null;
  fillText.value = '';
  hintOpen.value = false;
}

function beginPlay(): void {
  overlay.value = null;
  initAudio(soundOn.value);
  playCue(soundOn.value, 'welcome');
}

function showHelp(): void {
  if (!playing.value) return;
  overlay.value = 'help';
}

function closeHelp(): void {
  if (overlay.value === 'help') overlay.value = null;
}

function goMap(): void {
  screen.value = 'map';
  overlay.value = null;
  result.value = null;
  resetQuestionUi();
  clearConfetti();
}

function goSummary(): void {
  screen.value = 'summary';
  overlay.value = null;
  resetQuestionUi();
}

function startSection(index: number, withTutorial: boolean): void {
  sectionIndex.value = index;
  queue.value = section.value.deal(seed.value);
  qIndex.value = 0;
  rematch.value = false;
  tutorialStep.value = 0;
  resetQuestionUi();
  overlay.value = withTutorial ? 'tutorial' : null;
}

function enterZone(id: ZoneId, withTutorial = true): void {
  if (!isZoneUnlocked(save.value, id)) {
    toast(copy.map.enterLocked);
    return;
  }
  zone.value = id;
  seed.value = props.openingSeed ?? randomSeed();
  attempts.value = [];
  wrongs.value = [];
  result.value = null;
  screen.value = 'round';
  clearConfetti();
  startSection(0, withTutorial);
  if (!withTutorial) playCue(soundOn.value, 'restart');
}

function tutorialNext(): void {
  if (tutorialStep.value + 1 < tutorial.value.length) {
    tutorialStep.value += 1;
    return;
  }
  overlay.value = null;
  playCue(soundOn.value, 'welcome');
}

function onDialogClose(): void {
  if (overlay.value === 'help') closeHelp();
  else if (overlay.value === 'tutorial' || overlay.value === 'result' || overlay.value === 'retryDone') goMap();
}

function submitAnswer(value: string): void {
  const question = current.value;
  if (!question || feedback.value || !playing.value) return;
  const graded = gradeResponse(question, { questionId: question.id, value });
  feedback.value = { correct: graded.correct, answer: question.answer };
  if (screen.value === 'round') {
    attempts.value = [...attempts.value, graded];
    if (!graded.correct) wrongs.value = [...wrongs.value, toWrongBookItem(question)];
  } else if (graded.correct) {
    persist(retryWrong(save.value, question.id, true));
  }
  playCue(soundOn.value, graded.correct ? 'collect' : 'hint');
}

function submitFill(): void {
  if (fillText.value.trim() === '') {
    toast(copy.round.emptyFill);
    return;
  }
  submitAnswer(fillText.value);
}

function nextQuestion(): void {
  if (!feedback.value) return;
  if (screen.value === 'retry') {
    nextRetry();
    return;
  }
  resetQuestionUi();
  const judged = judgeRound(zone.value, attempts.value);
  if (judged.status !== 'playing') {
    finishRound(judged);
    return;
  }
  if (qIndex.value + 1 < queue.value.length) {
    qIndex.value += 1;
    return;
  }
  if (zone.value === 6 && !rematch.value) {
    const missed = attempts.value
      .filter((attempt) => !attempt.correct && attempt.tag !== undefined)
      .map((attempt) => attempt.tag as FormulaTag);
    if (missed.length > 0) {
      queue.value = dealFactorRematch(seed.value, missed);
      qIndex.value = 0;
      rematch.value = true;
      return;
    }
  }
  if (sectionIndex.value + 1 < def.value.sections.length) {
    startSection(sectionIndex.value + 1, true);
    return;
  }
  finishRound({ ...judged, status: 'failed', stars: 0 });
}

function finishRound(judged: RoundResult): void {
  result.value = judged;
  persist(recordRound(save.value, judged, wrongs.value));
  overlay.value = 'result';
  if (judged.status === 'passed') {
    playCue(soundOn.value, 'win');
    burstConfetti();
  } else {
    playCue(soundOn.value, 'fail');
  }
}

function retryZone(): void {
  enterZone(zone.value, false);
}

function goNextZone(): void {
  if (nextZone.value === null || !nextUnlocked.value) {
    goMap();
    return;
  }
  clearConfetti();
  enterZone(nextZone.value, true);
}

function startRetry(): void {
  if (save.value.wrongBook.length === 0) {
    toast(copy.summary.reviewEmpty);
    return;
  }
  retryQueue.value = save.value.wrongBook.map((item) => ({ ...item, choices: [...item.choices] }));
  retryIndex.value = 0;
  screen.value = 'retry';
  overlay.value = null;
  resetQuestionUi();
}

function nextRetry(): void {
  resetQuestionUi();
  if (retryIndex.value + 1 < retryQueue.value.length) {
    retryIndex.value += 1;
    return;
  }
  overlay.value = 'retryDone';
  if (wrongCount.value === 0) {
    playCue(soundOn.value, 'win');
    burstConfetti();
  }
}

function clearConfetti(): void {
  window.clearTimeout(confettiTimer);
  confettiBits.value = [];
}

function burstConfetti(): void {
  if (reduceMotion) return;
  clearConfetti();
  const palette = ['#e89d7d', '#e9c465', '#9fb983', '#9fc3bf', '#d8b5a0'];
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

onUnmounted(() => {
  clearConfetti();
});
</script>

<template>
  <main class="app formula-game" :data-formula-screen="screen" :data-formula-zone-active="screen === 'round' ? zone : undefined">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><GameSprite name="blackboard"/></div>
        <div>
          <div class="eyebrow">{{ copy.eyebrow }}</div>
          <h1>{{ copy.title }} <small class="formula-title-en">{{ copy.titleEn }}</small></h1>
        </div>
        <span class="stage-chip" :data-stage="stageLabel">{{ stageLabel }}</span>
      </div>
      <div class="top-actions">
        <button class="action-button" type="button" data-formula-home @click="emit('home')">{{ copy.home }}</button>
        <button
          class="icon-button"
          :aria-label="soundOn ? '關閉音效' : '開啟音效'"
          :aria-pressed="soundOn"
          title="開關音效"
          @click="toggleSound"
        >
          <svg aria-hidden="true"><use :href="soundOn ? '#i-sound' : '#i-muted'"/></svg>
        </button>
        <button
          class="icon-button"
          aria-label="遊戲說明"
          title="遊戲說明"
          :disabled="!playing"
          @click="showHelp"
        >
          <svg aria-hidden="true"><use href="#i-help"/></svg>
        </button>
      </div>
    </header>

    <section class="mission" :aria-label="`任務：${copy.mission}`">
      <div class="mission-label">{{ copy.missionLabel }}</div>
      <div class="mission-steps">
        <div class="mission-step" :class="stampedCount === ZONE_IDS.length ? 'done' : 'active'">
          <div class="step-icon"><GameSprite aria-hidden="true" name="blackboard"/></div>
          <div class="step-copy">
            <small>{{ copy.titleEn }}</small>
            <strong>{{ copy.mission }}</strong>
          </div>
        </div>
      </div>
      <div class="level-badge">
        <span>{{ headline }}</span>
        <span class="stage-chip" :data-stage="stageLabel">{{ stageLabel }}</span>
        <span data-formula-progress>{{ progressText }}</span>
      </div>
    </section>

    <div class="board-frame">
      <div class="board formula-board">
        <!-- World map -->
        <template v-if="screen === 'map'">
          <p class="board-note">{{ copy.map.note }}</p>
          <FormulaWorldMap :save="save" @enter="enterZone"/>
          <div class="formula-map-actions">
            <button class="action-button" type="button" data-formula-open-summary @click="goSummary">
              {{ copy.map.summary }}
            </button>
            <button
              class="action-button hint"
              type="button"
              data-formula-open-wrongbook
              :disabled="wrongCount === 0"
              @click="startRetry"
            >
              {{ copy.map.wrongBook }} <span class="stage-chip">{{ wrongCount }}</span>
            </button>
          </div>
        </template>

        <!-- Zone round and wrong-book retry share the question panel -->
        <template v-else-if="screen === 'round' || screen === 'retry'">
          <div v-if="current" class="formula-question" :data-formula-question="current.id" :data-formula-mode="current.mode">
            <div class="formula-question-head">
              <span class="formula-zone-index">{{ current.zone }}</span>
              <strong>{{ screen === 'retry' ? copy.retry.title : zoneCopy.title }}</strong>
              <span v-if="sectionLabel" class="stage-chip" data-formula-section>{{ sectionLabel }}</span>
              <span v-if="rematch && screen === 'round'" class="stage-chip" data-formula-rematch>{{ copy.round.rematch }}</span>
              <span class="formula-progress-chip">{{ progressText }}</span>
            </div>
            <FormulaScene :zone="current.zone"/>
            <p class="formula-prompt" :lang="'en'">{{ current.prompt }}</p>

            <div
              v-if="current.mode === 'pick'"
              class="formula-choices"
              role="group"
              :aria-label="copy.round.pickPrompt"
            >
              <button
                v-for="choice in current.choices"
                :key="choice"
                type="button"
                class="formula-choice"
                :class="{
                  picked: feedback !== null && choice === current.answer,
                  missed: feedback !== null && !feedback.correct && choice !== current.answer,
                }"
                :data-formula-choice="choice"
                :disabled="feedback !== null || !playing"
                @click="submitAnswer(choice)"
              >{{ choice }}</button>
            </div>

            <form v-else class="formula-fill" @submit.prevent="submitFill">
              <label class="formula-fill-label" for="formula-fill-input">{{ copy.round.fillPrompt }}</label>
              <div class="formula-fill-row">
                <input
                  id="formula-fill-input"
                  v-model="fillText"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  :placeholder="copy.round.fillPlaceholder"
                  :disabled="feedback !== null || !playing"
                  data-formula-fill
                />
                <button class="primary-button formula-fill-submit" type="submit" :disabled="feedback !== null || !playing">
                  {{ copy.round.submit }}
                </button>
              </div>
            </form>

            <div
              v-if="feedback"
              class="formula-feedback"
              :class="feedback.correct ? 'is-correct' : 'is-wrong'"
              :data-formula-feedback="feedback.correct ? 'correct' : 'wrong'"
              role="status"
            >
              <svg aria-hidden="true"><use :href="feedback.correct ? '#i-check' : '#i-close'"/></svg>
              <span>{{ feedback.correct ? copy.round.correct : copy.round.wrong(feedback.answer) }}</span>
              <button class="primary-button formula-next" type="button" autofocus data-formula-next @click="nextQuestion">
                {{ copy.round.next }}<svg><use href="#i-arrow"/></svg>
              </button>
            </div>

            <aside v-if="hint && hintOpen" class="formula-hint-card" data-formula-hint-card :aria-label="copy.round.hint">
              <svg aria-hidden="true"><use href="#i-bulb"/></svg>
              <div>
                <strong>{{ hint.title }}</strong>
                <code>{{ hint.formula }}</code>
                <small>{{ copy.round.hintNote }}</small>
              </div>
            </aside>
          </div>
        </template>

        <!-- Parent summary -->
        <FormulaSummary v-else :save="save" @retry="startRetry" @back="goMap"/>
      </div>
    </div>

    <section class="bottom-bar" aria-label="遊戲提示及操作">
      <div class="guide">
        <div class="guide-avatar" aria-hidden="true"><GameSprite name="kid"/></div>
        <div class="guide-copy">
          <div class="guide-main" role="status" aria-live="polite">{{ message }}</div>
          <div class="guide-sub">{{ headline }} · {{ progressText }}。{{ screen === 'round' ? copy.round.guideSub : copy.footnote }}</div>
        </div>
      </div>
      <div class="bottom-actions">
        <button
          v-if="hintsAvailable"
          class="action-button hint"
          type="button"
          data-formula-hint
          :aria-pressed="hintOpen"
          :disabled="!playing"
          @click="hintOpen = !hintOpen"
        >
          <svg aria-hidden="true"><use href="#i-bulb"/></svg>
          <span>{{ hintOpen ? copy.round.hintClose : copy.round.hint }}</span>
        </button>
        <button
          v-if="screen !== 'map'"
          class="action-button"
          type="button"
          data-formula-back-to-map
          @click="goMap"
        >{{ copy.result.backToMap }}</button>
      </div>
    </section>
    <div class="footer-note">
      <span>{{ copy.footer[0] }}</span><i></i><span>{{ copy.footer[1] }}</span><i></i><span>{{ copy.footer[2] }}</span>
    </div>
  </main>

  <MazeDialog
    :open="overlay !== null"
    :cancelable="overlay !== 'welcome'"
    labelled-by="formula-dialog-title"
    dialog-class="formula-dialog formula-game"
    @close="onDialogClose"
  >
    <div class="dialog-inner" :class="{ 'help-inner': overlay === 'help' }" :data-formula-overlay="overlay ?? ''">
      <template v-if="overlay === 'welcome'">
        <div class="dialog-eyebrow">{{ copy.welcomeEyebrow }}</div>
        <FormulaScene class="dialog-hero" :zone="1"/>
        <h2 id="formula-dialog-title" class="dialog-title">{{ copy.title }} · {{ copy.titleEn }}</h2>
        <p class="dialog-copy">{{ copy.welcomeBody }}</p>
        <button class="primary-button" type="button" autofocus @click="beginPlay">
          {{ copy.start }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="emit('home')">{{ copy.home }}</button>
        <div class="dialog-footnote">{{ copy.footnote }}</div>
      </template>

      <template v-else-if="overlay === 'help'">
        <div class="help-header">
          <h2 id="formula-dialog-title">{{ copy.help.title }}</h2>
          <button class="close-button" type="button" aria-label="關閉說明" @click="closeHelp">
            <svg><use href="#i-close"/></svg>
          </button>
        </div>
        <div class="parent-cols words-help-cols">
          <article class="parent-col">
            <h4>任務</h4>
            <p>{{ copy.help.task }}</p>
          </article>
          <article class="parent-col">
            <h4>操作</h4>
            <p>{{ copy.help.controls }}</p>
          </article>
          <article class="parent-col">
            <h4>家長</h4>
            <p>{{ copy.help.parent }}</p>
          </article>
        </div>
        <ParentGuide :guide="copy.help.guide" :stage-label="copy.title"/>
        <button class="primary-button help-finish" type="button" autofocus @click="closeHelp">
          {{ copy.help.back }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="emit('home')">{{ copy.home }}</button>
      </template>

      <template v-else-if="overlay === 'tutorial'">
        <div class="dialog-eyebrow">{{ copy.tutorial.eyebrow }} · {{ zoneCopy.title }}</div>
        <FormulaScene class="dialog-hero" :zone="zone"/>
        <p v-if="sectionLabel" class="stage-chip" data-formula-section>{{ sectionLabel }}</p>
        <h2 id="formula-dialog-title" class="dialog-title" :lang="'en'">{{ tutorial[tutorialStep]?.title }}</h2>
        <p class="dialog-copy formula-tutorial-body" :lang="'en'" data-formula-tutorial-body>{{ tutorial[tutorialStep]?.body }}</p>
        <p class="dialog-footnote formula-tutorial-page" data-formula-tutorial-step>
          {{ copy.tutorial.page(tutorialStep + 1, tutorial.length) }}
        </p>
        <p class="dialog-copy formula-rule">{{ zoneCopy.rule }}</p>
        <button class="primary-button" type="button" autofocus data-formula-tutorial-next @click="tutorialNext">
          {{ tutorialStep + 1 < tutorial.length ? copy.tutorial.next : copy.tutorial.begin }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="goMap">{{ copy.tutorial.back }}</button>
        <button class="secondary-button" type="button" @click="emit('home')">{{ copy.home }}</button>
      </template>

      <template v-else-if="overlay === 'result' && result">
        <div class="dialog-eyebrow">{{ result.status === 'passed' ? copy.result.passEyebrow : copy.result.failEyebrow }}</div>
        <FormulaScene class="dialog-hero" :zone="zone"/>
        <h2 id="formula-dialog-title" class="dialog-title" :data-formula-result="result.status">
          {{ result.status === 'passed' ? copy.result.passTitle : copy.result.failTitle }}
        </h2>
        <div class="formula-result-row">
          <span class="formula-stars large" :data-formula-result-stars="result.stars" :aria-label="copy.result.stars(result.stars)">
            <i v-for="n in 3" :key="n" :class="{ lit: n <= result.stars }">★</i>
          </span>
          <span v-if="result.status === 'passed'" class="formula-stamp large" data-formula-result-stamp aria-hidden="true">✓</span>
        </div>
        <p class="dialog-copy">
          {{ copy.result.score(result.correct, result.total) }}。
          <template v-if="result.status === 'passed'">
            {{ copy.result.passBody(zoneCopy.title) }}
            {{ nextZone !== null ? copy.result.unlocked(FORMULA_ZONE_COPY[nextZone].title) : copy.result.finished }}
          </template>
          <template v-else>{{ copy.result.failBody }}</template>
        </p>
        <button
          v-if="result.status === 'passed' && nextZone !== null && nextUnlocked"
          class="primary-button"
          type="button"
          autofocus
          data-formula-next-zone
          @click="goNextZone"
        >
          {{ copy.result.nextZone }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button
          v-else-if="result.status === 'failed'"
          class="primary-button"
          type="button"
          autofocus
          data-formula-retry-zone
          @click="retryZone"
        >
          {{ copy.result.retry }}<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#i-restart"/></svg>
        </button>
        <button
          v-else
          class="primary-button"
          type="button"
          autofocus
          data-formula-result-map
          @click="goMap"
        >
          {{ copy.result.backToMap }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button v-if="result.status === 'failed'" class="secondary-button" type="button" @click="goMap">{{ copy.result.backToMap }}</button>
        <button class="secondary-button" type="button" @click="emit('home')">{{ copy.home }}</button>
      </template>

      <template v-else-if="overlay === 'retryDone'">
        <div class="dialog-eyebrow">{{ copy.retry.eyebrow }}</div>
        <h2 id="formula-dialog-title" class="dialog-title" data-formula-retry-done>
          {{ wrongCount === 0 ? copy.retry.done : copy.retry.remaining(wrongCount) }}
        </h2>
        <p class="dialog-copy">{{ copy.retry.body }}</p>
        <button class="primary-button" type="button" autofocus @click="goSummary">
          {{ copy.map.summary }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="goMap">{{ copy.retry.back }}</button>
        <button class="secondary-button" type="button" @click="emit('home')">{{ copy.home }}</button>
      </template>
    </div>
  </MazeDialog>

  <PlayChrome
    :toast-on="toastOn"
    :toast-text="toastText"
    :confetti-bits="confettiBits"
  />
</template>

<style>
.formula-game .brand-logo{background:#e4eef2}
.formula-game .brand{flex-wrap:wrap}
.formula-game .stage-chip{align-self:center}
.formula-game .formula-title-en{font-size:12px;font-weight:600;color:#7e8b76;margin-left:6px}
.formula-game .level-badge{flex-wrap:wrap}
.formula-game .board.formula-board{background:#e4eef2;display:flex;flex-direction:column;gap:14px;padding:42px 18px 18px;aspect-ratio:auto;height:auto;min-height:520px;overflow:visible;user-select:text;-webkit-user-select:text;touch-action:auto}
.formula-game .formula-board .board-note{top:12px}
.formula-game .formula-zone-index{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 6px;border-radius:999px;background:#4c6d5d;color:#fffdf7;font-size:13px;font-weight:800}
.formula-game .formula-stars{display:inline-flex;gap:2px;font-size:16px;line-height:1;color:#d5d9cc}
.formula-game .formula-stars i{font-style:normal}
.formula-game .formula-stars i.lit{color:#e9c465;text-shadow:0 1px 0 #c99f3b}
.formula-game .formula-stars.large{font-size:34px;gap:6px}
.formula-game .formula-stamp{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#e89d7d;color:#fffdf7;font-weight:900;font-size:15px;border:2px dashed #fffdf7;box-shadow:0 0 0 2px #e89d7d}
.formula-game .formula-stamp.large{width:48px;height:48px;font-size:26px;transform:rotate(-12deg)}
.formula-game .formula-lock{color:#9aa6a2;display:inline-grid;place-items:center}

/* World map */
.formula-game .formula-map{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;flex:1;align-content:start}
.formula-game .formula-zone-card{position:relative;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;gap:6px 10px;align-items:start;text-align:left;padding:12px;border:2px solid #c9d7de;border-radius:22px;background:#fffdf8;box-shadow:0 4px 0 #d5e0e6;color:inherit;transition:border-color .2s,transform .2s}
.formula-game .formula-zone-card:not(:disabled):hover{border-color:#9fc3bf;transform:translateY(-1px)}
.formula-game .formula-zone-card.stamped{border-color:#b7d0a4;background:#f4faee}
.formula-game .formula-zone-card.locked{opacity:.6;background:#eef1ee;box-shadow:none;cursor:not-allowed}
.formula-game .formula-zone-card:disabled{opacity:.6}
.formula-game .formula-zone-card .formula-scene{grid-column:1 / -1;width:100%;height:auto;border-radius:14px}
.formula-game .formula-zone-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.formula-game .formula-zone-copy strong{font-size:16px}
.formula-game .formula-zone-copy small{font-size:11px;color:#7e8b76;font-weight:600;letter-spacing:.3px}
.formula-game .formula-zone-blurb{font-size:12px;color:#5d7356;line-height:1.4}
.formula-game .formula-zone-state{grid-column:1 / -1;display:flex;align-items:center;gap:8px;justify-content:space-between}
.formula-game .formula-zone-status{font-size:11px;color:#7e8b76;font-weight:700;margin-left:auto}
.formula-game .formula-map-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding-top:4px}
.formula-game .formula-map-actions .stage-chip{margin-left:6px}

/* Question panel */
.formula-game .formula-question{display:flex;flex-direction:column;gap:14px;flex:1}
.formula-game .formula-question-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.formula-game .formula-question-head strong{font-size:17px}
.formula-game .formula-progress-chip{margin-left:auto;font-size:13px;font-weight:800;color:#4c6d5d;background:#fffdf7;padding:4px 10px;border-radius:999px;border:1.5px solid #c9d7de}
.formula-game .formula-question .formula-scene{width:100%;max-height:150px;height:auto;border-radius:16px}
.formula-game .formula-prompt{margin:0;font-size:18px;line-height:1.5;font-weight:700;color:#2f493e;background:#fffdf7;padding:14px 16px;border-radius:18px;border:1.5px solid #c9d7de}
.formula-game .formula-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.formula-game .formula-choice{min-height:64px;padding:10px 14px;border:2px solid #c9d7de;border-radius:18px;background:#fffdf8;box-shadow:0 4px 0 #d5e0e6;font-size:18px;font-weight:800;color:#2f493e;transition:border-color .2s,background .2s,transform .1s;word-break:break-word}
.formula-game .formula-choice:not(:disabled):active{transform:translateY(2px);box-shadow:0 2px 0 #d5e0e6}
.formula-game .formula-choice:disabled{opacity:.9}
.formula-game .formula-choice.picked{border-color:#9fb983;background:#f4faee}
.formula-game .formula-choice.missed{opacity:.45}
.formula-game .formula-fill{display:flex;flex-direction:column;gap:8px}
.formula-game .formula-fill-label{font-size:13px;font-weight:700;color:#5d7356}
.formula-game .formula-fill-row{display:flex;gap:10px;align-items:stretch}
.formula-game .formula-fill-row input{flex:1;min-width:0;min-height:56px;padding:10px 16px;border:2px solid #c9d7de;border-radius:18px;background:#fffdf8;font:inherit;font-size:20px;font-weight:800;color:#2f493e;user-select:text;-webkit-user-select:text}
.formula-game .formula-fill-row input:focus{outline:3px solid #9fc3bf;outline-offset:1px}
.formula-game .formula-fill-submit{margin:0;min-height:56px;padding:0 20px;width:auto}
.formula-game .formula-feedback{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border-radius:18px;border:2px solid;font-weight:800}
.formula-game .formula-feedback>svg{width:22px;height:22px;flex:none}
.formula-game .formula-feedback.is-correct{border-color:#b7d0a4;background:#f4faee;color:#4c6d5d}
.formula-game .formula-feedback.is-wrong{border-color:#f0c2ad;background:#fff1ea;color:#7a3f2c}
.formula-game .formula-feedback .formula-next{margin:0 0 0 auto;min-height:48px;padding:0 18px;width:auto}
.formula-game .formula-hint-card{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:18px;background:#fbefcf;border:2px solid #ecdbb1;color:#806531}
.formula-game .formula-hint-card>svg{width:26px;height:26px;flex:none}
.formula-game .formula-hint-card div{display:flex;flex-direction:column;gap:4px}
.formula-game .formula-hint-card code{font-size:18px;font-weight:800;font-family:inherit}
.formula-game .formula-hint-card small{font-size:11px;font-weight:600;opacity:.85}

/* Parent summary */
.formula-game .formula-summary{display:flex;flex-direction:column;gap:14px;flex:1}
.formula-game .formula-summary-head{text-align:center}
.formula-game .formula-summary-head .dialog-title{margin-bottom:4px}
.formula-game .formula-summary-table{width:100%;border-collapse:separate;border-spacing:0;background:#fffdf7;border-radius:18px;overflow:hidden;border:1.5px solid #c9d7de;font-size:14px}
.formula-game .formula-summary-table th,.formula-game .formula-summary-table td{padding:10px 12px;text-align:left;border-bottom:1px solid #e5ecef;vertical-align:middle}
.formula-game .formula-summary-table thead th{font-size:11px;letter-spacing:.3px;color:#7e8b76;background:#eef3f5}
.formula-game .formula-summary-table tbody th{display:flex;align-items:center;gap:8px;font-weight:700}
.formula-game .formula-summary-table tbody th small{color:#7e8b76;font-weight:600;font-size:11px}
.formula-game .formula-summary-table tr:last-child th,.formula-game .formula-summary-table tr:last-child td{border-bottom:0}
.formula-game .formula-summary-table tr.locked td{color:#9aa6a2}
.formula-game .formula-review-title{margin:4px 0 0;font-size:16px;display:flex;align-items:center;gap:8px}
.formula-game .formula-review-empty{margin:0;color:#7e8b76}
.formula-game .formula-review-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.formula-game .formula-review-list li{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:#fffdf7;border-radius:14px;border:1.5px solid #e5ecef}
.formula-game .formula-review-copy{display:flex;flex-direction:column;gap:2px;font-size:14px}
.formula-game .formula-review-copy small{color:#4c6d5d;font-weight:700}
.formula-game .formula-summary-actions{display:flex;flex-direction:column;align-items:center;gap:0}

/* Dialogs */
.formula-game.formula-dialog{width:min(640px,calc(100vw - 32px))}
.formula-game.formula-dialog .formula-scene.dialog-hero{width:100%;height:auto}
.formula-game.formula-dialog .stage-chip{margin:0 auto 10px}
.formula-game.formula-dialog .formula-tutorial-body{text-align:left;font-size:16px;line-height:1.6}
.formula-game.formula-dialog .formula-tutorial-page{margin:0 0 6px;opacity:.8}
.formula-game.formula-dialog .formula-rule{font-size:13px;color:#5d7356;background:#eef3e6;border-radius:12px;padding:8px 12px}
.formula-game.formula-dialog .formula-result-row{display:flex;align-items:center;justify-content:center;gap:16px;margin:4px 0 10px}

@media(max-width:700px){
  .formula-game .board.formula-board{min-height:0;padding:16px 12px 12px;gap:12px}
  .formula-game .formula-board .board-note{display:none}
  .formula-game .formula-map{gap:10px}
  .formula-game .formula-zone-card{padding:10px;border-radius:18px}
  .formula-game .formula-zone-copy strong{font-size:15px}
  .formula-game .formula-prompt{font-size:16px;padding:12px 14px}
  .formula-game .formula-choice{min-height:56px;font-size:16px}
  .formula-game .formula-summary-table{font-size:13px}
  .formula-game .formula-summary-table th,.formula-game .formula-summary-table td{padding:8px}
}
@media(max-width:420px){
  .formula-game .formula-map{grid-template-columns:1fr}
  .formula-game .formula-zone-card .formula-scene{display:none}
  .formula-game .formula-choices{grid-template-columns:1fr}
  .formula-game .formula-summary-table tbody th small{display:none}
}
</style>
