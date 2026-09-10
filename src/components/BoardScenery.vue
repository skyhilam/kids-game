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
      <g transform="translate(766 73)">
        <g stroke="#e1c26a" stroke-width="2.6" stroke-linecap="round">
          <path d="M0-34v-7M0 34v7M-34 0h-7M34 0h7M-24-24l-5-5M24-24l5-5M24 24l5 5M-24 24l-5 5"/>
        </g>
        <circle r="25" fill="#f2d889"/>
        <circle cx="-7" cy="-1" r="2" fill="#a79964"/>
        <circle cx="7" cy="-1" r="2" fill="#a79964"/>
        <path d="M-5 7q5 5 10 0" fill="none" stroke="#b5a368" stroke-width="2" stroke-linecap="round"/>
      </g>
      <g fill="#f8faed" opacity=".85">
        <path d="M242 65c-5-24 28-31 39-11 25-17 39 3 32 17h-66q-9 0-5-6Z"/>
        <path d="M488 74c-2-13 16-23 25-9 21-12 31 4 25 11h-44q-9 0-6-2Z"/>
      </g>
      <use href="#art-tree" x="20" y="188" width="76" height="97"/>
      <use href="#art-tree" x="748" y="309" width="80" height="108"/>
      <use href="#art-tree" x="21" y="544" width="66" height="88"/>
      <use href="#art-flower" class="flower" x="265" y="238" width="29" height="35"/>
      <use href="#art-flower" class="flower" x="330" y="574" width="30" height="36"/>
      <use href="#art-flower" class="flower" x="533" y="437" width="28" height="34"/>
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
</template>
