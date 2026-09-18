<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import GameSprite from '../components/GameSprite.vue';
import { randomSeed } from '../game/rng';
import { contextKey, kits, levelInfo, models, type GameKind, type ModelName, type StudioContext } from './catalog';
import CanvasSprite from './CanvasSprite.vue';
import SpriteSheet from './SpriteSheet.vue';
import { hasBuiltInAction, hasGeneratedAction, importAnimation, readJob } from './generation';
import { renderSprite } from './draw';
import { download, pngBlob } from './download';
import { exportDesign, fileStem, generateRecipe, initialRecipe, paletteColors, palettes, parseDesign, recipeKey, type Lockable, type PaletteName, type Recipe } from './recipe';
import { activeSprites, applySprite, completeSprite, initializeLibrary, library, restoreSprite, storageWarning, styleNotice } from './store';

const emit = defineEmits<{ home: [] }>();
initializeLibrary();
const game = ref<GameKind>('picnic');
const level = ref(1);
const selected = ref<ModelName>('car');
const recipe = ref<Recipe>(initialRecipe('car'));
const seedInput = ref<number | string>(recipe.value.seed);
const locks = ref<Lockable[]>([]);
const backdrop = ref('checker');
const message = ref('');
const error = ref('');
const importInput = ref<HTMLInputElement | null>(null);
const downloading = ref(false);
const applying = ref(false);
const context = computed<StudioContext>(() => ({ game: game.value, level: level.value }));
const currentKit = computed(() => kits[game.value]);
const info = computed(() => levelInfo(context.value));
const selectionKey = computed(() => contextKey(context.value, selected.value));
const saved = computed(() => library.value.records[selectionKey.value]);
const completed = computed(() => !!saved.value && recipeKey(saved.value.recipe) === recipeKey(recipe.value));
const completedCount = computed(() => currentKit.value.sprites.filter(name => library.value.records[contextKey(context.value, name)]).length);
const isApplied = computed(() => {
  const applied = library.value.active[selected.value];
  const rendered = activeSprites.value[selected.value];
  return !!applied && !!rendered && recipeKey(applied) === recipeKey(recipe.value)
    && (!(hasBuiltInAction(recipe.value) || hasGeneratedAction(recipe.value)) || rendered.frames > 1);
});
const drafts = new Map<string, Recipe>();
const versionCount = computed(() => Object.keys(library.value.records).length);
const recent = computed(() => Object.values(library.value.records).sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 8));
const variantLabels = ['原作構圖', '微微左傾', '微微右傾'];
const smallRecipe = computed(() => ({ ...recipe.value, size: 64 as const }));

function stash() { drafts.set(selectionKey.value, { ...recipe.value }); }
function loadSelected() {
  recipe.value = { ...(drafts.get(selectionKey.value) ?? saved.value?.recipe ?? initialRecipe(selected.value)) };
  seedInput.value = recipe.value.seed; error.value = ''; message.value = '';
}
function chooseGame(next: GameKind) {
  stash(); game.value = next; level.value = 1; selected.value = kits[next].sprites[0]; loadSelected();
}
function chooseSprite(name: ModelName) { stash(); selected.value = name; loadSelected(); }
function changeLevel(event: Event) {
  const input = event.target as HTMLInputElement; const next = Number(input.value);
  if (!Number.isInteger(next) || next < 1 || next > 9999) { input.value = String(level.value); error.value = '請輸入 1 至 9999 的關卡編號。'; return; }
  stash(); level.value = next; loadSelected();
}
function setPalette(palette: PaletteName) {
  recipe.value = { ...recipe.value, palette, ...paletteColors(selected.value, palette) };
}
function generate(seed = Number(seedInput.value)) {
  if (String(seedInput.value).trim() === '' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    error.value = '種子需要是 0 至 4294967295 的整數。'; return;
  }
  recipe.value = generateRecipe(selected.value, seed, recipe.value, locks.value); seedInput.value = seed;
  message.value = '已依種子生成；鎖定的部件保留。'; error.value = '';
}
function randomize() { seedInput.value = randomSeed(); generate(); }
function complete() {
  const persisted = completeSprite(context.value, recipe.value);
  message.value = persisted ? '已標記完成，同一關卡的素材不會重複建立紀錄。' : '已暫存於本頁；請下載設計 JSON。';
}
function nextUnfinished() {
  const names: readonly ModelName[] = currentKit.value.sprites;
  const start = names.indexOf(selected.value);
  for (let offset = 1; offset <= names.length; offset++) {
    const name = names[(start + offset) % names.length]!;
    if (!library.value.records[contextKey(context.value, name)]) { chooseSprite(name); return; }
  }
  message.value = '本關素材都已完成，可以選擇下一關或另一個遊戲。';
}
async function apply() {
  applying.value = true;
  try { await applySprite(recipe.value); message.value = '已套用。返回遊戲即可查看；有動作影格的素材會依設定速度循環播放。'; error.value = ''; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '未能套用素材，請重新載入後再試。'; }
  finally { applying.value = false; }
}
function restore() { restoreSprite(selected.value); message.value = '已恢復這個素材的原有插畫。'; }
async function downloadPng() {
  downloading.value = true; error.value = '';
  // Capture the exact selection before the asynchronous PNG encoding finishes.
  const snapshot = { ...recipe.value }; const destination = { ...context.value };
  try {
    const canvas = document.createElement('canvas'); await renderSprite(canvas, snapshot);
    const blob = await pngBlob(canvas);
    download(blob, `${fileStem(destination, snapshot)}.png`);
    message.value = '透明 PNG 已送往下載；檢查滿意後可標記完成。';
  } catch { error.value = 'PNG 下載失敗，請再試一次。'; }
  finally { downloading.value = false; }
}
async function downloadJson() {
  const snapshot = { ...recipe.value }; const destination = { ...context.value };
  try {
    const design = JSON.parse(exportDesign(destination, snapshot));
    if (hasGeneratedAction(snapshot)) design.animation = await readJob(snapshot.sheet.generationId!);
    download(new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' }), `${fileStem(destination, snapshot)}.json`);
    message.value = '設計 JSON 已送往下載，可重新載入繼續調整。';
  } catch { error.value = '無法載入角色影格，請檢查生成服務後再匯出設計。'; }
}
async function importJson(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 26_000_000) throw new Error('設計檔過大，請使用素材工房匯出的單個素材 JSON。');
    const contents = JSON.parse(await file.text());
    const design = parseDesign(contents);
    if (contents.animation) await importAnimation(contents.animation, design.recipe);
    stash(); game.value = design.context.game; level.value = design.context.level; selected.value = design.recipe.sprite;
    recipe.value = design.recipe; seedInput.value = design.recipe.seed;
    message.value = '已載入設計，可繼續修改。'; error.value = '';
  } catch (cause) { error.value = cause instanceof SyntaxError ? '檔案不是有效的 JSON。' : cause instanceof Error ? cause.message : '讀取設計失敗。'; }
  finally { input.value = ''; }
}
function openSaved(item: typeof recent.value[number]) {
  stash(); game.value = item.context.game; level.value = item.context.level; selected.value = item.recipe.sprite;
  recipe.value = { ...item.recipe }; seedInput.value = item.recipe.seed; message.value = '已載入完成版本。'; error.value = '';
}
watch(recipe, () => { error.value = ''; }, { deep: true });
loadSelected();
</script>

<template>
  <main class="sprite-studio">
    <header class="studio-header">
      <a href="#" class="studio-brand" @click.prevent="emit('home')"><span class="brand-mark" aria-hidden="true">✳</span><span>小小出遊家<small>SPRITE STUDIO</small></span></a>
      <div class="header-actions"><span class="local-dot">原作插畫 · Canvas 合成</span><button class="quiet-button" type="button" @click="emit('home')">← 返回遊戲</button></div>
    </header>

    <section class="studio-intro">
      <div><p class="studio-eyebrow">給每一段小冒險，一個新模樣</p><h1>小小素材工房<span>。</span></h1><p>沿用遊戲的繪本插畫，製作透明 2D sprites 與動畫圖集。搭配配色與小裝飾，每次完成一個。</p></div>
      <div class="intro-stamp"><strong>22</strong><span>種可生成素材<br>4 個遊戲主題</span></div>
    </section>

    <nav class="kit-tabs" aria-label="選擇遊戲">
      <button v-for="(kit, id) in kits" :key="id" type="button" :aria-pressed="game === id" @click="chooseGame(id)">
        <span class="kit-icon"><CanvasSprite :recipe="initialRecipe(kit.icon)" decorative/></span><span><strong>{{ kit.short }}</strong><small>{{ kit.sprites.length }} 種素材</small></span><span v-if="game === id" class="kit-check" aria-hidden="true">✓</span>
      </button>
    </nav>

    <div class="studio-workbench">
      <aside class="asset-panel studio-panel" aria-label="關卡素材清單">
        <div class="panel-heading"><span class="step-dot">01</span><h2>選個素材</h2></div>
        <div class="level-picker"><label for="studio-level">{{ game === 'delivery' ? '素材組' : '關卡' }}</label><input id="studio-level" type="number" min="1" max="9999" :value="level" @change="changeLevel"><span class="stage-label">{{ info.stage }}</span></div>
        <p class="level-name">{{ info.title }}</p>
        <div class="progress-caption"><span>已完成 {{ completedCount }} / {{ currentKit.sprites.length }}</span><span>{{ Math.round(completedCount / currentKit.sprites.length * 100) }}%</span></div>
        <progress :value="completedCount" :max="currentKit.sprites.length" aria-label="本關素材完成進度"/>
        <div class="asset-list">
          <button v-for="name in currentKit.sprites" :key="name" type="button" :aria-pressed="selected === name" :data-asset="name" @click="chooseSprite(name)">
            <span class="asset-thumb"><CanvasSprite :recipe="library.records[contextKey(context, name)]?.recipe ?? initialRecipe(name)" decorative/></span>
            <span><strong>{{ models[name].label }}</strong><small>{{ name }}</small></span>
            <span v-if="library.records[contextKey(context, name)]" class="done-tick" aria-label="已完成">✓</span>
          </button>
        </div>
        <p class="context-note">{{ info.note }}</p>
      </aside>

      <section class="preview-panel studio-panel" aria-label="素材預覽">
        <div class="preview-heading"><div><p class="studio-eyebrow">正在製作 · {{ selected }}</p><h2>{{ models[selected].label }}</h2></div><span class="status-pill" :class="{ done: completed }">{{ completed ? '✓ 已完成' : saved ? '● 有修改' : '○ 未完成' }}</span></div>
        <div class="art-stage" :class="`backdrop-${backdrop}`"><span class="canvas-label">原作繪本風格 · 透明底</span><div class="hero-canvas"><CanvasSprite :recipe="recipe"/></div><span class="canvas-dimensions">{{ recipe.size }} × {{ recipe.size }} px</span></div>
        <div class="preview-tools"><span>預覽底色</span><div class="backdrop-buttons" role="group" aria-label="預覽底色"><button v-for="(label, id) in { checker: '透明格', cream: '奶油白', green: '草地綠', dark: '深色' }" :key="id" type="button" :class="`swatch-${id}`" :aria-label="label" :aria-pressed="backdrop === id" @click="backdrop = id"/></div><span class="preview-only">僅影響預覽</span></div>
        <div class="scale-previews"><div><span class="sample-64"><CanvasSprite :recipe="smallRecipe" decorative/></span><small>64 px</small></div><div><span class="sample-32"><CanvasSprite :recipe="smallRecipe" decorative/></span><small>32 px</small></div><p>縮小也要認得出來。<br><span>檢查小尺寸的輪廓與表情。</span></p></div>
        <div class="seed-controls"><label for="studio-seed">組合種子 <small>SEED</small></label><div><input id="studio-seed" v-model="seedInput" inputmode="numeric" type="number" min="0" max="4294967295" @keydown.enter="generate()"><button type="button" class="soft-button" @click="generate()">依種子生成</button></div></div>
        <button type="button" class="random-button" @click="randomize()"><span aria-hidden="true">↻</span> 隨機一個新組合 <small>保留已鎖定部件</small></button>
        <div class="style-reference"><div class="reference-thumb"><GameSprite :name="selected" original :label="models[selected].label"/></div><div><strong>與遊戲共用同一套原畫</strong><p>保留原有比例、表情、陰影與筆觸。</p></div></div>
      </section>

      <section class="settings-panel studio-panel" aria-label="造型設定">
        <div class="panel-heading"><span class="step-dot">02</span><h2>搭配小細節</h2></div>
        <p class="settings-intro">喜歡的部件先鎖起來，再試一個新組合。</p>
        <div class="control-group"><div class="control-heading"><label for="studio-variant">構圖</label><label class="lock-toggle"><input v-model="locks" type="checkbox" value="variant">鎖定構圖</label></div><select id="studio-variant" v-model.number="recipe.variant"><option v-for="(label, index) in variantLabels" :key="index" :value="index">{{ label }}</option></select></div>
        <div class="control-group"><div class="control-heading"><label for="studio-detail">裝飾細節</label><label class="lock-toggle"><input v-model="locks" type="checkbox" value="detail">鎖定細節</label></div><select id="studio-detail" v-model.number="recipe.detail"><option :value="0">保留原作</option><option :value="1">花朵點綴</option><option :value="2">陽光點綴</option></select></div>
        <div class="control-group palette-control"><div class="control-heading"><span>配色</span><label class="lock-toggle"><input v-model="locks" type="checkbox" value="palette">鎖定配色</label></div><div class="palette-list"><button v-for="(palette, id) in palettes" :key="id" type="button" :aria-pressed="recipe.palette === id" :aria-label="palette.label" @click="setPalette(id)"><span class="palette-colors"><i :style="{ background: palette.primary }"/><i :style="{ background: palette.secondary }"/><i :style="{ background: palette.light }"/></span><span>{{ palette.label }}</span></button></div><div class="custom-colors"><label><input v-model="recipe.primary" type="color" aria-label="主色">主色</label><label><input v-model="recipe.secondary" type="color" aria-label="配色">配色</label></div></div>
        <div class="output-controls"><div class="control-heading"><label for="studio-size">輸出尺寸</label><span>透明 PNG</span></div><select id="studio-size" v-model.number="recipe.size"><option v-for="size in [64, 128, 256, 512]" :key="size" :value="size">{{ size }} × {{ size }} px</option></select><div class="scale-control"><label for="studio-scale">素材大小 <span>{{ recipe.scale }}%</span></label><input id="studio-scale" v-model.number="recipe.scale" type="range" min="60" max="100"></div><div class="output-toggles"><label><input v-model="recipe.mirror" type="checkbox">左右翻轉</label><span class="painted-note">保留繪本筆觸</span></div></div>
      </section>
    </div>

    <SpriteSheet :recipe="recipe" :context="context" @update:sheet="recipe = { ...recipe, sheet: $event }"/>

    <section class="export-bar studio-panel" aria-label="儲存與匯出">
      <div><span class="step-dot">03</span><div><h2>把這個小素材帶走</h2><p>下載作品，標記完成，再做下一個。</p></div></div>
      <div class="export-actions"><button class="soft-button" type="button" @click="downloadJson">設計 JSON</button><button class="download-button" type="button" :disabled="downloading" @click="downloadPng">↓ {{ downloading ? '準備中…' : '下載透明 PNG' }}</button><button class="complete-button" type="button" :disabled="completed" @click="complete">{{ completed ? '✓ 已完成' : '✓ 標記完成' }}</button><button class="quiet-button next-button" type="button" @click="nextUnfinished">下一個未完成 →</button></div>
    </section>
    <div class="feedback-area"><p v-if="styleNotice">{{ styleNotice }}</p><p v-if="message" role="status">{{ message }}</p><p v-if="error" class="error-text" role="alert">{{ error }}</p><p v-if="storageWarning" class="error-text" role="alert">{{ storageWarning }}</p><p class="download-help">若內嵌預覽沒有開始下載，請用 Chrome 開啟此頁面下載。</p></div>

    <section class="library-section">
      <div class="library-heading"><div><p class="studio-eyebrow">慢慢收藏，隨時繼續</p><h2>已完成的素材 <span>{{ versionCount }}</span></h2></div><button class="soft-button" type="button" @click="importInput?.click()">↑ 載入設計 JSON</button><input ref="importInput" class="sr-only" tabindex="-1" type="file" accept="application/json,.json" aria-label="載入設計檔" @change="importJson"></div>
      <div v-if="recent.length" class="saved-grid"><button v-for="item in recent" :key="contextKey(item.context, item.recipe.sprite)" type="button" @click="openSaved(item)"><span class="saved-thumb"><CanvasSprite :recipe="item.recipe" decorative/></span><strong>{{ models[item.recipe.sprite].label }}</strong><small>{{ kits[item.context.game].short }} · {{ item.context.level }}</small><span class="done-tick">✓</span></button></div>
      <div v-else class="empty-library"><span aria-hidden="true">✧</span><p>第一個小作品，從這裡開始。<br><small>按「標記完成」就會收進這裡，重開瀏覽器仍可繼續。</small></p></div>
      <p class="library-note">完成紀錄存於此瀏覽器，最近 8 個顯示於此；其他版本可從對應遊戲與關卡找回。下載 JSON 可另行備份。</p>
    </section>

    <section class="try-game studio-panel"><div><h2>放進遊戲，看看合不合適</h2><p>套用後，此瀏覽器中所有「{{ models[selected].label }}」會使用目前造型；有動作影格時依設定 FPS 循環播放，未有影格時顯示單張造型。可隨時恢復原畫。</p><p v-if="selected === 'car'">「小車」用於封面及說明；野餐棋盤使用「小車・俯視」，請分別套用。</p><p v-else-if="selected === 'car-top'">「小車・俯視」用於野餐棋盤上的車輛。</p></div><div><button class="soft-button" type="button" :disabled="!library.active[selected]" @click="restore">恢復原有插畫</button><button class="complete-button" type="button" :disabled="isApplied || applying" @click="apply">{{ applying ? '合成中…' : isApplied ? '✓ 正在使用' : '套用這個素材' }}</button></div></section>
    <footer class="studio-footer"><span>✳ 小小素材工房 · 原畫合成 · 角色動作生成</span><span>流程參考 <a href="https://pixel-gen.syngamelab.com/" target="_blank" rel="noopener noreferrer">Doll Atelier ↗</a> · <a href="https://developers.openai.com/api/docs/guides/image-generation" target="_blank" rel="noopener noreferrer">OpenAI 圖像 API ↗</a></span></footer>
  </main>
</template>

<style src="./studio.css"/>
