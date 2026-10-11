// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import FormulaPlay from '../src/components/FormulaPlay.vue';
import { FORMULA_COPY, FORMULA_ZONE_COPY } from '../src/formula/copy';
import { hintFor } from '../src/formula/hints';
import {
  emptyFormulaProgress,
  FORMULA_STORAGE_KEY,
  readFormulaProgress,
  writeFormulaProgress,
  type FormulaSave,
} from '../src/formula/progress';
import { FACTOR_IDENTITIES, ZONE_CATALOG, ZONE_IDS, type FormulaQuestion, type ZoneId } from '../src/formula/types';
import {
  dealFactorRematch,
  FORMULA_ZONES,
  HINT_ZONES,
  nextZoneId,
  zoneDef,
  zoneHasHints,
} from '../src/formula/zones';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 11;

type View = { host: HTMLElement; unmount: () => void; homes: () => number };
const mounted: View[] = [];

function accessibleName(el: Element): string {
  return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
}

function buttonsByName(scope: ParentNode, name: string): HTMLButtonElement[] {
  return [...scope.querySelectorAll('button')].filter((button) => accessibleName(button) === name) as HTMLButtonElement[];
}

function buttonByName(scope: ParentNode, name: string): HTMLButtonElement {
  const buttons = buttonsByName(scope, name);
  expect(buttons, name).toHaveLength(1);
  return buttons[0]!;
}

function openDialog(scope: ParentNode): HTMLDialogElement {
  const dialogs = [...scope.querySelectorAll('dialog')].filter((dialog) => (dialog as HTMLDialogElement).open);
  expect(dialogs, 'open dialog').toHaveLength(1);
  return dialogs[0] as HTMLDialogElement;
}

function dialogOpen(scope: ParentNode): boolean {
  return [...scope.querySelectorAll('dialog')].some((dialog) => (dialog as HTMLDialogElement).open);
}

function overlayName(scope: ParentNode): string {
  return scope.querySelector('[data-formula-overlay]')?.getAttribute('data-formula-overlay') ?? '';
}

function mainEl(scope: ParentNode): HTMLElement {
  const main = scope.querySelector('main.formula-game');
  expect(main).toBeInstanceOf(HTMLElement);
  return main as HTMLElement;
}

function screenOf(scope: ParentNode): string {
  return mainEl(scope).getAttribute('data-formula-screen') ?? '';
}

async function flush(): Promise<void> {
  await nextTick();
  await nextTick();
}

function mountPlay(): View {
  const host = document.createElement('div');
  document.body.append(host);
  let homes = 0;
  const app: App = createApp({
    render: () => h(FormulaPlay, { openingSeed: SEED, onHome: () => { homes += 1; } }),
  });
  app.mount(host);
  const view: View = {
    host,
    homes: () => homes,
    unmount() {
      app.unmount();
      host.remove();
    },
  };
  mounted.push(view);
  return view;
}

async function mountAndBegin(): Promise<View> {
  const view = mountPlay();
  await flush();
  expect(overlayName(view.host)).toBe('welcome');
  buttonByName(openDialog(view.host), FORMULA_COPY.start).click();
  await flush();
  expect(dialogOpen(view.host)).toBe(false);
  expect(screenOf(view.host)).toBe('map');
  return view;
}

/** Every question the component can show at SEED, by id. */
const BANK = new Map<string, FormulaQuestion>();
for (const zone of FORMULA_ZONES) {
  for (const section of zone.sections) {
    for (const question of section.deal(SEED)) BANK.set(question.id, question);
  }
}
for (const question of dealFactorRematch(SEED, FACTOR_IDENTITIES.map((item) => item.id))) {
  BANK.set(question.id, question);
}

function currentQuestion(scope: ParentNode): FormulaQuestion {
  const id = scope.querySelector('[data-formula-question]')?.getAttribute('data-formula-question') ?? '';
  const known = BANK.get(id);
  if (known) return known;
  // Wrong-book retry replays saved items, which may come from another deal.
  const saved = readFormulaProgress().wrongBook.find((item) => item.id === id);
  expect(saved, `question ${id}`).toBeTruthy();
  return saved!.mode === 'pick'
    ? { id: saved!.id, zone: saved!.zone, mode: 'pick', prompt: saved!.prompt, choices: saved!.choices, answer: saved!.answer }
    : { id: saved!.id, zone: saved!.zone, mode: 'fill', prompt: saved!.prompt, answer: saved!.answer };
}

async function answer(scope: ParentNode, correct: boolean): Promise<FormulaQuestion> {
  const question = currentQuestion(scope);
  if (question.mode === 'pick') {
    const value = correct ? question.answer : question.choices.find((choice) => choice !== question.answer)!;
    const button = scope.querySelector(`[data-formula-choice="${value}"]`) as HTMLButtonElement | null;
    expect(button, `choice ${value}`).toBeTruthy();
    button!.click();
  } else {
    const input = scope.querySelector('[data-formula-fill]') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = correct ? question.answer : `${question.answer}7`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    input.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }
  await flush();
  const feedback = scope.querySelector('[data-formula-feedback]');
  expect(feedback?.getAttribute('data-formula-feedback')).toBe(correct ? 'correct' : 'wrong');
  (scope.querySelector('[data-formula-next]') as HTMLButtonElement).click();
  await flush();
  return question;
}

async function skipTutorial(scope: ParentNode): Promise<string[]> {
  const bodies: string[] = [];
  for (let guard = 0; guard < 8; guard += 1) {
    if (overlayName(scope) !== 'tutorial') break;
    const dialog = openDialog(scope);
    bodies.push(dialog.querySelector('[data-formula-tutorial-body]')?.textContent?.trim() ?? '');
    (dialog.querySelector('[data-formula-tutorial-next]') as HTMLButtonElement).click();
    await flush();
  }
  expect(overlayName(scope)).not.toBe('tutorial');
  return bodies;
}

async function enterZone(scope: ParentNode, zone: ZoneId): Promise<void> {
  const card = scope.querySelector(`[data-formula-zone="${zone}"]`) as HTMLButtonElement;
  expect(card, `zone card ${zone}`).toBeTruthy();
  expect(card.disabled).toBe(false);
  card.click();
  await flush();
  expect(screenOf(scope)).toBe('round');
  expect(overlayName(scope)).toBe('tutorial');
}

function stampedThrough(zone: number): FormulaSave {
  const save = emptyFormulaProgress();
  for (const id of ZONE_IDS) {
    if (id > zone) break;
    save.zones[id] = { zone: id, bestStars: 3, stamped: true, attempts: 1, correct: 5, total: 5 };
  }
  return save;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount();
  window.localStorage.clear();
});

describe('zone registry', () => {
  it('registers the 8 zones in unlock order with the catalog keys and titles', () => {
    expect(FORMULA_ZONES.map((zone) => zone.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(FORMULA_ZONES.map((zone) => zone.key)).toEqual(ZONE_CATALOG.map((zone) => zone.key));
    expect(FORMULA_ZONES.map((zone) => zone.title)).toEqual([
      'Directions', 'Units', 'Area+Perimeter', 'Percentage', 'Pythagoras', 'Factorization', 'Volume+Euler', 'Interest',
    ]);
    expect(nextZoneId(1)).toBe(2);
    expect(nextZoneId(7)).toBe(8);
    expect(nextZoneId(8)).toBeNull();
    for (const id of ZONE_IDS) {
      expect(zoneDef(id).id).toBe(id);
      expect(FORMULA_ZONE_COPY[id].title).toBeTruthy();
      expect(FORMULA_ZONE_COPY[id].rule).toBeTruthy();
    }
    expect(FORMULA_COPY.title).toBe('公式島');
    expect(FORMULA_COPY.titleEn).toBe('Formula Island');
  });

  it('splits zone 7 into volume then Euler, each with its own tutorial and deal', () => {
    for (const zone of FORMULA_ZONES) {
      if (zone.id === 7) {
        expect(zone.sections.map((section) => section.key)).toEqual(['volume', 'euler']);
        expect(zone.sections[0]!.deal(SEED).every((question) => question.tag === 'volume')).toBe(true);
        expect(zone.sections[1]!.deal(SEED).every((question) => question.tag === 'euler')).toBe(true);
        expect(zone.sections[0]!.tutorial[0]!.title).toBe('Cube and box');
        expect(zone.sections[1]!.tutorial[0]!.title).toBe('Vertices, edges, and faces');
      } else {
        expect(zone.sections.map((section) => section.key)).toEqual(['main']);
      }
      for (const section of zone.sections) {
        expect(section.tutorial.length).toBeGreaterThan(0);
        const questions = section.deal(SEED);
        expect(questions.length).toBeGreaterThan(0);
        expect(questions.every((question) => question.zone === zone.id)).toBe(true);
      }
    }
    const rematch = dealFactorRematch(SEED, ['diff-cubes', 'sum-square']);
    expect(rematch.map((question) => question.tag)).toEqual(['diff-cubes', 'sum-square']);
    expect(rematch.every((question) => question.zone === 6)).toBe(true);
  });

  it('gates hint cards to zones 6–8 and keeps the answer off the card', () => {
    expect(HINT_ZONES).toEqual([6, 7, 8]);
    for (const id of ZONE_IDS) {
      expect(zoneHasHints(id)).toBe(id >= 6);
      expect(zoneDef(id).hints).toBe(id >= 6);
    }
    for (const zone of FORMULA_ZONES) {
      for (const seed of [SEED, 3, 999]) {
        for (const question of zone.sections.flatMap((section) => section.deal(seed))) {
          if (!zone.hints) {
            expect(() => hintFor(question)).toThrow();
            continue;
          }
          const card = hintFor(question);
          expect(card.zone).toBe(zone.id);
          expect(card.formula).toContain('=');
          expect(`${card.title}\n${card.formula}`).not.toContain(question.answer);
        }
      }
    }
  });
});

describe('FormulaPlay source contract', () => {
  const play = readFileSync(join(root, 'src/components/FormulaPlay.vue'), 'utf8');

  it('emits home and reuses the shared dialog, chrome, and audio pieces without Phaser', () => {
    expect(play).toContain("defineEmits<{ home: [] }>()");
    expect(play).toContain("import MazeDialog from './MazeDialog.vue'");
    expect(play).toContain("import PlayChrome from './PlayChrome.vue'");
    expect(play).toContain("import { usePlayAudio } from '../composables/usePlayAudio'");
    expect(play).toContain('<header class="topbar">');
    expect(play).toContain('class="board formula-board"');
    expect(play).toContain('class="dialog-inner"');
    expect(play).not.toMatch(/phaser/i);
    for (const file of ['src/components/formula/FormulaScene.vue', 'src/components/formula/FormulaWorldMap.vue', 'src/components/formula/FormulaSummary.vue']) {
      expect(readFileSync(join(root, file), 'utf8')).not.toMatch(/phaser/i);
    }
  });

  it('namespaces its styles under .formula-game and leaves styles.css alone', () => {
    const style = play.slice(play.indexOf('<style>') + 7, play.indexOf('</style>'));
    const rules = style
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@media[^{]*\{/g, '')
      .split('}')
      .map((chunk) => chunk.split('{')[0]!.trim())
      .filter((selector) => selector !== '');
    expect(rules.length).toBeGreaterThan(20);
    for (const selectorList of rules) {
      for (const selector of selectorList.split(',')) {
        expect(selector.trim(), selector).toMatch(/^\.formula-game\b/);
      }
    }
    expect(readFileSync(join(root, 'src/assets/styles.css'), 'utf8')).not.toContain('formula');
    expect(play).toContain('dialog-class="formula-dialog formula-game"');
  });

  it('keeps all copy in src/formula/copy.ts and has no timer or login', () => {
    expect(play).not.toMatch(/setInterval|countdown|login|password/i);
    expect(play).toContain("from '../formula/copy'");
    for (const file of ['FormulaWorldMap.vue', 'FormulaSummary.vue']) {
      expect(readFileSync(join(root, 'src/components/formula', file), 'utf8')).toContain("from '../../formula/copy'");
    }
  });
});

describe('FormulaPlay screens', () => {
  it('emits home from the welcome dialog, the topbar, and a tutorial dialog', async () => {
    const view = mountPlay();
    await flush();
    buttonByName(openDialog(view.host), FORMULA_COPY.home).click();
    expect(view.homes()).toBe(1);
    buttonByName(openDialog(view.host), FORMULA_COPY.start).click();
    await flush();
    (view.host.querySelector('[data-formula-home]') as HTMLButtonElement).click();
    expect(view.homes()).toBe(2);
    await enterZone(view.host, 1);
    buttonByName(openDialog(view.host), FORMULA_COPY.home).click();
    expect(view.homes()).toBe(3);
  });

  it('shows 8 zones with lock state, stamps, and stars from saved progress', async () => {
    const save = stampedThrough(2);
    save.zones[1] = { ...save.zones[1], bestStars: 2 };
    writeFormulaProgress(save);
    const view = await mountAndBegin();
    const cards = [...view.host.querySelectorAll('[data-formula-zone]')] as HTMLButtonElement[];
    expect(cards.map((card) => card.getAttribute('data-formula-zone'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(cards.map((card) => card.disabled)).toEqual([false, false, false, true, true, true, true, true]);
    expect(cards.map((card) => card.getAttribute('data-formula-stamped'))).toEqual([
      'true', 'true', 'false', 'false', 'false', 'false', 'false', 'false',
    ]);
    expect(cards[0]!.getAttribute('data-formula-stars')).toBe('2');
    expect(cards[0]!.querySelectorAll('.formula-stars i.lit')).toHaveLength(2);
    expect(cards[1]!.querySelectorAll('.formula-stars i.lit')).toHaveLength(3);
    expect(cards[3]!.textContent).toContain(FORMULA_COPY.map.locked);
    cards[3]!.click();
    await flush();
    expect(screenOf(view.host)).toBe('map');
    expect(dialogOpen(view.host)).toBe(false);
  });

  it('runs zone 1 tutorial → scene → pick → feedback → stamp and stars, then unlocks zone 2 across a reload', async () => {
    const view = await mountAndBegin();
    await enterZone(view.host, 1);
    const bodies = await skipTutorial(view.host);
    expect(bodies).toEqual(zoneDef(1).sections[0]!.tutorial.map((step) => step.body));
    expect(view.host.querySelector('[data-formula-scene="1"]')).toBeTruthy();
    expect(view.host.querySelector('[data-formula-hint]')).toBeNull();

    for (let i = 0; i < 5; i += 1) {
      expect(dialogOpen(view.host)).toBe(false);
      const question = await answer(view.host, true);
      expect(question.zone).toBe(1);
    }
    expect(overlayName(view.host)).toBe('result');
    const dialog = openDialog(view.host);
    expect(dialog.querySelector('[data-formula-result]')?.getAttribute('data-formula-result')).toBe('passed');
    expect(dialog.querySelector('[data-formula-result-stars]')?.getAttribute('data-formula-result-stars')).toBe('3');
    expect(dialog.querySelector('[data-formula-result-stamp]')).toBeTruthy();
    expect(dialog.textContent).toContain(FORMULA_COPY.result.unlocked(FORMULA_ZONE_COPY[2].title));

    const saved = readFormulaProgress();
    expect(saved.zones[1]).toMatchObject({ stamped: true, bestStars: 3, attempts: 1, correct: 5, total: 5 });
    expect(saved.zones[2].stamped).toBe(false);
    expect(window.localStorage.getItem(FORMULA_STORAGE_KEY)).toContain('"stamped":true');

    (dialog.querySelector('[data-formula-next-zone]') as HTMLButtonElement).click();
    await flush();
    expect(mainEl(view.host).getAttribute('data-formula-zone-active')).toBe('2');
    expect(overlayName(view.host)).toBe('tutorial');
    view.unmount();

    const again = await mountAndBegin();
    const cards = [...again.host.querySelectorAll('[data-formula-zone]')] as HTMLButtonElement[];
    expect(cards.map((card) => card.disabled)).toEqual([false, false, true, true, true, true, true, true]);
    expect(cards[0]!.getAttribute('data-formula-stars')).toBe('3');
  });

  it('fails zone 1 after 3 wrong, leaves zone 2 locked, offers retry, and fills the wrong-book', async () => {
    const view = await mountAndBegin();
    await enterZone(view.host, 1);
    await skipTutorial(view.host);
    const missed: string[] = [];
    for (let i = 0; i < 3; i += 1) missed.push((await answer(view.host, false)).id);
    const dialog = openDialog(view.host);
    expect(dialog.querySelector('[data-formula-result]')?.getAttribute('data-formula-result')).toBe('failed');
    expect(dialog.querySelector('[data-formula-result-stamp]')).toBeNull();
    expect(dialog.querySelector('[data-formula-next-zone]')).toBeNull();
    const saved = readFormulaProgress();
    expect(saved.zones[1]).toMatchObject({ stamped: false, bestStars: 0, attempts: 1, correct: 0, total: 3 });
    expect(saved.wrongBook.map((item) => item.id)).toEqual(missed);

    (dialog.querySelector('[data-formula-retry-zone]') as HTMLButtonElement).click();
    await flush();
    expect(screenOf(view.host)).toBe('round');
    expect(dialogOpen(view.host)).toBe(false);
    expect(view.host.querySelector('[data-formula-question]')).toBeTruthy();

    (view.host.querySelector('[data-formula-back-to-map]') as HTMLButtonElement).click();
    await flush();
    expect(screenOf(view.host)).toBe('map');
    const cards = [...view.host.querySelectorAll('[data-formula-zone]')] as HTMLButtonElement[];
    expect(cards[1]!.disabled).toBe(true);
    expect(readFormulaProgress().zones[1].attempts).toBe(1);
  });

  it('shows the parent summary for all 8 zones and replays wrong answers until the book is clear', async () => {
    const view = await mountAndBegin();
    await enterZone(view.host, 1);
    await skipTutorial(view.host);
    for (let i = 0; i < 3; i += 1) await answer(view.host, false);
    buttonByName(openDialog(view.host), FORMULA_COPY.result.backToMap).click();
    await flush();
    expect(screenOf(view.host)).toBe('map');

    (view.host.querySelector('[data-formula-open-summary]') as HTMLButtonElement).click();
    await flush();
    expect(screenOf(view.host)).toBe('summary');
    const rows = [...view.host.querySelectorAll('[data-formula-summary-zone]')];
    expect(rows.map((row) => row.getAttribute('data-formula-summary-zone'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(rows[0]!.getAttribute('data-formula-accuracy')).toBe('0');
    expect(rows[0]!.textContent).toContain('0%');
    expect(rows[1]!.textContent).toContain(FORMULA_COPY.summary.locked);
    expect(view.host.querySelectorAll('[data-formula-review]')).toHaveLength(3);
    for (const item of readFormulaProgress().wrongBook) {
      expect(view.host.textContent).toContain(item.prompt);
      expect(view.host.textContent).toContain(item.answer);
    }

    const retry = view.host.querySelector('[data-formula-retry-wrongs]') as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    retry.click();
    await flush();
    expect(screenOf(view.host)).toBe('retry');
    await answer(view.host, false);
    expect(readFormulaProgress().wrongBook).toHaveLength(3);
    await answer(view.host, true);
    expect(readFormulaProgress().wrongBook).toHaveLength(2);
    await answer(view.host, true);
    expect(readFormulaProgress().wrongBook).toHaveLength(1);
    expect(overlayName(view.host)).toBe('retryDone');
    expect(openDialog(view.host).textContent).toContain(FORMULA_COPY.retry.remaining(1));
    buttonByName(openDialog(view.host), FORMULA_COPY.map.summary).click();
    await flush();
    expect(screenOf(view.host)).toBe('summary');
    expect(view.host.querySelectorAll('[data-formula-review]')).toHaveLength(1);

    (view.host.querySelector('[data-formula-retry-wrongs]') as HTMLButtonElement).click();
    await flush();
    await answer(view.host, true);
    expect(readFormulaProgress().wrongBook).toHaveLength(0);
    expect(openDialog(view.host).textContent).toContain(FORMULA_COPY.retry.done);
  });

  it('accepts typed answers in zone 3 and passes with 5 of 6', async () => {
    writeFormulaProgress(stampedThrough(2));
    const view = await mountAndBegin();
    await enterZone(view.host, 3);
    await skipTutorial(view.host);
    let fills = 0;
    for (let i = 0; i < 6; i += 1) {
      const question = await answer(view.host, i !== 2);
      if (question.mode === 'fill') fills += 1;
    }
    expect(fills).toBeGreaterThan(0);
    const dialog = openDialog(view.host);
    expect(dialog.querySelector('[data-formula-result]')?.getAttribute('data-formula-result')).toBe('passed');
    expect(dialog.querySelector('[data-formula-result-stars]')?.getAttribute('data-formula-result-stars')).toBe('2');
    expect(readFormulaProgress().zones[3]).toMatchObject({ stamped: true, bestStars: 2, correct: 5, total: 6 });
  });

  it('shows hint cards only in zones 6–8 and the card shows the formula, not the answer', async () => {
    writeFormulaProgress(stampedThrough(5));
    const view = await mountAndBegin();
    await enterZone(view.host, 5);
    await skipTutorial(view.host);
    expect(view.host.querySelector('[data-formula-hint]')).toBeNull();
    (view.host.querySelector('[data-formula-back-to-map]') as HTMLButtonElement).click();
    await flush();

    await enterZone(view.host, 6);
    await skipTutorial(view.host);
    const hintButton = view.host.querySelector('[data-formula-hint]') as HTMLButtonElement;
    expect(hintButton).toBeTruthy();
    expect(view.host.querySelector('[data-formula-hint-card]')).toBeNull();
    hintButton.click();
    await flush();
    const card = view.host.querySelector('[data-formula-hint-card]');
    expect(card).toBeTruthy();
    const question = currentQuestion(view.host);
    const expected = hintFor(question);
    expect(card!.textContent).toContain(expected.formula);
    expect(card!.textContent).toContain('=');
    expect(card!.textContent).not.toContain(question.answer);
    expect(card!.textContent).toContain(FORMULA_COPY.round.hintNote);
  });

  it('gives zone 6 one rematch per missed identity and passes with 2 stars', async () => {
    writeFormulaProgress(stampedThrough(5));
    const view = await mountAndBegin();
    await enterZone(view.host, 6);
    await skipTutorial(view.host);
    const missed = await answer(view.host, false);
    for (let i = 0; i < 4; i += 1) await answer(view.host, true);
    expect(dialogOpen(view.host)).toBe(false);
    expect(view.host.querySelector('[data-formula-rematch]')).toBeTruthy();
    const rematch = currentQuestion(view.host);
    expect(rematch.tag).toBe(missed.tag);
    await answer(view.host, true);
    const dialog = openDialog(view.host);
    expect(dialog.querySelector('[data-formula-result]')?.getAttribute('data-formula-result')).toBe('passed');
    expect(dialog.querySelector('[data-formula-result-stars]')?.getAttribute('data-formula-result-stars')).toBe('2');
    expect(readFormulaProgress().zones[6].stamped).toBe(true);
    expect(readFormulaProgress().wrongBook.map((item) => item.id)).toEqual([missed.id]);
  });

  it('runs zone 7 as the volume tutorial and round, then the Euler tutorial and round', async () => {
    writeFormulaProgress(stampedThrough(6));
    const view = await mountAndBegin();
    await enterZone(view.host, 7);
    const volumeBodies = await skipTutorial(view.host);
    expect(volumeBodies).toEqual(zoneDef(7).sections[0]!.tutorial.map((step) => step.body));
    expect(view.host.querySelector('[data-formula-section]')?.textContent).toContain(FORMULA_COPY.round.sectionVolume);
    for (let i = 0; i < 4; i += 1) {
      const question = await answer(view.host, i !== 1);
      expect(question.tag).toBe('volume');
    }
    expect(overlayName(view.host)).toBe('tutorial');
    const eulerBodies = await skipTutorial(view.host);
    expect(eulerBodies).toEqual(zoneDef(7).sections[1]!.tutorial.map((step) => step.body));
    expect(view.host.querySelector('[data-formula-section]')?.textContent).toContain(FORMULA_COPY.round.sectionEuler);
    for (let i = 0; i < 2; i += 1) {
      const question = await answer(view.host, true);
      expect(question.tag).toBe('euler');
    }
    const dialog = openDialog(view.host);
    expect(dialog.querySelector('[data-formula-result]')?.getAttribute('data-formula-result')).toBe('passed');
    expect(dialog.querySelector('[data-formula-result-stars]')?.getAttribute('data-formula-result-stars')).toBe('2');
    expect(readFormulaProgress().zones[7]).toMatchObject({ stamped: true, correct: 5, total: 6 });
    expect(readFormulaProgress().zones[8].stamped).toBe(false);
    expect(dialog.querySelector('[data-formula-next-zone]')).toBeTruthy();
  });

  it('finishes zone 8 and reports every zone stamped', async () => {
    writeFormulaProgress(stampedThrough(7));
    const view = await mountAndBegin();
    await enterZone(view.host, 8);
    await skipTutorial(view.host);
    expect(view.host.querySelector('[data-formula-hint]')).toBeTruthy();
    for (let i = 0; i < 6; i += 1) {
      const question = await answer(view.host, true);
      expect(['simple', 'compound']).toContain(question.tag);
    }
    const dialog = openDialog(view.host);
    expect(dialog.textContent).toContain(FORMULA_COPY.result.finished);
    expect(dialog.querySelector('[data-formula-next-zone]')).toBeNull();
    (dialog.querySelector('[data-formula-result-map]') as HTMLButtonElement).click();
    await flush();
    expect(view.host.querySelector('.formula-map')?.getAttribute('data-formula-all-stamped')).toBe('true');
    expect(view.host.textContent).toContain(FORMULA_COPY.map.allClear);
  });

  it('opens help from the map and returns to the game', async () => {
    const view = await mountAndBegin();
    buttonByName(mainEl(view.host), '遊戲說明').click();
    await flush();
    expect(overlayName(view.host)).toBe('help');
    const help = openDialog(view.host);
    expect(help.textContent).toContain(FORMULA_COPY.help.task);
    buttonByName(help, FORMULA_COPY.help.back).click();
    await flush();
    expect(dialogOpen(view.host)).toBe(false);
  });
});
