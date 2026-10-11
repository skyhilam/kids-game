<script setup lang="ts">
import type { ZoneId } from '../../formula/types';

/**
 * Original simple scene art for each island, drawn inline.
 * Flat shapes only: a compass rose, coins, a fenced field, a percent bar,
 * a right triangle, algebra tiles, a box with a pyramid, and a piggy bank.
 */
defineProps<{ zone: ZoneId; compact?: boolean }>();
</script>

<template>
  <svg
    class="formula-scene"
    :class="{ compact }"
    viewBox="0 0 240 120"
    :data-formula-scene="zone"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="240" height="120" rx="20" fill="#e8f0f4"/>
    <ellipse cx="120" cy="104" rx="104" ry="14" fill="#cfe2d4"/>

    <!-- 1 · compass rose -->
    <g v-if="zone === 1">
      <circle cx="120" cy="60" r="40" fill="#fffdf7" stroke="#9fc3bf" stroke-width="3"/>
      <circle cx="120" cy="60" r="30" fill="none" stroke="#d8e4e8" stroke-width="1.5" stroke-dasharray="3 4"/>
      <polygon points="120,24 127,56 120,60 113,56" fill="#e89d7d"/>
      <polygon points="120,96 127,64 120,60 113,64" fill="#9fb983"/>
      <polygon points="84,60 116,53 120,60 116,67" fill="#9fb983"/>
      <polygon points="156,60 124,53 120,60 124,67" fill="#9fb983"/>
      <polygon points="94,34 118,56 120,60 114,58" fill="#e9c465"/>
      <polygon points="146,34 122,56 120,60 126,58" fill="#e9c465"/>
      <polygon points="94,86 118,64 120,60 114,62" fill="#e9c465"/>
      <polygon points="146,86 122,64 120,60 126,62" fill="#e9c465"/>
      <circle cx="120" cy="60" r="4" fill="#4c6d5d"/>
      <text x="120" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#4c6d5d">N</text>
      <text x="120" y="112" text-anchor="middle" font-size="11" font-weight="700" fill="#4c6d5d">S</text>
      <text x="70" y="64" text-anchor="middle" font-size="11" font-weight="700" fill="#4c6d5d">W</text>
      <text x="170" y="64" text-anchor="middle" font-size="11" font-weight="700" fill="#4c6d5d">E</text>
    </g>

    <!-- 2 · a dollar coin next to a stack of cents -->
    <g v-else-if="zone === 2">
      <circle cx="80" cy="60" r="34" fill="#e9c465" stroke="#c99f3b" stroke-width="3"/>
      <circle cx="80" cy="60" r="26" fill="none" stroke="#fff3c4" stroke-width="2"/>
      <text x="80" y="70" text-anchor="middle" font-size="28" font-weight="800" fill="#806531">$1</text>
      <text x="124" y="66" text-anchor="middle" font-size="22" font-weight="800" fill="#4c6d5d">=</text>
      <g fill="#e89d7d" stroke="#c4745a" stroke-width="2">
        <ellipse cx="170" cy="86" rx="30" ry="9"/>
        <ellipse cx="170" cy="76" rx="30" ry="9"/>
        <ellipse cx="170" cy="66" rx="30" ry="9"/>
        <ellipse cx="170" cy="56" rx="30" ry="9"/>
        <ellipse cx="170" cy="46" rx="30" ry="9"/>
      </g>
      <ellipse cx="170" cy="36" rx="30" ry="9" fill="#f7c3ab" stroke="#c4745a" stroke-width="2"/>
      <text x="170" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="#4c6d5d">100 cents</text>
    </g>

    <!-- 3 · a fenced field with grid squares inside -->
    <g v-else-if="zone === 3">
      <rect x="54" y="28" width="132" height="64" rx="4" fill="#bfd9a8"/>
      <g stroke="#9fb983" stroke-width="1.5">
        <line x1="76" y1="28" x2="76" y2="92"/><line x1="98" y1="28" x2="98" y2="92"/>
        <line x1="120" y1="28" x2="120" y2="92"/><line x1="142" y1="28" x2="142" y2="92"/>
        <line x1="164" y1="28" x2="164" y2="92"/>
        <line x1="54" y1="49" x2="186" y2="49"/><line x1="54" y1="71" x2="186" y2="71"/>
      </g>
      <rect x="54" y="28" width="132" height="64" rx="4" fill="none" stroke="#a66f4a" stroke-width="5" stroke-dasharray="10 5"/>
      <circle cx="98" cy="60" r="5" fill="#e89d7d"/>
      <circle cx="142" cy="60" r="5" fill="#e9c465"/>
      <text x="120" y="18" text-anchor="middle" font-size="10" font-weight="700" fill="#4c6d5d">length</text>
      <text x="40" y="64" text-anchor="middle" font-size="10" font-weight="700" fill="#4c6d5d">width</text>
    </g>

    <!-- 4 · a percent bar and a pie -->
    <g v-else-if="zone === 4">
      <rect x="30" y="50" width="120" height="22" rx="11" fill="#fffdf7" stroke="#9fc3bf" stroke-width="2"/>
      <rect x="30" y="50" width="90" height="22" rx="11" fill="#9fb983"/>
      <text x="90" y="40" text-anchor="middle" font-size="12" font-weight="800" fill="#4c6d5d">75%</text>
      <text x="90" y="88" text-anchor="middle" font-size="10" fill="#5d7356">out of 100</text>
      <circle cx="192" cy="60" r="28" fill="#fffdf7" stroke="#9fc3bf" stroke-width="2"/>
      <path d="M192 60 L192 32 A28 28 0 0 1 220 60 Z" fill="#e9c465"/>
      <path d="M192 60 L220 60 A28 28 0 0 1 192 88 Z" fill="#e89d7d"/>
      <path d="M192 60 L192 88 A28 28 0 0 1 164 60 Z" fill="#9fb983"/>
    </g>

    <!-- 5 · a right triangle with a square corner and squares on the legs -->
    <g v-else-if="zone === 5">
      <rect x="70" y="56" width="36" height="36" fill="#fbefcf" stroke="#ecdbb1" stroke-width="2"/>
      <rect x="106" y="20" width="36" height="36" fill="#dfe9f6" stroke="#b7c7dd" stroke-width="2"/>
      <polygon points="106,92 142,92 142,56" fill="#e89d7d" stroke="#c4745a" stroke-width="3" stroke-linejoin="round"/>
      <polyline points="134,92 134,84 142,84" fill="none" stroke="#4c6d5d" stroke-width="2"/>
      <text x="88" y="78" text-anchor="middle" font-size="12" font-weight="800" fill="#806531">a²</text>
      <text x="124" y="42" text-anchor="middle" font-size="12" font-weight="800" fill="#3f5c86">b²</text>
      <text x="170" y="72" text-anchor="middle" font-size="12" font-weight="800" fill="#4c6d5d">c²</text>
      <line x1="150" y1="88" x2="186" y2="52" stroke="#4c6d5d" stroke-width="2" stroke-dasharray="4 3"/>
    </g>

    <!-- 6 · algebra tiles: a², ab, ab, b² in a square -->
    <g v-else-if="zone === 6">
      <rect x="66" y="18" width="54" height="54" fill="#9fc3bf" stroke="#fffdf7" stroke-width="2"/>
      <rect x="120" y="18" width="28" height="54" fill="#e9c465" stroke="#fffdf7" stroke-width="2"/>
      <rect x="66" y="72" width="54" height="28" fill="#e9c465" stroke="#fffdf7" stroke-width="2"/>
      <rect x="120" y="72" width="28" height="28" fill="#e89d7d" stroke="#fffdf7" stroke-width="2"/>
      <text x="93" y="50" text-anchor="middle" font-size="13" font-weight="800" fill="#2f493e">a²</text>
      <text x="134" y="50" text-anchor="middle" font-size="12" font-weight="800" fill="#806531">ab</text>
      <text x="93" y="91" text-anchor="middle" font-size="12" font-weight="800" fill="#806531">ab</text>
      <text x="134" y="91" text-anchor="middle" font-size="12" font-weight="800" fill="#7a3f2c">b²</text>
      <text x="190" y="64" text-anchor="middle" font-size="13" font-weight="800" fill="#4c6d5d">(a+b)²</text>
    </g>

    <!-- 7 · a box and a pyramid, with marked vertices -->
    <g v-else-if="zone === 7">
      <polygon points="50,44 94,44 110,30 66,30" fill="#dfe9f6" stroke="#3f5c86" stroke-width="2" stroke-linejoin="round"/>
      <rect x="50" y="44" width="44" height="44" fill="#9fc3bf" stroke="#3f5c86" stroke-width="2"/>
      <polygon points="94,44 110,30 110,74 94,88" fill="#7fa9a4" stroke="#3f5c86" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="140,88 200,88 212,76 152,76" fill="#fbefcf" stroke="#806531" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="140,88 200,88 176,30" fill="#e9c465" stroke="#806531" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="200,88 212,76 176,30" fill="#d9b24c" stroke="#806531" stroke-width="2" stroke-linejoin="round"/>
      <g fill="#e89d7d" stroke="#fffdf7" stroke-width="1.5">
        <circle cx="50" cy="44" r="3.5"/><circle cx="94" cy="44" r="3.5"/><circle cx="110" cy="30" r="3.5"/>
        <circle cx="66" cy="30" r="3.5"/><circle cx="50" cy="88" r="3.5"/><circle cx="94" cy="88" r="3.5"/>
        <circle cx="110" cy="74" r="3.5"/><circle cx="176" cy="30" r="3.5"/>
        <circle cx="140" cy="88" r="3.5"/><circle cx="200" cy="88" r="3.5"/><circle cx="212" cy="76" r="3.5"/>
      </g>
    </g>

    <!-- 8 · piggy bank and a rising coin trail -->
    <g v-else>
      <ellipse cx="86" cy="64" rx="40" ry="30" fill="#f7c3ab" stroke="#c4745a" stroke-width="2.5"/>
      <circle cx="122" cy="62" r="13" fill="#f7c3ab" stroke="#c4745a" stroke-width="2.5"/>
      <circle cx="126" cy="60" r="2" fill="#7a3f2c"/><circle cx="126" cy="66" r="2" fill="#7a3f2c"/>
      <circle cx="100" cy="54" r="2.5" fill="#7a3f2c"/>
      <rect x="76" y="34" width="20" height="5" rx="2" fill="#7a3f2c"/>
      <rect x="60" y="88" width="9" height="12" rx="3" fill="#e89d7d"/>
      <rect x="100" y="88" width="9" height="12" rx="3" fill="#e89d7d"/>
      <polygon points="52,42 60,34 68,46" fill="#f7c3ab" stroke="#c4745a" stroke-width="2.5" stroke-linejoin="round"/>
      <g fill="#e9c465" stroke="#c99f3b" stroke-width="2">
        <circle cx="160" cy="84" r="8"/><circle cx="178" cy="68" r="9"/><circle cx="198" cy="48" r="10"/><circle cx="220" cy="26" r="11"/>
      </g>
      <text x="160" y="88" text-anchor="middle" font-size="9" font-weight="800" fill="#806531">¢</text>
      <text x="198" y="52" text-anchor="middle" font-size="11" font-weight="800" fill="#806531">¢</text>
      <text x="220" y="30" text-anchor="middle" font-size="12" font-weight="800" fill="#806531">¢</text>
    </g>
  </svg>
</template>
