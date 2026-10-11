import type { ZoneId } from './types';

/** All Formula Island UI copy. Question text itself lives in src/formula/zones. */

export type ZoneCopy = {
  /** Island name shown on the map and in the topbar. */
  title: string;
  /** English topic name, shown under the title. */
  en: string;
  /** One line on the map card and the scene. */
  blurb: string;
  /** Pass rule in words, shown before the round starts. */
  rule: string;
};

export const FORMULA_ZONE_COPY: Record<ZoneId, ZoneCopy> = {
  1: {
    title: '方向島',
    en: 'Directions',
    blurb: '八個方位，睇指南針搵路。',
    rule: '答對 5 題就過關，最多錯 1 題；錯 3 題要重來。',
  },
  2: {
    title: '錢幣島',
    en: 'Units',
    blurb: '$1 = 100 cents，數清楚幾多仙。',
    rule: '8 題答對 6 題就過關。',
  },
  3: {
    title: '面積島',
    en: 'Area + Perimeter',
    blurb: '裏面係面積，圍邊係周界。',
    rule: '6 題答對 5 題就過關。',
  },
  4: {
    title: '百分島',
    en: 'Percentage',
    blurb: '每一百份裏面有幾多份。',
    rule: '5 題答對 4 題就過關。',
  },
  5: {
    title: '畢氏島',
    en: 'Pythagoras',
    blurb: '直角三角形，兩條短邊平方加埋等於長邊平方。',
    rule: '答對 4 題就過關，最多錯 1 題。',
  },
  6: {
    title: '因式島',
    en: 'Factorization',
    blurb: '五條恆等式，一條都唔漏。',
    rule: '五條恆等式各答一題，錯嘅可以補答一次；補答再錯要重來。',
  },
  7: {
    title: '立體島',
    en: 'Volume + Euler',
    blurb: '先計體積，再數頂點、邊同面。',
    rule: '體積 4 題答對 3 題，然後歐拉 2 題全對就過關。',
  },
  8: {
    title: '利息島',
    en: 'Interest',
    blurb: '單利同複利，答案以 cents 計。',
    rule: '6 題答對 5 題，單利同複利各至少答對 2 題。',
  },
};

export const FORMULA_COPY = {
  title: '公式島',
  titleEn: 'Formula Island',
  eyebrow: '公 式 島',
  subtitle: '8 個島區，由易到難，用公式解開每一關。',
  home: '選擇遊戲',
  welcomeEyebrow: '公 式 島 · Formula Island',
  welcomeBody: '由方向島出發，一路玩到利息島。每個島區先睇教學，再答題；答對夠數就蓋印、解鎖下一個島區。',
  start: '開始遊戲',
  mission: '集齊 8 個島區印章',
  missionLabel: '今日小任務',
  footer: ['從容遊玩', '不計時 · 不扣分', '8 個島區'] as const,
  footnote: '不計時 · 不扣分 · 中途離開亦會保留已過關進度',
  muted: '而家靜音緊。',

  map: {
    title: '世界地圖',
    note: '由左至右、由易到難。過關就會解鎖下一個島區。',
    locked: '未解鎖',
    open: '可以入去',
    stamped: '已蓋印',
    enter: '入去',
    enterLocked: '先過上一個島區',
    starsLabel: '最佳星星',
    summary: '家長摘要',
    wrongBook: '錯題本',
    allClear: '8 個島區全部蓋印！',
  },

  tutorial: {
    eyebrow: '教 學',
    page: (index: number, total: number) => `第 ${index} 頁 / 共 ${total} 頁`,
    next: '下一頁',
    begin: '開始挑戰',
    back: '返回地圖',
  },

  round: {
    pickPrompt: '揀啱嘅答案',
    fillPrompt: '輸入答案',
    fillPlaceholder: '輸入數字',
    submit: '確定',
    correct: '答對喇！',
    wrong: (answer: string) => `唔啱。正確答案係 ${answer}。`,
    next: '下一題',
    progress: (answered: number, total: number) => `${answered} / ${total}`,
    sectionVolume: '第一部分：體積',
    sectionEuler: '第二部分：歐拉公式',
    rematch: '補答',
    hint: '提示卡',
    hintClose: '收起提示卡',
    hintNote: '提示卡只顯示公式，唔會顯示答案。',
    guideSub: '點錯唔會鎖，答完一題先去下一題。',
    emptyFill: '先輸入答案。',
  },

  result: {
    passEyebrow: '島 區 過 關',
    passTitle: '蓋印成功！',
    passBody: (title: string) => `${title}已經蓋印。`,
    failEyebrow: '再 試 一 次',
    failTitle: '差一點點',
    failBody: '今次未夠數，下一個島區仍然鎖住。再試一次，慢慢計。',
    score: (correct: number, total: number) => `答對 ${correct} / ${total} 題`,
    stars: (stars: number) => `${stars} 粒星`,
    retry: '再試一次',
    nextZone: '下一個島區',
    backToMap: '返回地圖',
    unlocked: (title: string) => `${title}已解鎖！`,
    finished: '全部 8 個島區都蓋印喇！',
  },

  summary: {
    eyebrow: '給 家 長',
    title: '家長摘要',
    body: '8 個島區的準確率、最佳星星同要複習的題目。',
    zone: '島區',
    accuracy: '準確率',
    attempts: '次數',
    stars: '星星',
    noData: '未玩',
    locked: '鎖住',
    review: '要複習的題目',
    reviewEmpty: '暫時冇錯題。',
    answer: '正確答案',
    retryWrongs: '重做錯題',
    back: '返回地圖',
  },

  retry: {
    eyebrow: '錯 題 本',
    title: '重做錯題',
    body: '答對就會由錯題本剔走；答錯會留低，下次再試。',
    progress: (index: number, total: number) => `第 ${index} 題 / 共 ${total} 題`,
    done: '錯題本清晒喇！',
    remaining: (count: number) => `仲有 ${count} 題留喺錯題本。`,
    back: '返回地圖',
  },

  help: {
    title: '遊戲說明',
    task: '8 個島區由易到難：方向、錢幣、面積周界、百分率、畢氏定理、因式分解、體積與歐拉、利息。',
    controls: '每個島區先睇教學，再揀或輸入答案。答完即時知對錯。因式島、立體島、利息島有提示卡，只顯示公式。',
    parent: '家長摘要可以睇每個島區的準確率同錯題，並且重做錯題。進度會保存在這部裝置。',
    back: '返回遊戲',
    guide: {
      goal: '認得每條公式幾時用，而唔係死記答案。',
      ask: '「呢題用邊條公式？點解？」',
      show: '同小朋友一齊讀提示卡上的公式，然後由佢代入數字。',
    },
  },
} as const;
