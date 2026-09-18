<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { motions, sheetLayout, type SheetSettings } from './animation';
import type { StudioContext } from './catalog';
import { download, pngBlob } from './download';
import { fileStem, parseRecipe, type Recipe } from './recipe';
import { renderSheet, sheetMetadata, sheetPack } from './sheet';

const props = defineProps<{ recipe: Recipe; context: StudioContext }>();
const emit = defineEmits<{ 'update:sheet': [value: SheetSettings] }>();
const sheetCanvas = ref<HTMLCanvasElement | null>(null);
const player = ref<HTMLCanvasElement | null>(null);
const current = ref(0); const playing = ref(false); const ready = ref(false);
const exporting = ref(false); const message = ref(''); const error = ref('');
const layout = computed(() => sheetLayout(props.recipe.size, props.recipe.sheet));
const sheet = computed(() => props.recipe.sheet);
let request = 0; let revision = 0; let rendered: HTMLCanvasElement | null = null;

function update(key: keyof SheetSettings, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  emit('update:sheet', { ...sheet.value, [key]: key === 'motion' ? value : Number(value) });
}
function paintFrame() {
  if (!player.value || !rendered || !ready.value) return;
  const { size } = props.recipe; const ctx = player.value.getContext('2d'); if (!ctx) return;
  player.value.width = size; player.value.height = size;
  ctx.drawImage(rendered, current.value % layout.value.columns * size, Math.floor(current.value / layout.value.columns) * size, size, size, 0, 0, size, size);
}
function pause() { playing.value = false; cancelAnimationFrame(request); }
function step(next: number) { pause(); current.value = (next + sheet.value.frames) % sheet.value.frames; paintFrame(); }
function toggle() {
  if (playing.value) { pause(); return; }
  if (!ready.value) return;
  playing.value = true; const start = performance.now(); const first = current.value;
  function tick(now: number) {
    if (!playing.value) return;
    const next = (first + Math.floor((now - start) * sheet.value.fps / 1000)) % sheet.value.frames;
    if (current.value !== next) { current.value = next; paintFrame(); }
    request = requestAnimationFrame(tick);
  }
  request = requestAnimationFrame(tick);
}
async function redraw() {
  const job = ++revision; pause(); ready.value = false; message.value = ''; error.value = ''; current.value = 0;
  try {
    const result = await renderSheet(props.recipe);
    if (job !== revision || !sheetCanvas.value) return;
    rendered = result; sheetCanvas.value.width = result.width; sheetCanvas.value.height = result.height;
    sheetCanvas.value.getContext('2d')!.drawImage(result, 0, 0); ready.value = true; paintFrame();
  } catch { if (job === revision) error.value = '未能製作動畫圖集，請重新載入後再試。'; }
}
async function exportSheet(kind: 'zip' | 'png' | 'json') {
  exporting.value = true; error.value = '';
  const snapshot = parseRecipe(props.recipe); const context = { ...props.context };
  const stem = `${fileStem(context, snapshot)}-${snapshot.sheet.motion}-${snapshot.sheet.frames}f-${snapshot.sheet.fps}fps-${snapshot.sheet.columns}cols`;
  try {
    const blob = kind === 'zip' ? await sheetPack(snapshot, context)
      : kind === 'png' ? await pngBlob(await renderSheet(snapshot))
      : new Blob([JSON.stringify(sheetMetadata(snapshot, `${stem}.png`), null, 2)], { type: 'application/json' });
    download(blob, `${stem}.${kind}`);
    message.value = kind === 'zip' ? '素材包已送往下載：圖集 PNG、影格 JSON、設計 JSON 與說明。檢查後可在下方標記完成。' : `${kind.toUpperCase()} 已送往下載。圖集 PNG 與影格 JSON 請成對保留。`;
  } catch { error.value = '圖集匯出失敗，請再試一次。'; }
  finally { exporting.value = false; }
}
function onVisibility() { if (document.hidden) pause(); }
onMounted(() => { void redraw(); document.addEventListener('visibilitychange', onVisibility); });
onUnmounted(() => { revision++; pause(); document.removeEventListener('visibilitychange', onVisibility); });
watch(() => props.recipe, redraw, { deep: true });
</script>

<template>
  <section class="sheet-panel studio-panel" aria-label="2D 動畫圖集">
    <div class="sheet-heading"><div><p class="studio-eyebrow">2D SPRITE SHEET</p><h2>讓這個小素材動起來</h2><p>一個素材，一段循環。保留原畫筆觸，輸出遊戲可用的透明影格。</p></div><span class="sheet-badge">PNG + JSON</span></div>
    <div class="sheet-workbench">
      <div class="sheet-player">
        <div class="animation-stage backdrop-checker"><canvas ref="player" role="img" :aria-label="`動畫預覽，第 ${current + 1} 格`" :aria-busy="!ready"/></div>
        <div class="playback-controls"><button class="soft-button" type="button" :disabled="!ready" aria-label="上一格" @click="step(current - 1)">←</button><button class="soft-button play-button" type="button" :disabled="!ready" :aria-pressed="playing" @click="toggle">{{ playing ? 'Ⅱ 暫停' : '▶ 播放' }}</button><button class="soft-button" type="button" :disabled="!ready" aria-label="下一格" @click="step(current + 1)">→</button></div>
        <label class="frame-control">影格 {{ current + 1 }} / {{ sheet.frames }}<input aria-label="預覽影格" type="range" min="0" :max="sheet.frames - 1" :value="current" :disabled="!ready" @input="step(Number(($event.target as HTMLInputElement).value))"></label>
      </div>
      <div class="sheet-production">
        <div class="sheet-settings">
          <label>循環動作<select :value="sheet.motion" @change="update('motion', $event)"><option v-for="(label, id) in motions" :key="id" :value="id">{{ label }}</option></select></label>
          <label>影格數<select :value="sheet.frames" @change="update('frames', $event)"><option v-for="count in [4, 8, 12]" :key="count" :value="count">{{ count }} 格</option></select></label>
          <label>播放速度<select :value="sheet.fps" @change="update('fps', $event)"><option v-for="fps in 23" :key="fps" :value="fps + 1">{{ fps + 1 }} FPS</option></select></label>
          <label>每列最多<select :value="sheet.columns" @change="update('columns', $event)"><option v-for="columns in [1, 2, 4, 8]" :key="columns" :value="columns">{{ columns }} 格</option></select></label>
        </div>
        <div class="sheet-scroll"><div class="sheet-canvas-wrap backdrop-checker" :style="{ maxWidth: `${Math.max(160, Math.min(620, 320 * layout.columns / layout.rows))}px` }"><canvas ref="sheetCanvas" role="img" aria-label="透明 sprite sheet 圖集" :aria-busy="!ready"/><div class="sheet-grid" aria-hidden="true" :style="{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)` }"><span v-for="i in layout.columns * layout.rows" :key="i" :class="{ 'current-frame': i === current + 1 }">{{ i <= sheet.frames ? String(i).padStart(2, '0') : '' }}</span></div></div></div>
        <p class="sheet-dimensions">{{ layout.width }} × {{ layout.height }} px · 每格 {{ recipe.size }} px · {{ (sheet.frames / sheet.fps).toFixed(2) }} 秒循環</p>
        <p class="sheet-note">格線與編號只供預覽。動作以整張插畫的位移、旋轉或縮放製作。</p>
      </div>
    </div>
    <div class="sheet-export"><p>整包包含圖集、影格座標與可重新編輯的設計檔。</p><div><button type="button" class="quiet-button" :disabled="exporting || !ready" @click="exportSheet('png')">圖集 PNG</button><button type="button" class="quiet-button" :disabled="exporting || !ready" @click="exportSheet('json')">影格 JSON</button><button type="button" class="download-button" :disabled="exporting || !ready" @click="exportSheet('zip')">↓ {{ exporting ? '打包中…' : '下載 Sprite 素材包' }}</button></div></div>
    <p v-if="message" class="sheet-message" role="status">{{ message }}</p><p v-if="error" class="sheet-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.sheet-panel{margin-top:20px;padding:24px}.sheet-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.sheet-heading h2{font-size:21px;margin:4px 0 8px}.sheet-heading p:last-child{font-size:12px;color:var(--studio-muted)}.sheet-badge{font-size:10px;white-space:nowrap;padding:6px 10px;border-radius:20px;background:#eef1e1;color:#7c8b62}.sheet-workbench{display:grid;grid-template-columns:220px minmax(0,1fr);gap:30px;margin-top:22px;align-items:start}.animation-stage{aspect-ratio:1;border:1px solid var(--studio-line);border-radius:12px;display:grid;place-items:center;overflow:hidden}.animation-stage canvas{width:100%;height:100%;object-fit:contain}.playback-controls{display:flex;gap:7px;margin-top:12px}.play-button{flex:1}.frame-control{display:flex;flex-direction:column;gap:8px;font-size:10px;margin-top:14px;color:var(--studio-muted)}.frame-control input{width:100%;accent-color:#7e9668}.sheet-settings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.sheet-settings label{display:grid;gap:6px;font-size:11px}.sheet-settings select{width:100%}.sheet-scroll{max-height:340px;overflow:auto;border-radius:10px}.sheet-canvas-wrap{position:relative;border:1px solid var(--studio-line);border-radius:10px;overflow:hidden;width:100%;max-width:620px}.sheet-canvas-wrap canvas{display:block;width:100%;height:auto}.sheet-grid{display:grid;position:absolute;inset:0;pointer-events:none}.sheet-grid span{border:1px solid #70846426;font:9px ui-monospace,monospace;color:#657950;padding:4px}.sheet-grid .current-frame{box-shadow:inset 0 0 0 2px #8eaa72;background:#89a66709}.sheet-dimensions{font-size:11px;color:#607b51;margin-top:10px!important}.sheet-note{font-size:10px;color:var(--studio-muted);margin-top:6px!important}.sheet-export{display:flex;gap:18px;justify-content:space-between;align-items:center;margin-top:22px;border-top:1px solid var(--studio-line);padding-top:18px}.sheet-export p{font-size:11px;color:var(--studio-muted)}.sheet-export>div{display:flex;align-items:center;gap:18px}.sheet-message,.sheet-error{font-size:11px;margin-top:12px!important;color:#5a7c4a}.sheet-error{color:#b06045}
@media(max-width:850px){.sheet-panel{padding:20px}.sheet-workbench{grid-template-columns:170px minmax(0,1fr);gap:20px}.sheet-settings{grid-template-columns:1fr 1fr}.sheet-export{flex-wrap:wrap}.sheet-export>div{margin-left:auto}}
@media(max-width:620px){.sheet-panel{padding:17px}.sheet-heading h2{font-size:18px}.sheet-heading p:last-child{font-size:11px}.sheet-badge{display:none}.sheet-workbench{grid-template-columns:1fr;gap:22px}.sheet-player{width:196px;margin:auto}.sheet-settings{gap:12px}.sheet-export>div{display:grid;grid-template-columns:1fr 1fr;width:100%;gap:8px}.sheet-export .download-button{grid-column:1/-1}.sheet-export .quiet-button{border:1px solid var(--studio-line);border-radius:8px}.sheet-export p{font-size:10px}}
</style>
