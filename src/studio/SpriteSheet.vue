<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { motions, sheetLayout, type SheetSettings } from './animation';
import type { StudioContext } from './catalog';
import { download, pngBlob } from './download';
import { fileStem, parseRecipe, type Recipe } from './recipe';
import { renderSheet, sheetMetadata, sheetPack } from './sheet';
import { actionDescription, generatedFrames, generationBusy, hasBuiltInAction, hasGeneratedAction, readJob, releaseUncertainAnimation, serviceStatus, sourceKey, submitAnimation, waitForAnimation, type GenerationJob } from './generation';

const props = defineProps<{ recipe: Recipe; context: StudioContext }>();
const emit = defineEmits<{ 'update:sheet': [value: SheetSettings] }>();
const sheetCanvas = ref<HTMLCanvasElement | null>(null); const player = ref<HTMLCanvasElement | null>(null);
const current = ref(0); const playing = ref(false); const ready = ref(false);
const exporting = ref(false); const message = ref(''); const error = ref('');
const configured = ref(false); const checking = ref(true); const activeId = ref<string | null>(null);
const apiToken = ref(''); const serviceAvailable = ref(false);
const browserDirect = ref(import.meta.env.PROD); const activeStatus = ref<GenerationJob['status']>();
const provider = ref('OpenAI'); const model = ref(''); const connectionError = ref('');
const canGenerate = computed(() => serviceAvailable.value && !connectionError.value && (configured.value || !!apiToken.value.trim()));
const progress = ref(''); const disposed = ref(false);
const layout = computed(() => sheetLayout(props.recipe.size, props.recipe.sheet));
const sheet = computed(() => props.recipe.sheet);
const builtIn = computed(() => hasBuiltInAction(props.recipe));
const generated = computed(() => hasGeneratedAction(props.recipe));
let request = 0; let revision = 0; let rendered: HTMLCanvasElement | null = null;

function update(key: keyof SheetSettings, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  const next = { ...sheet.value, [key]: ['motion', 'prompt'].includes(key) ? value : Number(value) };
  if (['motion', 'prompt', 'frames'].includes(key)) { delete next.generationId; delete next.sourceKey; }
  emit('update:sheet', next);
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
  const job = ++revision; pause(); ready.value = false; message.value = ''; error.value = ''; current.value = 0; rendered = null;
  player.value?.getContext('2d')?.clearRect(0, 0, player.value.width, player.value.height);
  sheetCanvas.value?.getContext('2d')?.clearRect(0, 0, sheetCanvas.value.width, sheetCanvas.value.height);
  if (!builtIn.value && !generated.value) return;
  try {
    const result = await renderSheet(props.recipe);
    if (job !== revision || !sheetCanvas.value) return;
    rendered = result; sheetCanvas.value.width = result.width; sheetCanvas.value.height = result.height;
    sheetCanvas.value.getContext('2d')!.drawImage(result, 0, 0); ready.value = true; paintFrame();
  } catch (reason) { if (job === revision && !generationBusy.value) error.value = reason instanceof Error ? reason.message : '未能載入角色動作。'; }
}
async function checkService() {
  checking.value = true;
  try { const status = await serviceStatus(); serviceAvailable.value = true; configured.value = status.configured; activeId.value = status.activeId; activeStatus.value = status.activeStatus; browserDirect.value = status.transport === 'browser'; provider.value = status.provider; model.value = status.model; connectionError.value = status.error ?? ''; }
  catch (reason) { serviceAvailable.value = false; configured.value = false; model.value = ''; connectionError.value = reason instanceof Error ? reason.message : '未能準備生成，請重新檢查。'; }
  finally { checking.value = false; }
}
async function generate() {
  if (generationBusy.value || builtIn.value && ready.value) return;
  const snapshot = parseRecipe(props.recipe); const key = sourceKey(snapshot); const token = apiToken.value.trim();
  let submittedId: string | undefined;
  generationBusy.value = true; error.value = ''; progress.value = '準備原畫參考…';
  try {
    actionDescription(snapshot);
    let job: GenerationJob;
    if (generated.value) { job = await readJob(snapshot.sheet.generationId!); if (job.status === 'failed') job = await submitAnimation(snapshot, token); }
    else if (activeId.value) {
      job = await readJob(activeId.value);
      if (job.sprite !== snapshot.sprite) throw new Error('另一張素材正在生成，請先返回該素材查看結果。');
      // Recover the active job only through its exact content hash; submit will reuse it or reject a different request.
      if (job.status === 'processing') job = await submitAnimation(snapshot, token);
      else { activeId.value = null; job = await submitAnimation(snapshot, token); }
    } else job = await submitAnimation(snapshot, token);
    submittedId = job.id;
    snapshot.sheet = { ...snapshot.sheet, generationId: job.id, sourceKey: key };
    if (!disposed.value && sourceKey(props.recipe) === key) emit('update:sheet', snapshot.sheet);
    activeId.value = job.status === 'completed' ? null : job.id;
    job = await waitForAnimation(job, () => { progress.value = '正在繪製角色動作影格… 一次只處理一張素材。'; });
    progress.value = '統一角色比例、整理定位，檢查影格與透明背景…';
    await generatedFrames(snapshot);
    if (!disposed.value && sourceKey(props.recipe) === key) {
      await redraw(); message.value = '角色動作已生成並保存。請播放檢查姿勢及循環銜接；相同素材與動作會重用這次結果。';
      if (ready.value) toggle();
    }
  } catch (reason) {
    if (!disposed.value) {
      const failed = submittedId ? await readJob(submittedId).catch(() => undefined) : undefined;
      if (failed?.status === 'failed' && props.recipe.sheet.generationId === submittedId) {
        const next = { ...props.recipe.sheet }; delete next.generationId; delete next.sourceKey; emit('update:sheet', next);
        await nextTick();
      }
      error.value = reason instanceof Error ? reason.message : '生成失敗，請再試一次。';
    }
  }
  finally { generationBusy.value = false; progress.value = ''; if (!disposed.value) await checkService(); }
}
async function resumeOther() {
  if (!activeId.value || generationBusy.value) return;
  generationBusy.value = true; error.value = '';
  try { await waitForAnimation(await readJob(activeId.value), job => { progress.value = `正在完成 ${job.sprite} 的動作影格…`; }); message.value = '上一張素材的影格已保存，可返回該素材查看。'; }
  catch (reason) { error.value = (reason as Error).message; }
  finally { generationBusy.value = false; progress.value = ''; await checkService(); }
}
async function releasePending() {
  try {
    await releaseUncertainAnimation(); error.value = ''; message.value = '待確認工作已解除，尚未重新送出生成。';
    if (props.recipe.sheet.generationId === activeId.value) {
      const next = { ...props.recipe.sheet }; delete next.generationId; delete next.sourceKey; emit('update:sheet', next);
    }
  }
  catch (reason) { error.value = (reason as Error).message; }
  await checkService();
}
async function exportSheet(kind: 'zip' | 'png' | 'json') {
  exporting.value = true; error.value = '';
  const snapshot = parseRecipe(props.recipe); const context = { ...props.context };
  const stem = `${fileStem(context, snapshot)}-${snapshot.sheet.motion}-${snapshot.sheet.frames}f-${snapshot.sheet.fps}fps-${snapshot.sheet.columns}cols`;
  try {
    const blob = kind === 'zip' ? await sheetPack(snapshot, context)
      : kind === 'png' ? await pngBlob(await renderSheet(snapshot))
      : new Blob([JSON.stringify(sheetMetadata(snapshot, `${stem}.png`), null, 2)], { type: 'application/json' });
    download(blob, `${stem}.${kind}`); message.value = kind === 'zip' ? '素材包已送往下載，包含角色影格、座標及可重新載入的設計。' : `${kind.toUpperCase()} 已送往下載。`;
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '圖集匯出失敗，請再試一次。'; }
  finally { exporting.value = false; }
}
function onVisibility() { if (document.hidden) pause(); }
function clearApiToken() { apiToken.value = ''; }
onMounted(() => { void redraw(); void checkService(); document.addEventListener('visibilitychange', onVisibility); window.addEventListener('pagehide', clearApiToken); });
onUnmounted(() => { disposed.value = true; revision++; pause(); clearApiToken(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', clearApiToken); });
watch(() => props.recipe, redraw, { deep: true });
</script>

<template>
  <section class="sheet-panel studio-panel" aria-label="2D 角色動作生成">
    <div class="sheet-heading"><div><p class="studio-eyebrow">CHARACTER ANIMATION</p><h2>一鍵生成角色動作</h2><p>以目前原畫作參考，繪製整組連續姿勢，保留角色比例與繪本筆觸。</p></div><span class="sheet-badge">{{ ready ? '已處理 · 動作影格' : generationBusy ? '生成中' : '待生成' }}</span></div>
    <div class="action-generator">
      <label>角色動作<select :value="sheet.motion" :disabled="generationBusy" @change="update('motion', $event)"><option v-for="(label, id) in motions" :key="id" :value="id">{{ label }}</option></select></label>
      <label>影格數<select :value="sheet.frames" :disabled="generationBusy" @change="update('frames', $event)"><option v-for="count in [4, 8, 12]" :key="count" :value="count">{{ count }} 張姿勢</option></select></label>
      <label class="action-description">{{ sheet.motion === 'custom' ? '描述角色動作' : '補充動作描述（選填）' }}<textarea :value="sheet.prompt" :disabled="generationBusy" maxlength="400" rows="2" placeholder="例如：小熊抬起手臂揮手，眨一下眼，再回到起始姿勢。" @input="update('prompt', $event)"/></label>
      <div class="api-token-field">
        <label for="studio-api-token">OpenAI API token</label>
        <div class="api-token-control"><input id="studio-api-token" v-model="apiToken" type="password" autocomplete="off" autocapitalize="off" :spellcheck="false" maxlength="4096" placeholder="貼上你的 API token" aria-describedby="studio-api-token-note"><button type="button" class="quiet-button" :disabled="!apiToken" @click="clearApiToken">清除 token</button></div>
        <p id="studio-api-token-note" class="sheet-note">只供目前頁面使用，不會儲存或加入匯出檔案；重新整理即清除。{{ browserDirect ? '由此瀏覽器直接傳送至 OpenAI，貼上後即可生成。' : configured ? '留空時使用本機已設定的金鑰。' : '貼上後即可生成角色動作。' }}</p>
      </div>
      <div class="generation-bar"><p>{{ builtIn && ready ? '這個小車動作已有 8 張原畫影格，可直接播放及匯出。' : '原圖作為角色與畫風參考，每次生成一個動作。' }}</p><button type="button" class="download-button" :disabled="generationBusy || checking || ready || (!generated && !canGenerate) || (sheet.motion === 'custom' && !sheet.prompt.trim())" @click="generate">{{ generationBusy ? '正在生成…' : ready ? '✓ 動作已處理' : generated ? '查看生成結果' : '✦ 一鍵生成角色動作' }}</button></div>
    </div>
    <p v-if="checking" class="connection-note" role="status">正在檢查生成服務…</p>
    <div v-else-if="!serviceAvailable" class="connection-note"><strong>未能準備生成</strong><p>{{ browserDirect ? '請使用支援本機儲存的新版瀏覽器，檢查下方提示後重試。' : '請確認本機開發伺服器正在運行。' }}已保存的動作仍可播放和匯出。</p><button class="quiet-button" type="button" @click="checkService">重新檢查連線</button></div>
    <p v-if="browserDirect && serviceAvailable" class="sheet-note">網上生成已就緒。生成時請保持此頁開啟，影格會保存於此瀏覽器，可另行下載備份。</p>
    <p v-if="model" class="sheet-note">生成模型：{{ provider }} · {{ model }}</p>
    <p v-if="connectionError" class="sheet-error" role="alert">{{ connectionError }}</p>
    <p v-if="activeId && !generationBusy" class="connection-note"><template v-if="browserDirect && activeStatus === 'uncertain'">上次生成中斷，未能確認結果。請先核對 OpenAI 用量，避免重複付費。<button type="button" class="quiet-button" @click="releasePending">已核對用量，解除待確認工作</button></template><template v-else>有一張素材正在處理。<button type="button" class="quiet-button" @click="resumeOther">查看進度</button></template></p>
    <p v-if="progress" class="generation-progress" role="status">{{ progress }}</p>
    <div class="sheet-workbench">
      <div class="sheet-player">
        <div class="animation-stage backdrop-checker"><canvas ref="player" v-show="ready" role="img" :aria-label="`動畫預覽，第 ${current + 1} 格`"/><p v-if="!ready" class="empty-animation">{{ generationBusy ? '角色動作繪製中' : '生成後在這裡播放角色動作' }}</p></div>
        <div class="playback-controls"><button class="soft-button" type="button" :disabled="!ready" aria-label="上一格" @click="step(current - 1)">←</button><button class="soft-button play-button" type="button" :disabled="!ready" :aria-pressed="playing" @click="toggle">{{ playing ? 'Ⅱ 暫停' : '▶ 播放' }}</button><button class="soft-button" type="button" :disabled="!ready" aria-label="下一格" @click="step(current + 1)">→</button></div>
        <label class="frame-control">{{ ready ? `影格 ${current + 1} / ${sheet.frames}` : '等待動作影格' }}<input aria-label="預覽影格" type="range" min="0" :max="sheet.frames - 1" :value="current" :disabled="!ready" @input="step(Number(($event.target as HTMLInputElement).value))"></label>
      </div>
      <div class="sheet-production">
        <div class="sheet-settings">
          <label>播放速度<select :value="sheet.fps" @change="update('fps', $event)"><option v-for="fps in 23" :key="fps" :value="fps + 1">{{ fps + 1 }} FPS</option></select></label>
          <label>每列最多<select :value="sheet.columns" @change="update('columns', $event)"><option v-for="columns in [1, 2, 4, 8]" :key="columns" :value="columns">{{ columns }} 格</option></select></label>
        </div>
        <div class="sheet-scroll" v-show="ready"><div class="sheet-canvas-wrap backdrop-checker" :style="{ maxWidth: `${Math.max(160, Math.min(620, 320 * layout.columns / layout.rows))}px` }"><canvas ref="sheetCanvas" role="img" aria-label="透明角色動作 sprite sheet"/><div class="sheet-grid" aria-hidden="true" :style="{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)` }"><span v-for="i in layout.columns * layout.rows" :key="i" :class="{ 'current-frame': i === current + 1 }">{{ i <= sheet.frames ? String(i).padStart(2, '0') : '' }}</span></div></div></div>
        <div v-if="!ready" class="empty-sheet"><strong>動作影格將排列在這裡</strong><p>選擇動作後按「一鍵生成」。產生的新姿勢可逐格檢查。</p></div>
        <p v-if="ready" class="sheet-dimensions">{{ layout.width }} × {{ layout.height }} px · 每格 {{ recipe.size }} px · {{ (sheet.frames / sheet.fps).toFixed(2) }} 秒循環</p>
        <p class="sheet-note">整組姿勢使用共同比例整理成每格 256 px，跳躍及跑步保留離地高度。請播放檢查角色與循環，再標記完成；調整 FPS 與排版不會重新生成。</p>
      </div>
    </div>
    <div class="sheet-export"><p>透明圖集、影格座標與完整設計一起保存。</p><div><button type="button" class="quiet-button" :disabled="exporting || !ready" @click="exportSheet('png')">圖集 PNG</button><button type="button" class="quiet-button" :disabled="exporting || !ready" @click="exportSheet('json')">影格 JSON</button><button type="button" class="download-button" :disabled="exporting || !ready" @click="exportSheet('zip')">↓ {{ exporting ? '打包中…' : '下載 Sprite 素材包' }}</button></div></div>
    <p v-if="message" class="sheet-message" role="status">{{ message }}</p><p v-if="error" class="sheet-error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>
.api-token-field{grid-column:1/-1}.api-token-control{display:flex;gap:12px;align-items:center;margin-top:7px}.api-token-control input{flex:1;min-width:0;width:100%;font:inherit;color:inherit;border:1px solid var(--studio-line);border-radius:8px;padding:12px;background:#fffef9;box-sizing:border-box}.api-token-control button{flex-shrink:0}
.sheet-panel{margin-top:20px;padding:24px}.sheet-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.sheet-heading h2{font-size:21px;margin:4px 0 8px}.sheet-heading p:last-child{font-size:12px;color:var(--studio-muted)}.sheet-badge{font-size:10px;white-space:nowrap;padding:6px 10px;border-radius:20px;background:#eef1e1;color:#7c8b62}.sheet-workbench{display:grid;grid-template-columns:220px minmax(0,1fr);gap:30px;margin-top:22px;align-items:start}.animation-stage{aspect-ratio:1;border:1px solid var(--studio-line);border-radius:12px;display:grid;place-items:center;overflow:hidden}.animation-stage canvas{width:100%;height:100%;object-fit:contain}.playback-controls{display:flex;gap:7px;margin-top:12px}.play-button{flex:1}.frame-control{display:flex;flex-direction:column;gap:8px;font-size:10px;margin-top:14px;color:var(--studio-muted)}.frame-control input{width:100%;accent-color:#7e9668}.sheet-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}.sheet-settings label{display:grid;gap:6px;font-size:11px}.sheet-settings select{width:100%}.sheet-scroll{max-height:340px;overflow:auto;border-radius:10px}.sheet-canvas-wrap{position:relative;border:1px solid var(--studio-line);border-radius:10px;overflow:hidden;width:100%;max-width:620px}.sheet-canvas-wrap canvas{display:block;width:100%;height:auto}.sheet-grid{display:grid;position:absolute;inset:0;pointer-events:none}.sheet-grid span{border:1px solid #70846426;font:9px ui-monospace,monospace;color:#657950;padding:4px}.sheet-grid .current-frame{box-shadow:inset 0 0 0 2px #8eaa72;background:#89a66709}.sheet-dimensions{font-size:11px;color:#607b51;margin-top:10px!important}.sheet-note{font-size:10px;color:var(--studio-muted);margin-top:6px!important}.sheet-export{display:flex;gap:18px;justify-content:space-between;align-items:center;margin-top:22px;border-top:1px solid var(--studio-line);padding-top:18px}.sheet-export p{font-size:11px;color:var(--studio-muted)}.sheet-export>div{display:flex;align-items:center;gap:18px}.sheet-message,.sheet-error{font-size:11px;margin-top:12px!important;color:#5a7c4a}.sheet-error{color:#b06045}
@media(max-width:850px){.sheet-panel{padding:20px}.sheet-workbench{grid-template-columns:170px minmax(0,1fr);gap:20px}.sheet-settings{grid-template-columns:1fr 1fr}.sheet-export{flex-wrap:wrap}.sheet-export>div{margin-left:auto}}
@media(max-width:620px){.sheet-panel{padding:17px}.sheet-heading h2{font-size:18px}.sheet-heading p:last-child{font-size:11px}.sheet-badge{display:none}.sheet-workbench{grid-template-columns:1fr;gap:22px}.sheet-player{width:196px;margin:auto}.sheet-settings{gap:12px}.sheet-export>div{display:grid;grid-template-columns:1fr 1fr;width:100%;gap:8px}.sheet-export .download-button{grid-column:1/-1}.sheet-export .quiet-button{border:1px solid var(--studio-line);border-radius:8px}.sheet-export p{font-size:10px}}
.action-generator{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-top:22px;padding:18px;border:1px solid var(--studio-line);border-radius:12px;background:#f8f8ef}.action-generator label{display:grid;gap:7px;font-size:12px}.action-description,.generation-bar{grid-column:1/-1}.action-description textarea{font:inherit;color:inherit;resize:vertical;border:1px solid var(--studio-line);border-radius:8px;padding:12px;background:#fffef9;min-height:70px;width:100%;box-sizing:border-box}.generation-bar{display:flex;justify-content:space-between;gap:18px;align-items:center}.generation-bar p,.connection-note{font-size:12px;color:var(--studio-muted)}.connection-note{margin-top:14px;padding:12px 16px;background:#f7f0df;border-radius:10px}.connection-note p{margin:5px 0 10px}.generation-progress{font-size:13px;color:#61794d;margin-top:16px}.empty-animation{padding:24px;text-align:center;font-size:13px;color:#73806b}.empty-sheet{min-height:145px;padding:28px;border:1px dashed var(--studio-line);border-radius:12px;display:flex;flex-direction:column;justify-content:center;color:var(--studio-muted);font-size:13px}.empty-sheet p{margin-top:8px}.sheet-panel button:disabled{opacity:.5;cursor:default}@media(max-width:700px){.generation-bar{flex-direction:column;align-items:stretch}.action-generator{padding:14px}.sheet-export>div{flex-wrap:wrap}}
</style>
