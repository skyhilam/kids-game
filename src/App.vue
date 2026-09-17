<script setup lang="ts">
import { ref } from 'vue';
import DeliveryPlay from './components/DeliveryPlay.vue';
import Hub from './components/Hub.vue';
import IconDefs from './components/IconDefs.vue';
import PicnicPlay from './components/PicnicPlay.vue';
import StickerPlay from './components/StickerPlay.vue';
import ToothPlay from './components/ToothPlay.vue';

const activity = ref<'hub' | 'picnic' | 'tooth' | 'delivery' | 'sticker'>('hub');
</script>

<template>
  <IconDefs />
  <Hub v-if="activity === 'hub'" @pick="activity = $event"/>
  <PicnicPlay v-else-if="activity === 'picnic'" @home="activity = 'hub'"/>
  <ToothPlay v-else-if="activity === 'tooth'" @home="activity = 'hub'"/>
  <DeliveryPlay v-else-if="activity === 'delivery'" @home="activity = 'hub'"/>
  <StickerPlay v-else-if="activity === 'sticker'" @home="activity = 'hub'"/>
</template>
