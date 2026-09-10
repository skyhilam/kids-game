<script setup lang="ts">
import GameSprite from './GameSprite.vue';

defineProps<{ width: number; height: number }>();
</script>

<template>
  <svg class="landscape" viewBox="0 0 840 660" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="grassPattern" width="114" height="101" patternUnits="userSpaceOnUse">
        <path d="m13 32 2-6m4 6 2-5m62 49 3-5m5 5 2-6" stroke="#b7cb92" stroke-width="2" stroke-linecap="round" opacity=".45"/>
        <circle cx="51" cy="22" r="2" fill="#f7f4cd" opacity=".8"/>
        <circle cx="97" cy="21" r="2.3" fill="#c4d69e" opacity=".55"/>
      </pattern>
    </defs>
    <g id="baseScenery">
      <rect width="840" height="660" fill="#e4edd4"/>
      <path d="M0 20q179-45 358 40t482-5v-55H0Z" fill="#d9e6c5"/>
      <path d="M0 517q135-94 271 29t313-11 256-38v163H0Z" fill="#dce8c9"/>
      <rect width="840" height="660" fill="url(#grassPattern)"/>
    </g>
    <g id="backDecor">
      <path d="M840 501q-79-22-105 13t-37 80q-20 33 50 66h92Z" fill="#b7d7d1"/>
      <path d="M840 514q-73-25-91 17t-33 64" fill="none" stroke="#cfe5d7" stroke-width="5"/>
      <path d="M767 553h25m-40 30h22m22 28h19" stroke="#e6f1df" stroke-width="3" stroke-linecap="round"/>
      <g fill="#f8faed" opacity=".85">
        <path d="M242 65c-5-24 28-31 39-11 25-17 39 3 32 17h-66q-9 0-5-6Z"/>
        <path d="M488 74c-2-13 16-23 25-9 21-12 31 4 25 11h-44q-9 0-6-2Z"/>
      </g>
      <g fill="#b5c98c">
        <ellipse cx="65" cy="436" rx="18" ry="10"/>
        <ellipse cx="82" cy="432" rx="16" ry="13"/>
        <ellipse cx="98" cy="438" rx="14" ry="8"/>
      </g>
      <path d="M248 444q10-10 20 0m7 0q10-10 20 0" stroke="#9eb886" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g transform="translate(595 81) rotate(-8)">
        <path d="M-11 0q5-8 11 0 5-8 11 0" fill="none" stroke="#9caf9b" stroke-width="2.3" stroke-linecap="round"/>
      </g>
    </g>
  </svg>
  <!-- Keep sprite proportions independent of the stretching backdrop. -->
  <svg class="landscape" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
    <GameSprite name="sun" :x="726 / 840 * width" :y="33 / 660 * height" width="80" height="80"/>
    <GameSprite name="tree" :x="20 / 840 * width" :y="188 / 660 * height" width="76" height="97"/>
    <GameSprite name="tree" :x="748 / 840 * width" :y="309 / 660 * height" width="80" height="108"/>
    <GameSprite name="tree" :x="21 / 840 * width" :y="544 / 660 * height" width="66" height="88"/>
    <GameSprite name="flower" class="flower" :x="265 / 840 * width" :y="238 / 660 * height" width="29" height="35"/>
    <GameSprite name="flower" class="flower" :x="330 / 840 * width" :y="574 / 660 * height" width="30" height="36"/>
    <GameSprite name="flower" class="flower" :x="533 / 840 * width" :y="437 / 660 * height" width="28" height="34"/>
  </svg>
</template>
