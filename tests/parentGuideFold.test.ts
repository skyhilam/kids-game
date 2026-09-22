// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, reactive, type App } from 'vue';
import ListenPlay from '../src/components/ListenPlay.vue';
import ParentGuide from '../src/components/ParentGuide.vue';
import StickerPlay from '../src/components/StickerPlay.vue';
import {
  PARENT_GUIDE_HIDE_LABEL,
  PARENT_GUIDE_SHOW_LABEL,
  resetParentGuideFold,
  useParentGuideFold,
} from '../src/composables/useParentGuideFold';
import { parentCopy } from '../src/game/stages';

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

function openDialog(scope: ParentNode): HTMLDialogElement {
  const dialogs = [...scope.querySelectorAll('dialog')].filter((dialog) => (dialog as HTMLDialogElement).open);
  expect(dialogs, 'open dialog').toHaveLength(1);
  return dialogs[0] as HTMLDialogElement;
}

async function flush(): Promise<void> {
  await nextTick();
  await nextTick();
}

function mountGuide(props: {
  guide: { goal: string; ask: string; show: string };
  stageLabel?: string;
  collapsible?: boolean;
}): View & { state: { guide: { goal: string; ask: string; show: string }; stageLabel?: string; collapsible?: boolean } } {
  const state = reactive({ ...props });
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    setup() {
      return () => h(ParentGuide, {
        guide: state.guide,
        stageLabel: state.stageLabel,
        collapsible: state.collapsible,
      });
    },
  });
  app.mount(host);
  const view = {
    host,
    state,
    unmount() {
      app.unmount();
      host.remove();
    },
  };
  mounted.push(view);
  return view;
}

function mountPlay(component: typeof StickerPlay | typeof ListenPlay): View {
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

function guideColumns(scope: ParentNode): HTMLElement {
  const columns = scope.querySelector('.parent-guide .parent-cols');
  expect(columns, 'parent guide columns').toBeInstanceOf(HTMLElement);
  return columns as HTMLElement;
}

function sliceBetween(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  expect(start, startNeedle).toBeGreaterThan(-1);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(end, endNeedle).toBeGreaterThan(start);
  return source.slice(start, end);
}

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = readFileSync(join(root, 'src/assets/styles.css'), 'utf8');
  document.head.append(style);
});

beforeEach(() => {
  resetParentGuideFold();
});

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount();
  resetParentGuideFold();
});

describe('shared parent-guide fold', () => {
  it('starts shown and hides or shows the three columns with the locked labels', async () => {
    const writes: string[] = [];
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemSpy(key: string, value: string) {
      writes.push(String(key));
      return originalSet.call(this, key, value);
    };
    try {
      const view = mountGuide({
        guide: parentCopy.sticker.easy,
        stageLabel: '簡單',
        collapsible: true,
      });
      await flush();
      const toggle = buttonByName(view.host, PARENT_GUIDE_HIDE_LABEL);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(guideColumns(view.host).style.display).not.toBe('none');
      expect(guideColumns(view.host).textContent).toContain(parentCopy.sticker.easy.goal);
      expect(guideColumns(view.host).textContent).toContain(parentCopy.sticker.easy.ask);
      expect(guideColumns(view.host).textContent).toContain(parentCopy.sticker.easy.show);
      expect(view.host.textContent).toContain('目標');
      expect(view.host.textContent).toContain('提問');
      expect(view.host.textContent).toContain('示範');

      toggle.click();
      await flush();
      expect(buttonByName(view.host, PARENT_GUIDE_SHOW_LABEL).getAttribute('aria-expanded')).toBe('false');
      expect(guideColumns(view.host).style.display).toBe('none');
      expect(writes.filter((key) => /parent|guide|給家長/i.test(key))).toEqual([]);

      buttonByName(view.host, PARENT_GUIDE_SHOW_LABEL).click();
      await flush();
      expect(guideColumns(view.host).style.display).not.toBe('none');
      expect(guideColumns(view.host).textContent).toContain(parentCopy.sticker.easy.goal);
    } finally {
      Storage.prototype.setItem = originalSet;
    }
  });

  it('remembers hide across a sticker to listen remount and shows the current band', async () => {
    const sticker = mountGuide({
      guide: parentCopy.sticker.basic,
      stageLabel: '基礎',
      collapsible: true,
    });
    await flush();
    buttonByName(sticker.host, PARENT_GUIDE_HIDE_LABEL).click();
    await flush();
    sticker.unmount();

    const listen = mountGuide({
      guide: parentCopy.listen.puzzle,
      stageLabel: '益智',
      collapsible: true,
    });
    await flush();
    expect(buttonByName(listen.host, PARENT_GUIDE_SHOW_LABEL).getAttribute('aria-expanded')).toBe('false');
    expect(guideColumns(listen.host).style.display).toBe('none');
    expect(listen.host.querySelector('.parent-guide h3')?.textContent).toContain('益智');

    listen.state.guide = parentCopy.listen.easy;
    listen.state.stageLabel = '簡單';
    await flush();
    buttonByName(listen.host, PARENT_GUIDE_SHOW_LABEL).click();
    await flush();
    const columns = guideColumns(listen.host);
    expect(columns.style.display).not.toBe('none');
    expect(columns.textContent).toContain(parentCopy.listen.easy.goal);
    expect(columns.textContent).toContain(parentCopy.listen.easy.ask);
    expect(columns.textContent).toContain(parentCopy.listen.easy.show);
    expect(columns.textContent).not.toContain(parentCopy.sticker.basic.goal);
    expect(listen.host.querySelector('.parent-guide h3')?.textContent).toContain('簡單');
  });

  it('leaves non-collapsible guides open when sticker and listen are folded', async () => {
    const { expanded, toggle } = useParentGuideFold();
    toggle();
    expect(expanded.value).toBe(false);
    const picnic = mountGuide({
      guide: parentCopy.picnic.easy,
      stageLabel: '簡單',
    });
    await flush();
    expect(picnic.host.querySelector('.parent-guide-toggle')).toBeNull();
    expect(picnic.host.querySelector('.parent-guide')?.classList.contains('is-collapsible')).toBe(false);
    expect(guideColumns(picnic.host).style.display).not.toBe('none');
    expect(guideColumns(picnic.host).textContent).toContain(parentCopy.picnic.easy.goal);
  });

  it('resets to shown without localStorage, matching a reload', () => {
    const fold = readFileSync(join(root, 'src/composables/useParentGuideFold.ts'), 'utf8');
    const guide = readFileSync(join(root, 'src/components/ParentGuide.vue'), 'utf8');
    expect(fold).toContain('const expanded = ref(true)');
    expect(fold).not.toMatch(/\blocalStorage\s*[.\[]|\bsessionStorage\s*[.\[]/);
    expect(fold).toContain(`export const PARENT_GUIDE_HIDE_LABEL = '${PARENT_GUIDE_HIDE_LABEL}'`);
    expect(fold).toContain(`export const PARENT_GUIDE_SHOW_LABEL = '${PARENT_GUIDE_SHOW_LABEL}'`);
    expect(guide).toContain('PARENT_GUIDE_HIDE_LABEL');
    expect(guide).toContain('PARENT_GUIDE_SHOW_LABEL');
    expect(guide).toContain('aria-expanded');
    expect(guide).not.toContain('aria-pressed');
    expect(guide).not.toMatch(/localStorage|sessionStorage/);

    const { expanded, toggle } = useParentGuideFold();
    toggle();
    expect(expanded.value).toBe(false);
    resetParentGuideFold();
    expect(expanded.value).toBe(true);
  });
});

describe('sticker and listen help dialogs', () => {
  async function openHelp(view: View): Promise<HTMLDialogElement> {
    await flush();
    const welcome = openDialog(view.host);
    buttonByName(welcome, '開始遊戲').click();
    await flush();
    expect(view.host.querySelector('dialog')?.open).toBe(false);
    const helpButton = buttonByName(view.host, '遊戲說明');
    expect(helpButton.disabled).toBe(false);
    helpButton.click();
    await flush();
    return openDialog(view.host);
  }

  it('opens the shared toggle inside sticker help, then keeps it inside listen help', async () => {
    const sticker = mountPlay(StickerPlay);
    const stickerHelp = await openHelp(sticker);
    expect(stickerHelp.textContent).toContain(parentCopy.sticker.easy.goal);
    const hide = buttonByName(stickerHelp, PARENT_GUIDE_HIDE_LABEL);
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    expect(guideColumns(stickerHelp).textContent).toContain(parentCopy.sticker.easy.show);
    hide.click();
    await flush();
    expect(guideColumns(stickerHelp).style.display).toBe('none');
    const back = buttonByName(stickerHelp, '返回遊戲');
    expect(back.disabled).toBe(false);
    back.click();
    await flush();
    expect(sticker.host.querySelector('dialog')?.open).toBe(false);
    buttonByName(sticker.host, '遊戲說明').click();
    await flush();
    const reopened = openDialog(sticker.host);
    expect(buttonByName(reopened, PARENT_GUIDE_SHOW_LABEL).getAttribute('aria-expanded')).toBe('false');
    expect(guideColumns(reopened).style.display).toBe('none');
    sticker.unmount();

    const listen = mountPlay(ListenPlay);
    const listenHelp = await openHelp(listen);
    expect(buttonByName(listenHelp, PARENT_GUIDE_SHOW_LABEL).getAttribute('aria-expanded')).toBe('false');
    expect(guideColumns(listenHelp).style.display).toBe('none');
    buttonByName(listenHelp, PARENT_GUIDE_SHOW_LABEL).click();
    await flush();
    const columns = guideColumns(listenHelp);
    expect(columns.style.display).not.toBe('none');
    expect(columns.textContent).toContain(parentCopy.listen.easy.goal);
    expect(columns.textContent).toContain(parentCopy.listen.easy.ask);
    expect(columns.textContent).toContain(parentCopy.listen.easy.show);
    expect(columns.textContent).not.toContain(parentCopy.sticker.easy.goal);
    expect(buttonByName(listenHelp, '返回遊戲').disabled).toBe(false);
  });

  it('keeps the fold control in help only, and leaves win and other modes alone', () => {
    const sticker = readFileSync(join(root, 'src/components/StickerPlay.vue'), 'utf8');
    const listen = readFileSync(join(root, 'src/components/ListenPlay.vue'), 'utf8');
    const sequence = readFileSync(join(root, 'src/components/SequencePlay.vue'), 'utf8');
    const delivery = readFileSync(join(root, 'src/components/DeliveryPlay.vue'), 'utf8');
    const overlays = readFileSync(join(root, 'src/components/MazeOverlays.vue'), 'utf8');
    const styles = readFileSync(join(root, 'src/assets/styles.css'), 'utf8');

    for (const play of [sticker, listen]) {
      const chrome = play.slice(0, play.indexOf('<MazeDialog'));
      const help = sliceBetween(play, `v-else-if="overlay === 'help'"`, `v-else-if="overlay === 'win'"`);
      const win = sliceBetween(play, `v-else-if="overlay === 'win'"`, '</MazeDialog>');
      expect(chrome).toContain('aria-label="遊戲說明"');
      expect(chrome).toContain('@click="showHelp"');
      expect(chrome).not.toContain(PARENT_GUIDE_HIDE_LABEL);
      expect(help).toContain('<ParentGuide collapsible');
      expect(help).toContain('返回遊戲');
      expect(win).not.toContain('ParentGuide');
      expect(win).not.toContain('collapsible');
      expect(win).toContain('下一關');
      expect(win).toContain('copy.replay');
    }

    expect(sequence).toContain('<ParentGuide');
    expect(sequence).not.toContain('collapsible');
    expect(delivery).toContain('<ParentGuide');
    expect(delivery).not.toContain('collapsible');
    expect(overlays).toContain('<ParentGuideBlock');
    expect(overlays).not.toContain('collapsible');
    expect(styles).toContain('.parent-guide-toggle{');
    expect(styles).toMatch(/\.parent-guide-toggle\{[^}]*min-height:44px/);
    expect(styles).toContain('@media(max-width:420px){');
    expect(styles).toContain('.parent-guide.is-collapsible .parent-guide-head{flex-direction:column;align-items:stretch}.parent-guide-toggle{width:100%}');
    expect(styles).toContain('.parent-cols{grid-template-columns:1fr}');
  });

  it('keeps the toggle tappable at a 390px viewport', async () => {
    const happy = window as Window & {
      happyDOM?: { setViewport: (viewport: { width: number; height: number }) => void };
    };
    expect(happy.happyDOM?.setViewport, 'happy-dom viewport').toBeTypeOf('function');
    happy.happyDOM?.setViewport({ width: 390, height: 844 });
    const view = mountGuide({
      guide: parentCopy.sticker.puzzle,
      stageLabel: '益智',
      collapsible: true,
    });
    await flush();
    const toggle = buttonByName(view.host, PARENT_GUIDE_HIDE_LABEL);
    const toggleStyle = getComputedStyle(toggle);
    const columnStyle = getComputedStyle(guideColumns(view.host));
    expect(window.matchMedia('(max-width: 420px)').matches).toBe(true);
    expect(window.matchMedia('(max-width: 700px)').matches).toBe(true);
    expect(toggleStyle.display).toBe('inline-flex');
    expect(toggleStyle.visibility).not.toBe('hidden');
    expect(parseFloat(toggleStyle.minHeight)).toBeGreaterThanOrEqual(44);
    expect(toggleStyle.maxWidth).toBe('100%');
    expect(columnStyle.display).not.toBe('none');
    expect(toggle.disabled).toBe(false);
  });
});
