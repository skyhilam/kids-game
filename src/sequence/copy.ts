import { parentCopy, type LoadBand } from '../game/stages';

function parentLine(band: LoadBand): string {
  const { goal, ask, show } = parentCopy.sequence[band];
  return `目標：${goal}提問：${ask}示範：${show}`;
}

export const SEQUENCE_COPY = {
  title: '出遊順序卡',
  subtitle: '依序點選步驟，排出正確出遊次序。',
  mission: '依序點選步驟，排出正確出遊次序。',
  guideMain: '依序點選步驟，放入上面嘅槽。',
  guideSub: '槽滿先睇次序；未啱可以點卡改。',
  wrong: '次序未啱，可以點卡改一改。',
  welcomeEyebrow: '出 遊 順 序',
  welcomeBody: '依序點選步驟，排出正確出遊次序。過關之後可以玩下一關。',
  start: '開始遊戲',
  winEyebrow: '任 務 完 成',
  winTitle: '次序啱喇！',
  winBody: '呢關已經排啱晒。可以玩下一關，會再抽一組出遊次序。',
  next: '下一關',
  replay: '再玩本關',
  home: '回 Hub',
  helpTitle: '遊戲說明',
  task: '出遊順序練習。依序點選步驟，排出正確出遊次序。',
  controls: '下邊托盤點一張，就放入最左邊空槽。點槽入面嘅卡可以放返托盤。槽滿先判定；次序未啱可以改，冇鎖、冇扣分。',
  slotsLabel: '出遊次序槽',
  trayLabel: '步驟托盤',
  parent: {
    easy: parentLine('easy'),
    basic: parentLine('basic'),
    puzzle: parentLine('puzzle'),
  },
  footer: ['從容遊玩', '不計時 · 不扣分', '點選排序'] as const,
} as const;
