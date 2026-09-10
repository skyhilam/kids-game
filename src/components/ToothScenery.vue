<script setup lang="ts">
import GameSprite from './GameSprite.vue';

defineProps<{ width: number; height: number }>();
</script>

<template>
  <svg class="landscape" viewBox="0 0 840 660" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="tilePattern" width="48" height="48" patternUnits="userSpaceOnUse">
        <rect width="48" height="48" fill="#eef6f4"/>
        <path d="M48 0H0v48" fill="none" stroke="#d5e6e1" stroke-width="1.5"/>
      </pattern>
    </defs>
    <rect width="840" height="660" fill="#e7f2ee"/>
    <rect width="840" height="660" fill="url(#tilePattern)"/>
    <path d="M0 20q200-30 420 10t420-8v-40H0Z" fill="#d4ebe6"/>
    <path d="M0 540q180 40 400-10t440 20v110H0Z" fill="#dceee9"/>
    <g fill="#ffffff" fill-opacity=".55" stroke="#c9e3dc" stroke-width="2">
      <circle cx="760" cy="80" r="28"/>
      <circle cx="722" cy="49" r="11"/>
      <circle cx="785" cy="126" r="8"/>
      <circle cx="75" cy="570" r="22"/>
      <circle cx="109" cy="601" r="9"/>
    </g>
  </svg>
  <!-- Keep sprite proportions independent of the stretching backdrop. -->
  <svg class="landscape" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
    <GameSprite name="toothbrush" :x="38 / 840 * width" :y="39 / 660 * height" width="36" height="72" opacity=".72"/>
    <GameSprite name="toothbrush" :x="762 / 840 * width" :y="530 / 660 * height" width="32" height="68" opacity=".65"/>
  </svg>
</template>
