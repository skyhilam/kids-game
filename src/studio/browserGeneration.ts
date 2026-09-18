import { buildImageRequest, defaultImageModel, generationFingerprint, normalizeAtlas, providerError, validateInput, type GenerationJob } from './imageProvider';
import { spritePipelineVersion } from './spritePipeline';

export const browserActiveKey = 'picnic-sprite-generation-active-v1';
const lockName = 'picnic-sprite-generation';
const busyMessage = '目前有一張素材正在生成或等待確認，請完成後再製作下一張。';
const uncertainMessage = '未能從 OpenAI 確認生成結果，可能是網絡、跨來源限制或認證錯誤。請先核對 token 及 OpenAI API 用量，再解除待確認工作，避免重複付費。';
type JobStore = { read: (id: string) => Promise<GenerationJob | undefined>; save: (job: GenerationJob) => Promise<unknown> };

/** Static hosting uses the visitor's temporary token directly; no website server or stored key. */
export function createBrowserGeneration(store: JobStore) {
  const active = () => localStorage.getItem(browserActiveKey);
  const unlock = (id: string) => { if (active() === id) localStorage.removeItem(browserActiveKey); };
  const withLock = <T>(work: (available: boolean) => Promise<T>) => {
    if (!navigator.locks) throw new Error('此瀏覽器未支援安全的逐張生成，請使用新版 Chrome、Safari 或 Firefox。');
    return navigator.locks.request(lockName, { ifAvailable: true }, lock => work(!!lock));
  };
  async function recover() {
    // A lock is held for the entire request, including across other tabs. A free lock
    // with a persisted processing job means its page closed before receiving a result.
    await withLock(async available => {
      if (!available) return;
      const id = active(); if (!id) return;
      const job = await store.read(id);
      if (!job) throw new Error('找不到待確認的生成紀錄，請先檢查 OpenAI 用量。');
      if (job.status === 'processing' || job.status === 'submitting') {
        job.status = 'uncertain'; job.error = uncertainMessage; await store.save(job);
      } else if (job.status !== 'uncertain') unlock(id);
    });
  }
  async function poll(id: string) {
    await recover();
    const job = await store.read(id);
    if (!job) throw new Error('此瀏覽器找不到這個角色動作，請載入已匯出的設計 JSON。');
    return job;
  }
  async function status() {
    await recover();
    const id = active(); const job = id ? await store.read(id) : undefined;
    return { configured: false, provider: 'OpenAI', model: defaultImageModel, activeId: id, activeStatus: job?.status, transport: 'browser' as const };
  }
  async function submit(raw: unknown, apiToken?: string): Promise<GenerationJob> {
    const input = validateInput(raw);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(generationFingerprint(input)));
    const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return new Promise((resolve, reject) => {
      void withLock(async available => {
        const previous = await store.read(id);
        if (!available) {
          if (previous && previous.status !== 'failed') { resolve(previous); return; }
          throw new Error(busyMessage);
        }
        if (previous && previous.status !== 'failed') {
          if (previous.status === 'processing' || previous.status === 'submitting') {
            previous.status = 'uncertain'; previous.error = uncertainMessage; await store.save(previous);
          }
          resolve(previous); return;
        }
        if (active()) throw new Error(busyMessage);
        const token = apiToken?.trim();
        if (!token) throw new Error('請先輸入 OpenAI API token。');
        if (token.length > 4096 || !/^[\x21-\x7e]+$/.test(token)) throw new Error('API token 格式不正確，請重新貼上。');
        const job: GenerationJob = { id, status: 'processing', sprite: input.sprite, action: input.action, frames: input.frames, createdAt: new Date().toISOString(), model: defaultImageModel, requestId: crypto.randomUUID(), pipeline: { version: spritePipelineVersion, motion: input.motion, reference: input.source } };
        // Persist the job and lock before starting any paid request. Never persist the token.
        await store.save(job); localStorage.setItem(browserActiveKey, id); resolve({ ...job });
        try {
          const response = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Client-Request-Id': job.requestId! },
            body: JSON.stringify(buildImageRequest(input)), signal: AbortSignal.timeout(10 * 60_000), credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
          });
          if (!response.ok) {
            const detail = await response.json().catch(() => ({})) as { error?: { code?: string } };
            throw Object.assign(new Error(providerError(response.status, detail.error?.code)), { definitive: response.status < 500 && response.status !== 408 });
          }
          const output = await response.json();
          try { job.atlas = normalizeAtlas(output, input.frames); }
          catch (error) { throw Object.assign(error as Error, { definitive: true }); }
          job.status = 'completed';
        } catch (error) {
          job.status = (error as { definitive?: boolean }).definitive ? 'failed' : 'uncertain';
          job.error = job.status === 'failed' ? (error as Error).message : uncertainMessage;
        }
        await store.save(job);
        if (job.status !== 'uncertain') unlock(id);
      }).catch(reject);
    });
  }
  async function releaseUncertain() {
    await withLock(async available => {
      if (!available) throw new Error('生成仍在另一個頁面進行，請等候完成。');
      const id = active(); if (!id) return;
      const job = await store.read(id);
      if (!job || job.status !== 'uncertain') throw new Error('請先重新檢查工作狀態。');
      job.status = 'failed'; job.error = '已核對用量並解除待確認工作，可手動重新生成。';
      await store.save(job); unlock(id);
    });
  }
  return { submit, poll, status, releaseUncertain };
}
