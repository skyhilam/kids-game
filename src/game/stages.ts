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

/** Same picnic/brush bands: 0 easy, 1–7 basic, 8+ puzzle. */
export function stickerLoadBand(index = 0): LoadBand {
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
    goal: '一齊搵紅起點、1–3 號屋同藍終點；練習記住送貨次序，同預留返程路。',
    ask: '「先去邊間屋？送完之後，返程有冇另一條未行過嘅路？」',
    show: '第一次用「點選路口」行頭一段；之後鼓勵改試畫線。可重經路口，唔好重行橙色路段。唔催速、唔計時。',
    load: '點選較易入手；沿路描線多一手眼協調。依孩子狀態揀，唔係評分。',
  },
  sticker: {
    easy: {
      goal: '用 4 張圖練習圖詞配對。',
      ask: '呢張圖係咩？邊個英文詞？',
      show: '家長拖一張放對後交返孩子',
    },
    basic: {
      goal: '用 5 張圖練習圖詞配對。',
      ask: '呢張圖係咩？邊個英文詞？',
      show: '家長拖一張放對後交返孩子',
    },
    puzzle: {
      goal: '用 6 張圖練習圖詞配對。',
      ask: '呢張圖係咩？邊個英文詞？',
      show: '家長拖一張放對後交返孩子',
    },
  },
} as const satisfies {
  picnic: Record<LoadBand, ParentGuide>;
  tooth: Record<LoadBand, ParentGuide>;
  delivery: ParentGuide & { load: string };
  sticker: Record<LoadBand, ParentGuide>;
};
