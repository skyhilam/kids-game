import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.BROWSER_OUT || join(root, 'browser-out');
mkdirSync(outDir, { recursive: true });
const logLines = [];
function log(line) {
  logLines.push(line);
  console.log(line);
}

const ART_IDS = [
  'art-bear', 'art-car', 'art-burger', 'art-shop', 'art-home',
  'art-park', 'art-picnic', 'art-picnic-place', 'art-tree', 'art-flower',
];
const URL = 'http://127.0.0.1:4173/kids-game/';

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(URL);
        if (res.ok) { resolve(); return; }
      } catch { /* not up yet */ }
      if (Date.now() - started > 30000) {
        reject(new Error('preview server did not start'));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function runOnce(page, pass) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && !url.includes('favicon')) {
      errors.push(`${res.status()} ${url}`);
    }
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  const title = await page.title();
  if (!title.includes('一起去野餐')) throw new Error(`title was ${title}`);
  await page.waitForSelector('#startBtn');
  const ids = await page.evaluate((want) => want.filter((id) => document.getElementById(id)), ART_IDS);
  const missing = ART_IDS.filter((id) => !ids.includes(id));
  if (missing.length) throw new Error(`missing art ids: ${missing.join(',')}`);
  const boardBox = await page.locator('#board').boundingBox();
  if (!boardBox || boardBox.width < 200 || boardBox.height < 150) {
    throw new Error(`board too small: ${JSON.stringify(boardBox)}`);
  }
  await page.click('#startBtn');
  await page.waitForFunction(() => !document.querySelector('dialog')?.open);
  await page.waitForSelector('.step-target');
  const targets = await page.locator('.step-target').count();
  if (targets < 1) throw new Error('no move targets after start');
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  log(`pass ${pass}: title=${title} board=${Math.round(boardBox.width)}x${Math.round(boardBox.height)} targets=${targets} errors=0`);
}

const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});
preview.stdout.on('data', (buf) => log(`[preview] ${buf.toString().trim()}`));
preview.stderr.on('data', (buf) => log(`[preview:err] ${buf.toString().trim()}`));

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await runOnce(page, 1);
  await page.screenshot({ path: join(outDir, 'game.png'), fullPage: true });
  await runOnce(page, 2);
  log('DONE both loads succeeded');
} catch (err) {
  log(`FAILED: ${err instanceof Error ? err.stack || err.message : err}`);
  writeFileSync(join(outDir, 'browser.log'), logLines.join('\n') + '\n');
  preview.kill();
  if (browser) await browser.close();
  process.exit(1);
}
writeFileSync(join(outDir, 'browser.log'), logLines.join('\n') + '\n');
if (browser) await browser.close();
preview.kill();
process.exit(0);
