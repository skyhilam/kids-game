// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import SequencePlay from '../src/components/SequencePlay.vue';
import { SEQUENCE_COPY } from '../src/sequence/copy';
import { dealSequence, type SequenceStoryId } from '../src/sequence/stories';

const NARRATION = '雞媽媽先帶路，小雞跟住媽媽，去到水邊先見鴨，再見到青蛙。';

type View = {
  host: HTMLElement;
  unmount: () => void;
};

const mounted: View[] = [];

function seedFor(id: SequenceStoryId, level: number): number {
  for (let seed = 0; seed < 2000; seed += 1) {
    if (dealSequence(seed, level).id === id) return seed;
  }
  throw new Error(`no seed for ${id} at level ${level}`);
}

async function flush(): Promise<void> {
  await nextTick();
  await nextTick();
}

function mountSequence(openingSeed: number, openingLevel: number): View {
  const host = document.createElement('div');
  document.body.append(host);
  const app: App = createApp(SequencePlay, { openingSeed, openingLevel });
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

function dialogOpen(host: ParentNode): boolean {
  return [...host.querySelectorAll('dialog')].some((dialog) => (dialog as HTMLDialogElement).open);
}

function cards(host: ParentNode): string[] {
  return [...host.querySelectorAll('[data-sequence-card]')].map(
    (card) => card.getAttribute('data-sequence-card') ?? '',
  );
}

function placed(host: ParentNode): string[] {
  return [...host.querySelectorAll('[data-sequence-slot]')].map(
    (slot) => slot.getAttribute('data-sequence-placed') ?? '',
  );
}

function clickCard(host: ParentNode, sprite: string): void {
  const card = host.querySelector(`[data-sequence-card="${sprite}"]`);
  expect(card, sprite).toBeInstanceOf(HTMLButtonElement);
  (card as HTMLButtonElement).click();
}

async function begin(host: ParentNode): Promise<void> {
  await flush();
  const start = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('開始遊戲'));
  expect(start).toBeInstanceOf(HTMLButtonElement);
  (start as HTMLButtonElement).click();
  await flush();
  expect(dialogOpen(host)).toBe(false);
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount();
});

describe('farm-visit 語意 v2 play', () => {
  it('shows the duck-before-frog narration and a four-animal tray with no kid or toothbrush', async () => {
    const view = mountSequence(seedFor('farm-visit', 1), 1);
    await begin(view.host);

    expect(view.host.querySelector('[data-sequence-story]')?.getAttribute('data-sequence-story')).toBe('farm-visit');
    const narration = view.host.querySelector('[data-sequence-narration]');
    expect(narration?.textContent?.trim()).toBe(NARRATION);
    expect(narration?.textContent?.indexOf('去到水邊先見鴨')).toBeLessThan(
      narration?.textContent?.indexOf('再見到青蛙') ?? -1,
    );
    expect(narration?.closest('[data-sequence-story="farm-visit"]')).toBeTruthy();
    expect(view.host.querySelector('.sequence-tray')?.getAttribute('aria-describedby')).toBe('sequence-narration');

    expect(cards(view.host).sort()).toEqual(['chick', 'chicken', 'duck', 'frog']);
    expect(cards(view.host)).not.toContain('kid');
    expect(cards(view.host)).not.toContain('toothbrush');
    const labels = [...view.host.querySelectorAll('[data-sequence-card]')].map((card) => card.getAttribute('aria-label'));
    expect(labels).toHaveLength(4);
    expect(new Set(labels)).toEqual(new Set(['雞', '小雞', '鴨', '青蛙']));
  });

  it('clears the correct order and keeps a wrong order as a soft miss that can be retried', async () => {
    const view = mountSequence(seedFor('farm-visit', 1), 1);
    await begin(view.host);

    for (const sprite of ['frog', 'duck', 'chick', 'chicken']) clickCard(view.host, sprite);
    await flush();

    expect(dialogOpen(view.host)).toBe(false);
    expect(placed(view.host)).toEqual(['frog', 'duck', 'chick', 'chicken']);
    expect(view.host.querySelector('.guide-main')?.textContent).toBe(SEQUENCE_COPY.wrong);
    expect(view.host.querySelector('.toast')?.textContent).toBe(SEQUENCE_COPY.wrong);
    expect(view.host.querySelector('.toast')?.hasAttribute('hidden')).toBe(false);
    expect(view.host.querySelector('[data-sequence-narration]')?.textContent?.trim()).toBe(NARRATION);
    expect(cards(view.host)).toEqual([]);

    for (const slot of view.host.querySelectorAll<HTMLButtonElement>('[data-sequence-slot]')) slot.click();
    await flush();
    expect(dialogOpen(view.host)).toBe(false);
    expect(placed(view.host)).toEqual(['', '', '', '']);
    expect(view.host.querySelector('.guide-main')?.textContent).toBe(SEQUENCE_COPY.guideMain);
    expect(cards(view.host).sort()).toEqual(['chick', 'chicken', 'duck', 'frog']);

    for (const sprite of ['chicken', 'chick', 'duck', 'frog']) clickCard(view.host, sprite);
    await flush();
    expect(placed(view.host)).toEqual(['chicken', 'chick', 'duck', 'frog']);
    expect(dialogOpen(view.host)).toBe(true);
    expect(view.host.querySelector('#sequence-dialog-title')?.textContent).toBe('次序啱喇！');
  });

  it('still clears farm-barn and farm-pond without the farm-visit narration', async () => {
    const barn = mountSequence(seedFor('farm-barn', 1), 1);
    await begin(barn.host);
    expect(barn.host.querySelector('[data-sequence-story]')?.getAttribute('data-sequence-story')).toBe('farm-barn');
    expect(barn.host.querySelector('[data-sequence-narration]')).toBeNull();
    expect(cards(barn.host).sort()).toEqual(['cow', 'dog', 'pig', 'sheep']);
    expect(cards(barn.host)).not.toContain('kid');
    expect(cards(barn.host)).not.toContain('toothbrush');
    for (const sprite of ['dog', 'sheep', 'pig', 'cow']) clickCard(barn.host, sprite);
    await flush();
    expect(dialogOpen(barn.host)).toBe(true);
    expect(barn.host.querySelector('#sequence-dialog-title')?.textContent).toBe('次序啱喇！');

    const pond = mountSequence(seedFor('farm-pond', 0), 0);
    await begin(pond.host);
    expect(pond.host.querySelector('[data-sequence-story]')?.getAttribute('data-sequence-story')).toBe('farm-pond');
    expect(pond.host.querySelector('[data-sequence-narration]')).toBeNull();
    expect(cards(pond.host).sort()).toEqual(['duck', 'frog', 'tortoise']);
    for (const sprite of ['duck', 'frog', 'tortoise']) clickCard(pond.host, sprite);
    await flush();
    expect(placed(pond.host)).toEqual(['duck', 'frog', 'tortoise']);
    expect(dialogOpen(pond.host)).toBe(true);
  });
});
