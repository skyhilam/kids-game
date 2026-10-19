import { parentCopy, type LoadBand } from '../game/stages';

function parentLine(band: LoadBand): string {
  const { goal, ask, show } = parentCopy.sticker[band];
  return `目標：${goal}提問：${ask}示範：${show}`;
}

export const STICKER_COPY = {
  title: '貼紙學單字',
  subtitle: '拖貼紙配英文詞，全部放對就過關',
  mission: '拖貼紙配英文詞',
  guideMain: '把貼紙拖到對應的英文詞。',
  guideSub: '撳貼紙可以聽英文。放對會貼上並讀出英文；放錯沒有鎖，可以再拖。',
  onboard: '先撳貼紙聽，再拉過去',
  onboardSkip: '知道了',
  tapHint: '撳貼紙可以聽英文',
  wrong: '再試一次，慢慢配。',
  blocked: '呢格已經有貼紙，試另一格啦。',
  welcomeEyebrow: '圖 對 英 文 詞',
  welcomeBody: '拖貼紙配英文詞，全部放對就過關。過關之後可以玩下一關。',
  start: '開始遊戲',
  winEyebrow: '任 務 完 成',
  winTitle: '全部放對了！',
  winBody: '圖都配好英文詞喇。可以玩下一關，會再抽一組圖詞。',
  next: '下一關',
  replay: '再玩本關',
  home: '回 Hub',
  helpTitle: '遊戲說明',
  task: '圖詞配對練習。把貼紙拖到對應的英文詞，全部放對就過關。',
  controls: '撳貼紙可以聽英文。從托盤拖貼紙到英文詞格子。放對會貼上並讀出英文；放錯沒有鎖、沒有扣分，可以再拖。',
  parent: {
    easy: parentLine('easy'),
    basic: parentLine('basic'),
    puzzle: parentLine('puzzle'),
  },
  trayLabel: '貼紙托盤',
  slotsLabel: '英文詞格子',
  footer: ['從容遊玩', '不計時 · 不扣分', '圖詞配對'] as const,
  calloutIntro: '聽個字，拖啱嗰張圖去發光嗰格',
  freeIntro: '全部字格都開。撳字槽或者撳貼紙都會讀出個字，再拖圖去對嘅字。',
  calloutWrong: '未貼中呀，再聽清楚個字，慢慢再試。',
  replayLabel: '再聽一次',
  modeCallout: '聽召',
  modeFree: '自由配',
  modeLabel: '玩法',
  recap: '一齊讀一次',
  noAudioHint: '而家讀唔到聲。睇大字同口型提示，呢關一樣可以完成。',
} as const;
