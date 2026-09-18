import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const progress = JSON.parse(readFileSync(new URL('src/art/reference-progress.json', root), 'utf8'));
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const labels = { pending: '待處理', in_progress: '處理中', completed: '已處理' };
const known = new Map(progress.entries.map(entry => [entry.sha256, entry]));

if (known.size !== progress.entries.length) throw new Error('處理紀錄有重複的來源 SHA-256');
if (progress.entries.filter(entry => entry.status === 'in_progress').length > 1) {
  throw new Error('同時存在多張處理中的圖片，請先完成目前圖片');
}

for (const entry of progress.entries.filter(entry => entry.status === 'completed')) {
  if (!entry.output || !entry.outputSha256 || digest(new URL(entry.output, root)) !== entry.outputSha256) {
    throw new Error(`${entry.file} 的已完成輸出遺失或變更，請重新檢查紀錄`);
  }
}

const seen = new Set();
const queue = [];
let completed = 0;
for (const file of readdirSync(progress.sourceDirectory).filter(file => /\.(jpe?g|png|webp)$/i.test(file)).sort()) {
  const hash = digest(`${progress.sourceDirectory}/${file}`);
  const entry = known.get(hash);
  if (seen.has(hash)) {
    console.log(`重複來源\t${file}（內容相同，只處理一次）`);
    continue;
  }
  seen.add(hash);
  const status = entry?.status ?? 'pending';
  console.log(`${labels[status]}\t${file}${entry?.theme ? `\t${entry.theme}` : ''}`);
  if (status === 'completed') completed++;
  else queue.push({ file, status });
}

const next = queue.find(entry => entry.status === 'in_progress') ?? queue[0];
console.log(`\n已處理 ${completed}／${seen.size} 張不同內容的圖片。`);
console.log(next ? `下一張：${next.file}${next.status === 'in_progress' ? '（先接續處理）' : ''}` : '全部已處理。');
console.log(`紀錄：${fileURLToPath(new URL('src/art/reference-progress.json', root))}`);
