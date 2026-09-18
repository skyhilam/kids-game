import { parentCopy, type LoadBand } from '../game/stages';

function parentLine(band: LoadBand): string {
  const { goal, ask, show } = parentCopy.listen[band];
  return `目標：${goal}提問：${ask}示範：${show}`;
}

export const LISTEN_COPY = {
  title: '聽一聽揀圖',
  subtitle: '聽到詞之後，點啱嘅圖。',
  mission: '聽詞揀圖',
  guideMain: '聽完詞，點啱嗰張圖。',
  guideSub: '點錯冇鎖，可以再聽、再揀。',
  wrong: '再試一次，慢慢聽。',
  welcomeEyebrow: '聽 詞 揀 圖',
  welcomeBody: '聽到粵語詞之後，點啱嗰張圖。過關之後可以玩下一關。',
  start: '開始遊戲',
  winEyebrow: '任 務 完 成',
  winTitle: '聽啱喇！',
  winBody: '呢關已經聽啱晒。可以玩下一關，會再抽一組詞。',
  next: '下一關',
  replay: '再玩本關',
  home: '回 Hub',
  helpTitle: '遊戲說明',
  task: '聽詞揀圖練習。聽完粵語詞，喺圖入面點啱嗰張。',
  controls: '撳「再聽一次」可以再聽目標詞。點錯冇鎖、冇扣分，可以再揀。靜音時唔會讀詞。',
  listenAgain: '再聽一次',
  muted: '而家靜音緊。開返聲，再撳「再聽一次」。',
  correct: '對喇！',
  optionsLabel: '候選圖',
  parent: {
    easy: parentLine('easy'),
    basic: parentLine('basic'),
    puzzle: parentLine('puzzle'),
  },
  footer: ['從容遊玩', '不計時 · 不扣分', '聽詞揀圖'] as const,
} as const;
