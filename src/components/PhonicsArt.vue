<script setup lang="ts">
import type { MouthCue, PhonicsZoneId } from '../phonics/zones';

withDefaults(defineProps<{
  kind?: 'island' | 'lock' | 'star' | 'stamp' | 'mouth';
  zone?: PhonicsZoneId;
  cue?: MouthCue;
  filled?: boolean;
  label?: string;
}>(), { kind: 'island', zone: 1, cue: 'open', filled: true });
</script>

<template>
  <svg
    class="phonics-art"
    viewBox="0 0 160 120"
    xmlns="http://www.w3.org/2000/svg"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : true"
    :data-mouth-cue="kind === 'mouth' ? cue : undefined"
    focusable="false"
  >
    <title v-if="label">{{ label }}</title>
    <g v-if="kind === 'island'">
      <ellipse cx="80" cy="96" rx="75" ry="19" fill="#cde7e7" />
      <ellipse cx="80" cy="84" rx="64" ry="23" fill="#f1d89f" />
      <ellipse cx="80" cy="78" rx="53" ry="18" fill="#b8cf9b" />
      <circle cx="132" cy="22" r="12" fill="#efc76b" />
      <g v-if="zone === 1">
        <path d="M35 72V29M35 31L65 40L35 49" fill="#e8a084" stroke="#765f47" stroke-width="4" stroke-linejoin="round" />
        <path d="M90 76L98 60L114 76Z" fill="#fff5d5" />
        <circle cx="73" cy="84" r="7" fill="#e8a084" />
      </g>
      <g v-else-if="zone === 2">
        <path d="M36 80L44 43L68 35L81 80Z" fill="#9aadb0" />
        <path d="M79 80L93 50L113 55L126 80Z" fill="#b5bfc0" />
        <path d="M48 52L64 47M97 64L109 66" stroke="#eef3ed" stroke-width="4" stroke-linecap="round" />
      </g>
      <g v-else-if="zone === 3 || zone === 4">
        <path :d="zone === 3 ? 'M27 81L49 41L80 76L111 39L136 81Z' : 'M27 81L58 24L88 64L108 40L136 81Z'" fill="#83aa88" />
        <path d="M68 86Q87 68 93 85" fill="none" stroke="#f9e8bd" stroke-width="9" />
        <circle cx="49" cy="82" r="5" fill="#e8a084" />
      </g>
      <g v-else-if="zone === 5">
        <path d="M28 81Q80 102 132 81" fill="none" stroke="#8ebebf" stroke-width="12" />
        <path d="M35 76Q80 42 125 76M35 57Q80 23 125 57" fill="none" stroke="#a17e57" stroke-width="6" />
        <path d="M36 57V79M57 46V67M80 41V61M103 46V67M124 57V79" stroke="#a17e57" stroke-width="5" />
      </g>
      <g v-else-if="zone === 6">
        <path d="M29 84L46 38L81 24L116 42L134 84Z" fill="#9faeb2" />
        <path d="M58 84V64A22 22 0 0 1 102 64V84Z" fill="#536f77" />
        <path d="M47 44L60 48L55 60Z" fill="#c9dddd" />
      </g>
      <g v-else-if="zone === 7">
        <path d="M49 82V43M82 89V33M114 81V47" stroke="#a17e57" stroke-width="7" />
        <path d="M28 64L49 26L70 64ZM57 62L82 17L107 62ZM95 65L114 31L133 65Z" fill="#749c7d" />
        <circle cx="82" cy="80" r="4" fill="#efc76b" />
      </g>
      <g v-else>
        <path d="M30 81Q55 57 80 81T130 81V91H30Z" fill="#8ebebf" />
        <path d="M51 62H102L91 76H62Z" fill="#e8a084" />
        <path d="M77 59V26L101 57Z" fill="#fff5d5" />
        <path d="M45 94Q58 88 71 94M93 97Q106 91 119 97" fill="none" stroke="#fff5d5" stroke-width="3" stroke-linecap="round" />
      </g>
    </g>
    <g v-else-if="kind === 'lock'" stroke="#647b78" stroke-width="7">
      <path d="M58 55V39A22 22 0 0 1 102 39V55" fill="none" />
      <rect x="46" y="54" width="68" height="51" rx="12" fill="#d7e1dc" />
      <path d="M80 75V86" stroke-linecap="round" />
    </g>
    <polygon
      v-else-if="kind === 'star'"
      points="80,12 95,43 130,48 105,73 111,108 80,92 49,108 55,73 30,48 65,43"
      :fill="filled ? '#efc76b' : '#e1e6dd'"
      :stroke="filled ? '#b78b36' : '#aab5a7'"
      stroke-width="4" stroke-linejoin="round"
    />
    <g v-else-if="kind === 'stamp'" transform="rotate(-12 80 60)">
      <circle cx="80" cy="60" r="49" fill="#f9e7d6" stroke="#c77352" stroke-width="5" />
      <circle cx="80" cy="60" r="40" fill="none" stroke="#c77352" stroke-width="3" stroke-dasharray="5 5" />
      <path d="M58 61L74 77L103 44" fill="none" stroke="#c77352" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <g v-else-if="kind === 'mouth'">
      <rect x="10" y="10" width="140" height="100" rx="40" fill="#f9e7d6" />
      <g stroke="#a15e51" stroke-width="5" stroke-linejoin="round">
        <ellipse v-if="cue === 'open'" cx="80" cy="62" rx="25" ry="34" fill="#794c4c" />
        <path v-else-if="cue === 'wide'" d="M35 48Q80 32 125 48Q112 87 80 87Q48 87 35 48Z" fill="#794c4c" />
        <ellipse v-else-if="cue === 'round'" cx="80" cy="62" rx="18" ry="26" fill="#794c4c" />
        <g v-else-if="cue === 'teeth'">
          <path d="M39 47Q80 31 121 47L111 71Q80 91 49 71Z" fill="#eaa18e" />
          <path d="M47 45Q80 36 113 45L107 61H53Z" fill="#fffdf7" />
        </g>
        <g v-else-if="cue === 'lips'">
          <path d="M36 61Q58 38 80 46Q102 38 124 61Q80 92 36 61Z" fill="#eaa18e" />
          <path d="M36 61H124" fill="none" />
        </g>
        <g v-else-if="cue === 'tongue'">
          <ellipse cx="80" cy="61" rx="37" ry="28" fill="#794c4c" />
          <path d="M64 82V58Q80 42 96 58V82" fill="#eaa18e" />
          <path d="M54 42Q80 29 106 42V49H54Z" fill="#fffdf7" />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.phonics-art{display:block;width:100%;height:auto;max-width:100%;flex-shrink:0}
</style>
