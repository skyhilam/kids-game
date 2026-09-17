<script setup lang="ts">
import { STAGE_OVERVIEW } from '../game/stages';
import GameSprite from './GameSprite.vue';
const emit = defineEmits<{
  pick: [activity: 'picnic' | 'tooth' | 'delivery' | 'sticker'];
}>();
</script>

<template>
  <main class="app hub">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><GameSprite name="car"/></div>
        <div>
          <div class="eyebrow">小 小 出 遊 家</div>
          <h1>選擇遊戲</h1>
        </div>
      </div>
      <span class="age-pill">3+ 歲親子遊戲</span>
    </header>
    <p class="hub-lead">一起觀察小路、想想次序，選一個任務出發吧。</p>
    <div class="hub-grid">
      <button class="hub-card" type="button" @click="emit('pick', 'picnic')">
        <svg class="hub-art" viewBox="0 0 220 120" aria-hidden="true">
          <rect width="220" height="120" rx="22" fill="#e7eddd"/>
          <GameSprite name="car" x="20" y="28" width="90" height="70"/>
          <GameSprite name="burger" x="130" y="32" width="70" height="60"/>
        </svg>
        <strong>一起去野餐</strong>
        <span>先到漢堡店，再前往公園。</span>
        <small class="hub-stages">{{ STAGE_OVERVIEW }}</small>
      </button>
      <button class="hub-card" type="button" @click="emit('pick', 'delivery')">
        <svg class="hub-art" viewBox="0 0 220 120" aria-hidden="true">
          <rect width="220" height="120" rx="22" fill="#e4edf0"/>
          <path d="M12 98h196" stroke="#fcfbef" stroke-width="16" stroke-linecap="round"/>
          <GameSprite name="truck" x="15" y="29" width="118" height="76"/>
          <GameSprite name="home" x="147" y="18" width="57" height="59"/>
          <GameSprite name="parcel" x="156" y="68" width="40" height="38"/>
        </svg>
        <strong>送貨員來了</strong>
        <span>畫線送到 1、2、3 號屋，再到終點。</span>
        <small class="hub-stages">{{ STAGE_OVERVIEW }}</small>
        <small class="hub-modes">可先點選，再試畫線</small>
      </button>
      <button class="hub-card" type="button" @click="emit('pick', 'tooth')">
        <svg class="hub-art" viewBox="0 0 220 120" aria-hidden="true">
          <rect width="220" height="120" rx="22" fill="#e8f4f0"/>
          <circle cx="52" cy="57" r="44" fill="#f7fcf4"/>
          <circle cx="190" cy="21" r="9" fill="#fff9e0"/>
          <path d="M12 98q86-31 196-1" fill="none" stroke="#c4e1d5" stroke-width="7" stroke-linecap="round"/>
          <GameSprite name="kid" x="13" y="5" width="81" height="108"/>
          <GameSprite name="bug-coral" x="98" y="49" width="54" height="54"/>
          <GameSprite name="tooth" x="151" y="28" width="61" height="62"/>
        </svg>
        <strong>打敗蛀牙蟲</strong>
        <span>走到終點，途中避開蛀牙蟲。</span>
        <small class="hub-stages">{{ STAGE_OVERVIEW }}</small>
      </button>
      <button class="hub-card" type="button" @click="emit('pick', 'sticker')">
        <svg class="hub-art" viewBox="0 0 220 120" aria-hidden="true">
          <rect width="220" height="120" rx="22" fill="#f3ead4"/>
          <GameSprite name="burger" x="12" y="28" width="62" height="58"/>
          <GameSprite name="car" x="78" y="30" width="68" height="54"/>
          <GameSprite name="flower" x="150" y="18" width="58" height="62"/>
          <GameSprite name="sun" x="156" y="70" width="42" height="40"/>
        </svg>
        <strong>貼紙學單字</strong>
        <span>拖貼紙配英文詞，全部放對就過關</span>
        <small class="hub-modes">{{ STAGE_OVERVIEW }} · 圖詞配對</small>
      </button>
    </div>
  </main>
</template>
