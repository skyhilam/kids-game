<script setup lang="ts">
import { computed } from 'vue';
import type { OverlayCopy } from '../game/copy';
import { STAGE_PICK_INTRO, type ParentGuide } from '../game/stages';
import type { LevelDef, Overlay } from '../game/types';
import MazeDialog from './MazeDialog.vue';
import ParentGuideBlock from './ParentGuide.vue';

const props = defineProps<{
  overlay: Overlay | null;
  level: number;
  lastLevel: boolean;
  allDone: boolean;
  endless?: boolean;
  reduceMotion: boolean;
  helpLevels: readonly { index: number; level: LevelDef }[];
  copy: OverlayCopy;
  stageLabel?: string;
  parentGuide?: ParentGuide | null;
}>();

const emit = defineEmits<{
  start: [];
  retry: [];
  next: [];
  replay: [];
  close: [];
  jump: [index: number];
  revealed: [];
  home: [];
}>();

const stuckReason = computed(() => (props.overlay?.kind === 'stuck' ? props.overlay.reason : 'deadend'));
const wrapTour = computed(() => !props.endless && (props.lastLevel || props.allDone));
const cancelable = computed(() => props.overlay?.kind === 'help' || props.overlay?.kind === 'rescue');
const revealMs = computed(() => {
  if (props.overlay?.kind !== 'win') return 0;
  return props.reduceMotion ? 100 : 650;
});
const winBeat = computed(() => props.overlay?.kind === 'win');
</script>

<template>
  <MazeDialog
    :open="overlay !== null"
    :reveal-ms="revealMs"
    :win-beat="winBeat"
    :cancelable="cancelable"
    @close="emit('close')"
    @revealed="emit('revealed')"
  >
    <div v-if="overlay?.kind === 'welcome'" class="dialog-inner">
      <div class="dialog-eyebrow">{{ copy.welcome.eyebrow }}</div>
      <slot name="welcome-hero" />
      <h2 class="dialog-title" id="dialogTitle">{{ copy.welcome.title }}</h2>
      <p class="dialog-copy" v-html="copy.welcome.body"></p>
      <slot name="welcome-extra" />
      <div class="rule-note"><svg viewBox="0 0 28 28"><use href="#i-once"/></svg>同一路段僅可通行一次</div>
      <button class="primary-button" id="startBtn" autofocus @click="emit('start')">開始遊戲<svg><use href="#i-arrow"/></svg></button>
      <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
      <div class="dialog-footnote">{{ endless ? '一路玩下去' : `${helpLevels.length} 個關卡` }} · 輕觸即可遊玩 · 不計時</div>
    </div>

    <div v-else-if="overlay?.kind === 'stuck'" class="dialog-inner">
      <div class="dialog-eyebrow">{{ copy.stuck.eyebrow }}</div>
      <slot name="stuck-hero" :reason="stuckReason" />
      <h2 class="dialog-title" id="dialogTitle" style="font-size:27px">{{ copy.stuck.title(stuckReason) }}</h2>
      <p class="dialog-copy" v-html="copy.stuck.body(stuckReason)"></p>
      <button class="primary-button" id="retryBtn" autofocus @click="emit('retry')">
        <svg viewBox="0 0 32 32"><use href="#i-restart"/></svg>再試一次
      </button>
      <div class="dialog-footnote">{{ copy.stuck.footnote }}</div>
    </div>

    <div v-else-if="overlay?.kind === 'win'" class="dialog-inner">
      <div class="dialog-eyebrow">{{ copy.win.eyebrow(level) }}</div>
      <slot name="win-hero" />
      <h2 class="dialog-title" id="dialogTitle">{{ copy.win.title }}</h2>
      <p class="dialog-copy" v-html="copy.win.body(allDone)"></p>
      <div class="stamp-row">
        <span v-for="stamp in copy.win.stamps" :key="stamp" class="stamp"><svg><use href="#i-check"/></svg>{{ stamp }}</span>
      </div>
      <button class="primary-button" id="nextBtn" autofocus @click="emit('next')">
        {{ wrapTour ? '從頭再玩' : '下一關' }}
        <svg viewBox="0 0 32 32"><use :href="wrapTour ? '#i-restart' : '#i-arrow'"/></svg>
      </button>
      <button class="secondary-button" id="replayBtn" @click="emit('replay')">再玩本關</button>
    </div>

    <div v-else-if="overlay?.kind === 'help'" class="dialog-inner help-inner">
      <div class="help-header">
        <h2 id="dialogTitle">遊戲說明</h2>
        <button class="close-button" id="closeHelp" aria-label="關閉說明" @click="emit('close')">
          <svg><use href="#i-close"/></svg>
        </button>
      </div>
      <div class="help-section">
        <h3>任務</h3>
        <p v-html="copy.help.task"></p>
      </div>
      <div class="help-section">
        <h3>操作</h3>
        <p v-html="copy.help.controls"></p>
      </div>
      <div class="help-section">
        <h3>三階段點揀</h3>
        <p>{{ STAGE_PICK_INTRO }}</p>
      </div>
      <ParentGuideBlock v-if="parentGuide" :guide="parentGuide" :stage-label="stageLabel"/>
      <div v-if="helpLevels.length" class="help-section" style="border:0">
        <h3>選擇關卡</h3>
        <div class="help-levels">
          <button
            v-for="item in helpLevels"
            :key="item.index"
            class="help-level"
            :class="{ selected: item.index === level }"
            :data-level="item.index"
            @click="emit('jump', item.index)"
          >
            {{ item.index + 1 }} · {{ item.level.short }}
            <small>{{ item.level.name }}</small>
          </button>
        </div>
      </div>
      <button class="primary-button help-finish" id="backToGame" autofocus @click="emit('close')">返回遊戲<svg><use href="#i-arrow"/></svg></button>
      <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
    </div>

    <div v-else-if="overlay?.kind === 'rescue'" class="dialog-inner">
      <slot name="rescue-hero" />
      <h2 class="dialog-title" id="dialogTitle" style="font-size:25px">{{ copy.rescue.title }}</h2>
      <p class="dialog-copy" v-html="copy.rescue.body"></p>
      <button class="primary-button" id="rescueBtn" autofocus @click="emit('retry')">
        重新開始<svg viewBox="0 0 32 32"><use href="#i-restart"/></svg>
      </button>
      <button class="secondary-button" id="exploreBtn" @click="emit('close')">繼續嘗試</button>
    </div>
  </MazeDialog>
</template>
