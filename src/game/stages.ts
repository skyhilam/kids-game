import type { RouteMission } from './routeMission';

export type LoadBand = 'easy' | 'basic' | 'puzzle';

export type ParentGuide = {
  goal: string;
  ask: string;
  show: string;
};

export const STAGE_LABEL: Record<LoadBand, string> = {
  easy: '簡單',
  basic: '基礎',
  puzzle: '益智',
};

export const STAGE_OVERVIEW = '簡單 · 基礎 · 益智';

/** Matches the picnic/brush generator bands in `gridFor`. */
export function mazeLoadBand(index: number): LoadBand {
  if (index === 0) return 'easy';
  if (index < 8) return 'basic';
  return 'puzzle';
}

/** Design B: label the map that was minted, not a fixed delivery name. */
export function deliveryLoadBand(mission: Pick<RouteMission, 'nodes' | 'edges'>): LoadBand {
  const cells = Object.keys(mission.nodes).length;
  if (cells >= 12) return 'puzzle';
  if (mission.edges.length >= 10) return 'basic';
  return 'easy';
}

export function stageLabel(band: LoadBand): string {
  return STAGE_LABEL[band];
}

/**
 * In-play stage sentence: `第 N 關 · 簡單|基礎|益智 · done / total`.
 * Sequence passes `filled / steps.length`; sticker passes `matched / words.length`.
 * The visible badge and `data-stage-chip` use this string; `data-stage` stays the Chinese label.
 */
export const STAGE_CHIP_SENTENCE = /^第 \d+ 關 · (簡單|基礎|益智) · \d+ \/ \d+$/;

export function formatStageChip(input: {
  levelIndex: number;
  band: LoadBand;
  progress: string;
}): string {
  return `第 ${input.levelIndex + 1} 關 · ${STAGE_LABEL[input.band]} · ${input.progress}`;
}

/** Same picnic/brush bands: 0 easy, 1–7 basic, 8+ puzzle. */
export function stickerLoadBand(index = 0): LoadBand {
  return mazeLoadBand(index);
}

/** Same picnic/brush/sticker bands: 0 easy, 1–7 basic, 8+ puzzle. */
export function listenLoadBand(index = 0): LoadBand {
  return mazeLoadBand(index);
}

/** Same picnic/brush/sticker/listen bands: 0 easy, 1–7 basic, 8+ puzzle. */
export function sequenceLoadBand(index = 0): LoadBand {
  return mazeLoadBand(index);
}

export const STAGE_PICK_INTRO =
  '地圖分簡單、基礎、益智三個階段。階段只說明這回路徑同思考負荷，方便按孩子當下狀態點揀，不是年齡分級，也不是能力評分。';

export const parentCopy = {
  picnic: {
    easy: {
      goal: '睇清楚出發點同公園，練習輕觸光圈令小車前進。',
      ask: '「我哋從邊度出發？最後想去邊？」',
      show: '家長點一次下一個光圈，等小車停定，交返孩子自己試。',
    },
    basic: {
      goal: '喺分岔比較兩條路，記住要先到漢堡店、再到公園。',
      ask: '「呢兩條路有咩唔同？邊條會先經過漢堡店？」',
      show: '第一個分岔用手指指出兩條可選路，唔代揀；等孩子講完再請自己點。',
    },
    puzzle: {
      goal: '出發前先想好次序同退路，記住橙色路唔可以再行。',
      ask: '「出發前，你想先去邊？如果呢條變橙色，仲有冇第二條？」',
      show: '用手指空劃一條「先漢堡、再公園」嘅路（唔點落遊戲），再請孩子自己行；卡住先提示睇橙色。',
    },
  },
  tooth: {
    easy: {
      goal: '睇到終點同蛀牙蟲喺邊，練習揀冇蟲嘅路。',
      ask: '「終點喺邊？邊條路有蛀牙蟲？」',
      show: '指住蛀牙蟲同終點各一次，之後請孩子自己揀光圈。',
    },
    basic: {
      goal: '喺分岔比較路線，遵守「唔好遇到蛀牙蟲」呢一條規則。',
      ask: '「呢兩條路有咩唔同？邊條冇蛀牙蟲？」',
      show: '家長指住一條明顯有蟲嘅路同另一條較安全嘅路，唔代行；等孩子揀。',
    },
    puzzle: {
      goal: '出發前先想一條安全路，同時記住橙色路唔可再行。',
      ask: '「出發前你想先去邊？避開蟲之後，仲有冇路去到終點？」',
      show: '手指空劃一條唔踩蟲嘅路（唔點落遊戲），再請孩子自己行；卡住先提示「睇下橙色同蟲喺邊」。',
    },
  },
  delivery: {
    goal: '一齊搵紅起點、三間屋同藍終點；送到三份包裹，再去終點就得。',
    ask: '「而家未送嘅係邊間屋？送完三間，終點喺邊？」',
    show: '第一次用「點選路口」行。路可以來回行；橙色只係走過嘅痕跡。唔催速、唔計時。',
    load: '點選較易入手；沿路描線多一手眼協調。依孩子狀態揀，唔係評分。',
  },
  sticker: {
    easy: {
      goal: '用 4 張短詞圖練習圖詞配對，睇圖搵英文詞。',
      ask: '「呢張圖係咩？邊個英文詞？」',
      show: '家長拖一張放對並等英文讀出，之後交返孩子自己拖其餘。',
    },
    basic: {
      goal: '用 5 張圖練習；可能出現漢堡、商店、貨車等主題詞，仍唔計時唔扣分。',
      ask: '「呢張圖同邊個英文詞啱？有冇兩個詞睇落好似？」',
      show: '第一個分岔式混淆（例如兩個都似交通工具）時，家長只指住兩個候選格，唔代拖；等孩子講完再自己放。',
    },
    puzzle: {
      goal: '用 6 張圖；可能混入較長詞（例如 toothbrush）或刷牙主題，一次記多幾個配對。',
      ask: '「出發前你想先配邊張？有冇詞特別長、要慢慢認字母？」',
      show: '家長示範讀一次長詞（例如 toothbrush），唔代拖完全部；卡住先提示睇托盤剩低邊張。',
    },
  },
  listen: {
    easy: {
      goal: '聽完粵語詞，喺 3 張圖入面點啱嗰張。',
      ask: '「你聽到咩？邊張圖係佢？」',
      show: '家長播一次後，指住兩個候選圖（唔代點），再交返孩子自己揀。',
    },
    basic: {
      goal: '聽完詞，喺 4 張圖入面揀啱；可能有兩張好似（例如小車同貨車）。',
      ask: '「邊兩張好似？邊張先啱剛才聽到嗰個？」',
      show: '出現相似圖時，家長只指住相似嗰兩張，唔代點；等孩子講完再自己揀。',
    },
    puzzle: {
      goal: '聽完詞，喺 6 張圖入面揀啱；可能有較長詞（例如牙刷），要先聽清再揀。',
      ask: '「唔好急，你記住個詞未？要唔要再聽一次？」',
      show: '家長示範撳「再聽一次」，之後交返孩子；卡住先提示睇晒所有圖再揀。',
    },
  },
  sequence: {
    easy: {
      goal: '用 3 個步驟練習「邊樣先、邊樣後」，點選排出次序。',
      ask: '「我哋先去邊？之後呢？」',
      show: '家長示範點第一張放入槽 1，之後交返孩子排其餘。',
    },
    basic: {
      goal: '用 4 個步驟排出完整出遊；中間可能多一站（商店／坐車）。',
      ask: '「邊兩步好似好近？邊個要先做？」',
      show: '家長指出兩個可能調轉嘅步驟，唔代排；等孩子講完再自己點。',
    },
    puzzle: {
      goal: '用 5 個步驟排出較長出遊；出發前先想成條序。',
      ask: '「出發前你想點排？有冇一步放錯就去唔到公園？」',
      show: '家長用手指空劃一次正確序（唔代點），再交孩子；卡住先提示由左睇到右。',
    },
  },
} as const satisfies {
  picnic: Record<LoadBand, ParentGuide>;
  tooth: Record<LoadBand, ParentGuide>;
  delivery: ParentGuide & { load: string };
  sticker: Record<LoadBand, ParentGuide>;
  listen: Record<LoadBand, ParentGuide>;
  sequence: Record<LoadBand, ParentGuide>;
};
