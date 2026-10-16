<script setup lang="ts">
import { STAGE_OVERVIEW } from '../game/stages';
import GameSprite from './GameSprite.vue';
const emit = defineEmits<{
  pick: [activity: 'picnic' | 'tooth' | 'delivery' | 'sticker' | 'listen' | 'sequence' | 'formula'];
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
          <GameSprite name="butterfly" x="172" y="6" width="32" height="28"/>
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
          <GameSprite name="traffic-cone" x="126" y="80" width="25" height="30"/>
          <GameSprite name="parcel" x="156" y="68" width="40" height="38"/>
        </svg>
        <strong>送貨員來了</strong>
        <span>送到三間屋，再到終點。</span>
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
          <GameSprite name="star" x="102" y="12" width="28" height="28"/>
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
          <GameSprite name="apple" x="12" y="28" width="62" height="58"/>
          <GameSprite name="cat" x="78" y="30" width="68" height="54"/>
          <GameSprite name="rocket" x="150" y="12" width="58" height="54"/>
          <GameSprite name="dolphin" x="156" y="70" width="42" height="40"/>
        </svg>
        <strong>貼紙學單字</strong>
        <span>拖貼紙配英文詞，全部放對就過關</span>
        <small class="hub-modes">{{ STAGE_OVERVIEW }} · 圖詞配對</small>
      </button>
      <button class="hub-card" type="button" @click="emit('pick', 'listen')">
        <svg class="hub-art" viewBox="0 0 220 120" aria-hidden="true">
          <rect width="220" height="120" rx="22" fill="#e8f0f4"/>
          <GameSprite name="kid" x="8" y="6" width="78" height="108"/>
          <GameSprite name="apple" x="90" y="14" width="48" height="48"/>
          <GameSprite name="cat" x="150" y="14" width="54" height="48"/>
          <GameSprite name="dolphin" x="116" y="68" width="72" height="42"/>
        </svg>
        <strong>聽一聽揀圖</strong>
        <span>聽到詞之後，點啱嘅圖。</span>
        <small class="hub-modes">{{ STAGE_OVERVIEW }} · 聽詞揀圖</small>
      </button>
      <button class="hub-card" type="button" @click="emit('pick', 'sequence')">
        <svg class="hub-art" viewBox="0 0 220 120" aria-hidden="true">
          <rect width="220" height="120" rx="22" fill="#efe6d6"/>
          <GameSprite name="home" x="8" y="22" width="68" height="70"/>
          <GameSprite name="burger" x="80" y="30" width="58" height="54"/>
          <GameSprite name="park" x="146" y="18" width="66" height="72"/>
        </svg>
        <strong>出遊順序卡</strong>
        <span>依序點選步驟，排出正確出遊次序。</span>
        <small class="hub-modes">{{ STAGE_OVERVIEW }} · 點選排序</small>
      </button>
      <button class="hub-card" type="button" @click="emit('pick', 'formula')">
        <svg class="hub-art" viewBox="0 0 220 120" aria-hidden="true">
          <rect width="220" height="120" rx="22" fill="#e7f3ee"/>
          <ellipse cx="118" cy="86" rx="72" ry="18" fill="#cfe3d4"/>
          <circle cx="74" cy="64" r="30" fill="#fffdf7" stroke="#9fc3bf" stroke-width="3"/>
          <polygon points="74,38 81,58 74,64 67,58" fill="#e89d7d"/>
          <polygon points="74,90 81,70 74,64 67,70" fill="#9fb983"/>
          <polygon points="48,64 68,57 74,64 68,71" fill="#9fb983"/>
          <polygon points="100,64 80,57 74,64 80,71" fill="#e9c465"/>
          <circle cx="74" cy="64" r="4" fill="#4c6d5d"/>
          <GameSprite name="tree" x="112" y="22" width="48" height="54"/>
          <GameSprite name="sun" x="158" y="12" width="44" height="42"/>
        </svg>
        <strong>公式島</strong>
        <span>休息站：八個島區，由易到難。</span>
        <small class="hub-modes">8–14 歲 · 休息站小遊戲</small>
      </button>
    </div>
    <p class="hub-studio-link"><a href="#sprite-studio">素材工房 <span>用 Canvas 製作自己的遊戲素材 →</span></a></p>
  </main>
</template>

<style scoped>
.hub-studio-link { margin: 25px 0 0; text-align: center; }
.hub-studio-link a { color: #718567; font-size: 12px; text-underline-offset: 5px; }
.hub-studio-link span { font-size: 10px; margin-left: 8px; }
</style>
