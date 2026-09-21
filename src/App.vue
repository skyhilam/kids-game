<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import DeliveryPlay from './components/DeliveryPlay.vue';
import Hub from './components/Hub.vue';
import IconDefs from './components/IconDefs.vue';
import ListenPlay from './components/ListenPlay.vue';
import PicnicPlay from './components/PicnicPlay.vue';
import SequencePlay from './components/SequencePlay.vue';
import StickerPlay from './components/StickerPlay.vue';
import ToothPlay from './components/ToothPlay.vue';
import { initializeLibrary } from './studio/store';

const activity = ref<'hub' | 'picnic' | 'tooth' | 'delivery' | 'sticker' | 'listen' | 'sequence'>('hub');
const SpriteStudio = defineAsyncComponent(() => import('./studio/SpriteStudio.vue'));
const studioOpen = ref(window.location.hash === '#sprite-studio');
function syncRoute() { studioOpen.value = window.location.hash === '#sprite-studio'; }
function closeStudio() { window.location.hash = ''; }
onMounted(() => { initializeLibrary(); window.addEventListener('hashchange', syncRoute); });
onUnmounted(() => window.removeEventListener('hashchange', syncRoute));
</script>

<template>
  <IconDefs />
  <SpriteStudio v-if="studioOpen" @home="closeStudio"/>
  <Hub v-else-if="activity === 'hub'" @pick="activity = $event"/>
  <PicnicPlay v-else-if="activity === 'picnic'" @home="activity = 'hub'"/>
  <ToothPlay v-else-if="activity === 'tooth'" @home="activity = 'hub'"/>
  <DeliveryPlay v-else-if="activity === 'delivery'" @home="activity = 'hub'"/>
  <StickerPlay v-else-if="activity === 'sticker'" @home="activity = 'hub'"/>
  <ListenPlay v-else-if="activity === 'listen'" @home="activity = 'hub'"/>
  <SequencePlay v-else-if="activity === 'sequence'" @home="activity = 'hub'"/>
</template>
