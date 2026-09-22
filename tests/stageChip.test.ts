// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App, type Component } from 'vue';
import SequencePlay from '../src/components/SequencePlay.vue';
import StickerPlay from '../src/components/StickerPlay.vue';
import { STAGE_CHIP_SENTENCE, STAGE_LABEL, sequenceLoadBand, stickerLoadBand } from '../src/game/stages';
import { SEQUENCE_STORIES, type SequenceStoryId } from '../src/sequence/stories';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

type View = {
  host: HTMLElement;
  unmount: () => void;
};

const mounted: View[] = [];

function accessibleName(el: Element): string {
  return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
}

function buttonByName(scope: ParentNode, name: string): HTMLButtonElement {
  const buttons = [...scope.querySelectorAll('button')].filter((button) => accessibleName(button) === name);
  expect(buttons, name).toHaveLength(1);
  return buttons[0] as HTMLButtonElement;
}

async function flush(): Promise<void> {
  await nextTick();
  await nextTick();
}

function mountPlay(component: Component): View {
  const host = document.createElement('div');
  document.body.append(host);
  const app: App = createApp(component);
  app.mount(host);
  const view = {
    host,
    unmount() {
      app.unmount();
      host.remove();
    },
  };
  mounted.push(view);
  return view;
}

function mainBadge(host: ParentNode): HTMLElement {
  const badges = [...host.querySelectorAll('.level-badge [data-stage-chip]')];
  expect(badges).toHaveLength(1);
  return badges[0] as HTMLElement;
}

function dialogOpen(host: ParentNode): boolean {
  return [...host.querySelectorAll('dialog')].some((dialog) => (dialog as HTMLDialogElement).open);
}

function expectSentence(host: ParentNode, sentence: string): void {
  const badge = mainBadge(host);
  const match = sentence.match(STAGE_CHIP_SENTENCE);
  expect(match, sentence).not.toBeNull();
  const label = match?.[1];
  expect(badge.textContent?.trim()).toBe(sentence);
  expect(badge.getAttribute('data-stage-chip')).toBe(sentence);
  expect(badge.getAttribute('data-stage')).toBe(label);
  expect(Object.values(STAGE_LABEL)).toContain(label);
  const guide = host.querySelector('.guide-sub');
  expect(guide?.textContent).toContain(`${sentence}。`);
  const brand = host.querySelector('.brand .stage-chip');
  expect(brand?.getAttribute('data-stage')).toBe(label);
  expect(brand?.textContent?.trim()).toBe(label);
}

async function begin(host: ParentNode): Promise<void> {
  await flush();
  buttonByName(host, '開始遊戲').click();
  await flush();
  expect(dialogOpen(host)).toBe(false);
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount();
});

describe('shared stage chip for sequence and sticker', () => {
  it('shows the level-1 sentence on the in-play badge and updates as sequence slots fill', async () => {
    const view = mountPlay(SequencePlay);
    await begin(view.host);
    expect(sequenceLoadBand(0)).toBe('easy');
    expectSentence(view.host, '第 1 關 · 簡單 · 0 / 3');
    expect(view.host.querySelector('[data-sequence-n]')?.getAttribute('data-sequence-n')).toBe('3');

    const storyId = view.host.querySelector('[data-sequence-story]')?.getAttribute('data-sequence-story');
    const story = SEQUENCE_STORIES.find((item) => item.id === storyId);
    expect(story?.steps).toHaveLength(3);

    buttonByName(view.host, story!.steps[0]!.label).click();
    await flush();
    expectSentence(view.host, '第 1 關 · 簡單 · 1 / 3');
    expect(view.host.querySelector('[data-sequence-filled]')?.getAttribute('data-sequence-filled')).toBe('1');
    expect(dialogOpen(view.host)).toBe(false);

    buttonByName(view.host, story!.steps[1]!.label).click();
    await flush();
    expectSentence(view.host, '第 1 關 · 簡單 · 2 / 3');

    buttonByName(view.host, story!.steps[2]!.label).click();
    await flush();
    expectSentence(view.host, '第 1 關 · 簡單 · 3 / 3');
    expect(dialogOpen(view.host)).toBe(true);

    buttonByName(view.host, '下一關').click();
    await flush();
    expect(sequenceLoadBand(1)).toBe('basic');
    expectSentence(view.host, '第 2 關 · 基礎 · 0 / 4');
    expect(view.host.querySelector('[data-sequence-n]')?.getAttribute('data-sequence-n')).toBe('4');
    expect(view.host.querySelector('[data-sequence-filled]')?.getAttribute('data-sequence-filled')).toBe('0');
    const nextId = view.host.querySelector('[data-sequence-story]')?.getAttribute('data-sequence-story') as SequenceStoryId;
    expect(SEQUENCE_STORIES.find((item) => item.id === nextId)?.steps).toHaveLength(4);
  });

  it('shows the level-1 sentence on the sticker badge and counts only matched words', async () => {
    const view = mountPlay(StickerPlay);
    await begin(view.host);
    expect(stickerLoadBand(0)).toBe('easy');
    expectSentence(view.host, '第 1 關 · 簡單 · 0 / 4');
    const slots = [...view.host.querySelectorAll('[data-word-slot]')];
    expect(slots).toHaveLength(4);
    const ids = slots.map((slot) => slot.getAttribute('data-word-slot') ?? '');
    expect(new Set(ids).size).toBe(4);

    await dropSticker(view.host, ids[0]!, ids[1]!);
    expectSentence(view.host, '第 1 關 · 簡單 · 0 / 4');

    await dropSticker(view.host, ids[0]!, ids[0]!);
    expectSentence(view.host, '第 1 關 · 簡單 · 1 / 4');

    for (const id of ids.slice(1)) await dropSticker(view.host, id, id);
    expectSentence(view.host, '第 1 關 · 簡單 · 4 / 4');
    expect(dialogOpen(view.host)).toBe(true);

    buttonByName(view.host, '下一關').click();
    await flush();
    expect(stickerLoadBand(1)).toBe('basic');
    expectSentence(view.host, '第 2 關 · 基礎 · 0 / 5');
    expect(view.host.querySelectorAll('[data-word-slot]')).toHaveLength(5);
  });

  it('keeps both activities on the same sentence contract and leaves listen alone', () => {
    const sequence = readFileSync(join(root, 'src/components/SequencePlay.vue'), 'utf8');
    const sticker = readFileSync(join(root, 'src/components/StickerPlay.vue'), 'utf8');
    const listen = readFileSync(join(root, 'src/components/ListenPlay.vue'), 'utf8');
    for (const play of [sequence, sticker]) {
      expect(play).toContain('formatStageChip');
      expect(play).toContain(':data-stage="stageLabel"');
      expect(play).toContain(':data-stage-chip="stageChip"');
      expect(play).toContain('{{ stageChip }}。{{ copy.guideSub }}');
      expect(play).not.toContain('aria-label="stageChip"');
    }
    expect(sequence).toContain('`${filled.value} / ${board.value.steps.length}`');
    expect(sticker).toContain('`${matched.value} / ${words.value.length}`');
    expect(listen).not.toContain('formatStageChip');
    expect(listen).toContain('{{ correct }} / {{ need }}');
  });
});

async function dropSticker(host: ParentNode, stickerId: string, slotId: string): Promise<void> {
  const chip = host.querySelector(`.sticker-tray [data-sticker="${stickerId}"]`);
  const slot = host.querySelector(`[data-word-slot="${slotId}"]`);
  expect(chip, stickerId).toBeInstanceOf(HTMLElement);
  expect(slot, slotId).toBeInstanceOf(HTMLElement);
  const documentWithPoint = document as Document & {
    elementFromPoint: (x: number, y: number) => Element | null;
  };
  const original = documentWithPoint.elementFromPoint.bind(document);
  documentWithPoint.elementFromPoint = () => slot;
  chip!.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX: 12,
    clientY: 12,
  }));
  window.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX: 20,
    clientY: 20,
  }));
  documentWithPoint.elementFromPoint = original;
  await flush();
}
