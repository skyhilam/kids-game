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

const PICNIC_ART = [
  'bear', 'car', 'car-top', 'burger', 'shop', 'home',
  'park', 'picnic-place', 'tree', 'flower', 'sun',
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

async function spriteNames(page) {
  return page.locator('[data-sprite]').evaluateAll((nodes) => nodes.map((node) => node.dataset.sprite));
}

async function openHub(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  const title = await page.title();
  if (!title.includes('小小出遊家')) throw new Error(`title was ${title}`);
  await page.getByRole('heading', { name: '選擇遊戲' }).waitFor();
  return title;
}

async function startPicnic(page) {
  await page.getByRole('button', { name: '一起去野餐 先到漢堡店，再前往公園。' }).click();
  await page.waitForSelector('#startBtn');
  const footnote = await page.locator('.dialog-footnote').textContent();
  if (!footnote?.includes('一路玩下去')) {
    throw new Error(`picnic welcome should be endless, got ${footnote}`);
  }
  const names = await spriteNames(page);
  const missing = PICNIC_ART.filter((name) => !names.includes(name));
  if (missing.length) throw new Error(`missing picnic sprites: ${missing.join(',')}`);
  const boardBox = await page.locator('#board').boundingBox();
  if (!boardBox || boardBox.width < 200 || boardBox.height < 150) {
    throw new Error(`picnic board too small: ${JSON.stringify(boardBox)}`);
  }
  await page.click('#startBtn');
  await page.waitForFunction(() => !document.querySelector('dialog')?.open);
  await page.waitForSelector('.step-target');
  const targets = await page.locator('.step-target').count();
  if (targets < 1) throw new Error('no picnic move targets after start');
  return { boardBox, targets };
}

async function waitPlayable(page) {
  await page.waitForFunction(() => {
    const hint = document.querySelector('.action-button.hint');
    return !document.querySelector('dialog')?.open && Boolean(hint) && !hint.disabled;
  });
  await page.waitForSelector('.step-target');
}

async function followHintsToWin(page) {
  await waitPlayable(page);
  for (let i = 0; i < 24; i += 1) {
    if (await page.locator('#nextBtn').isVisible().catch(() => false)) return;
    await page.locator('.action-button.hint:not([disabled])').click();
    if (await page.locator('#rescueBtn').isVisible().catch(() => false)) {
      throw new Error('hint reported no solution');
    }
    const hinted = page.locator('.step-target.hinted');
    await hinted.waitFor({ state: 'visible' });
    await hinted.click();
    await page.waitForFunction(() => {
      if (document.querySelector('#nextBtn') && document.querySelector('dialog')?.open) return true;
      const hint = document.querySelector('.action-button.hint');
      return Boolean(hint) && !hint.disabled && !document.querySelector('.board.moving');
    });
  }
  throw new Error('did not reach a win with hints');
}

async function mapFingerprint(page) {
  return page.evaluate(() => [...document.querySelectorAll('.road-center')]
    .map((path) => path.getAttribute('d'))
    .join(';'));
}

async function deliverUntilFirstHouse(page) {
  await page.getByRole('button', { name: '點選路口' }).click();
  for (let i = 0; i < 24; i += 1) {
    const score = await page.locator('.delivery-manifest-label strong').innerText();
    if (score.trim().startsWith('1')) {
      if (await page.getByText('貼包裹').count()) throw new Error('stamp button still shown after arrival');
      if (await page.locator('[data-delivered]').count() < 1) throw new Error('no house sticker after arrival');
      return;
    }
    await page.getByRole('button', { name: '提示' }).click();
    const stuckOpen = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return Boolean(dialog?.open && dialog.textContent?.includes('停一停'));
    });
    if (stuckOpen) throw new Error('hint said delivery is stuck before the first house');
    const hinted = page.locator('.delivery-target.hinted');
    await hinted.waitFor({ state: 'visible' });
    await hinted.click();
  }
  throw new Error('did not auto-deliver the first house');
}

async function deliveryFingerprint(page) {
  return page.evaluate(() => {
    const roads = [...document.querySelectorAll('.delivery-road')]
      .map((path) => path.getAttribute('d'))
      .sort()
      .join(';');
    const start = document.querySelector('[data-delivery-start]')?.getAttribute('transform');
    const finish = document.querySelector('[data-delivery-finish]')?.getAttribute('transform');
    const houses = [...document.querySelectorAll('[data-house]')].map((node) => node.getAttribute('transform'));
    return `${roads}|${start}|${finish}|${houses.join('|')}`;
  });
}

async function playFromFirstMap(page) {
  await waitPlayable(page);
  const badge = await page.locator('.level-badge').innerText();
  if (!badge.includes('第 1 關')) throw new Error(`expected 第 1 關, got ${badge}`);
  if (await page.locator('.level-dots').count()) throw new Error('endless maps should not show finite level dots');
  const fingerprint = await mapFingerprint(page);
  await page.click('button[aria-label="遊戲說明與關卡選擇"]');
  await page.getByRole('heading', { name: '遊戲說明' }).waitFor();
  if (await page.locator('.help-levels').count()) {
    throw new Error('help should not list fixed opening maps');
  }
  await page.click('#backToGame');
  await waitPlayable(page);
  await followHintsToWin(page);
  const nextLabel = await page.locator('#nextBtn').innerText();
  if (!nextLabel.includes('下一關')) throw new Error(`expected 下一關, got ${nextLabel}`);
  await page.click('#nextBtn');
  await waitPlayable(page);
  const later = await page.locator('.level-badge').innerText();
  if (!later.includes('第 2 關')) throw new Error(`second map badge was ${later}`);
  return fingerprint;
}

async function goHome(page) {
  await page.getByRole('button', { name: '選擇遊戲' }).click();
  await page.getByRole('heading', { name: '選擇遊戲' }).waitFor();
}

async function runPicnicPass(page, pass) {
  const errors = [];
  const onError = (err) => errors.push(String(err));
  const onResponse = (res) => {
    const url = res.url();
    if (res.status() >= 400 && !url.includes('favicon')) {
      errors.push(`${res.status()} ${url}`);
    }
  };
  page.on('pageerror', onError);
  page.on('response', onResponse);
  const title = await openHub(page);
  const { boardBox, targets } = await startPicnic(page);
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  page.off('pageerror', onError);
  page.off('response', onResponse);
  log(`pass ${pass}: title=${title} board=${Math.round(boardBox.width)}x${Math.round(boardBox.height)} targets=${targets} errors=0`);
}

async function runActivities(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await openHub(page);

  await page.getByRole('button', { name: '打敗蛀牙蟲 走到終點，途中避開蛀牙蟲。' }).click();
  await page.waitForSelector('#startBtn');
  const toothNote = await page.locator('.dialog-footnote').textContent();
  if (!toothNote?.includes('一路玩下去')) {
    throw new Error(`tooth welcome should be endless, got ${toothNote}`);
  }
  const toothSprites = await spriteNames(page);
  for (const name of ['kid', 'tooth', 'bug-coral', 'toothbrush']) {
    if (!toothSprites.includes(name)) throw new Error(`missing tooth sprite: ${name}`);
  }
  await page.click('#startBtn');
  await page.waitForFunction(() => !document.querySelector('dialog')?.open);
  await page.waitForSelector('.step-target');
  if (await page.locator('.step-target').count() < 1) throw new Error('no tooth move targets after start');
  await goHome(page);

  await page.getByRole('button', { name: '送貨員來了 畫線送到 1、2、3 號屋，再到終點。' }).click();
  await page.getByRole('button', { name: '開始送貨' }).waitFor();
  const deliverySprites = await spriteNames(page);
  for (const name of ['truck', 'truck-top', 'home']) {
    if (!deliverySprites.includes(name)) throw new Error(`missing delivery sprite: ${name}`);
  }
  await page.getByRole('button', { name: '開始送貨' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog')?.open);
  const deliveryBoard = await page.locator('.delivery-board').boundingBox();
  if (!deliveryBoard || deliveryBoard.width < 200 || deliveryBoard.height < 150) {
    throw new Error(`delivery board too small: ${JSON.stringify(deliveryBoard)}`);
  }
  const deliveryFirst = await deliveryFingerprint(page);
  await deliverUntilFirstHouse(page);
  await page.screenshot({ path: join(outDir, 'delivery-generated.png'), fullPage: true });
  log('desktop delivery: first house auto-delivered, no stamp button');
  await goHome(page);
  await page.getByRole('button', { name: '送貨員來了 畫線送到 1、2、3 號屋，再到終點。' }).click();
  await page.getByRole('button', { name: '開始送貨' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog')?.open);
  const deliverySecond = await deliveryFingerprint(page);
  if (!deliveryFirst || deliveryFirst === deliverySecond) {
    throw new Error('reopening delivery should shuffle the map');
  }
  log('desktop delivery: reopening shuffled the map');
  await goHome(page);

  if (errors.length) throw new Error(`activity errors: ${errors.join(' | ')}`);
  log('activities: hub, tooth, delivery ok');
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
  await runPicnicPass(page, 1);
  await page.screenshot({ path: join(outDir, 'game.png'), fullPage: true });
  const picnicFirst = await playFromFirstMap(page);
  await page.screenshot({ path: join(outDir, 'picnic-generated.png'), fullPage: true });
  log('desktop picnic: first map then 第 2 關 playable');
  await goHome(page);
  await runPicnicPass(page, 2);
  const picnicSecond = await playFromFirstMap(page);
  if (!picnicFirst || picnicFirst === picnicSecond) {
    throw new Error('reopening picnic should shuffle the first map');
  }
  log('desktop picnic: reopening shuffled the first map');
  await goHome(page);
  await runActivities(page);
  await page.getByRole('button', { name: '打敗蛀牙蟲 走到終點，途中避開蛀牙蟲。' }).click();
  await page.click('#startBtn');
  await waitPlayable(page);
  await playFromFirstMap(page);
  await page.screenshot({ path: join(outDir, 'tooth-generated.png'), fullPage: true });
  log('desktop tooth: first map then 第 2 關 playable');
  await goHome(page);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await openHub(mobile);
  const { boardBox } = await startPicnic(mobile);
  if (boardBox.width < 200) throw new Error(`mobile picnic board too small: ${JSON.stringify(boardBox)}`);
  await playFromFirstMap(mobile);
  await mobile.screenshot({ path: join(outDir, 'picnic-generated-mobile.png'), fullPage: true });
  await goHome(mobile);
  await mobile.getByRole('button', { name: '打敗蛀牙蟲' }).click();
  await mobile.waitForSelector('#startBtn');
  await mobile.click('#startBtn');
  await mobile.waitForFunction(() => !document.querySelector('dialog')?.open);
  await goHome(mobile);
  await mobile.getByRole('button', { name: '送貨員來了' }).click();
  await mobile.getByRole('button', { name: '開始送貨' }).click();
  await mobile.waitForFunction(() => !document.querySelector('dialog')?.open);
  await mobile.close();
  log('mobile 390x844: hub, picnic, tooth, delivery ok');

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
