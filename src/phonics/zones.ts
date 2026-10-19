/**
 * Phonics Island zone bank.
 * Eight zones, easy to hard. Pass lines are total/need: a round clears only
 * when correct answers reach `need`. Mouth cues keep a round playable when
 * speech is unavailable.
 */

export const PHONICS_ZONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type PhonicsZoneId = (typeof PHONICS_ZONE_IDS)[number];

export type MouthCue = 'open' | 'wide' | 'round' | 'teeth' | 'lips' | 'tongue';

export type PhonicsKind =
  | 'consonant'
  | 'hard-soft'
  | 'short-vowel'
  | 'long-vowel'
  | 'blend'
  | 'digraph'
  | 'silent'
  | 'vowel-team';

export type PhonicsExample = {
  en: string;
  zh: string;
};

/** Hard / soft chips. The strings are the option ids. */
export const HARD_OPTION = '硬音 Hard';
export const SOFT_OPTION = '軟音 Soft';

export type HardSoft = 'hard' | 'soft';

export type SilentPattern = 'kn' | 'wr' | 'ck' | 'mb' | 'gh' | 'st';

export type PhonicsItem = {
  id: string;
  /** English text for speech. */
  say: string;
  /** On-screen text: a letter, a pattern such as `c _ t`, or the whole word. */
  show: string;
  zh: string;
  cue: MouthCue;
  /** Chip id that answers the item. Silent letters use `p` + index. */
  answer: string;
  /** Short sound label for the parent review list. */
  sound: string;
  /** Z1: x is practiced at the end of the word. */
  position?: 'end';
  /** Z2 */
  letter?: 'c' | 'g';
  hardness?: HardSoft;
  /** Z4 minimal pair, short word then long word. */
  pair?: readonly [string, string];
  /** Z7 spelling, including silent letters. */
  letters?: string;
  /** Z7 indexes into `letters`. gh lists both silent letters. */
  silent?: readonly number[];
  pattern?: string;
};

export type PhonicsZone = {
  id: PhonicsZoneId;
  order: number;
  nameZh: string;
  nameEn: string;
  total: number;
  need: number;
  kind: PhonicsKind;
  tutorial: readonly PhonicsExample[];
  items: readonly PhonicsItem[];
};

function consonant(letter: string, word: string, zh: string, cue: MouthCue, position?: 'end'): PhonicsItem {
  return {
    id: `z1-${letter}`,
    say: word,
    show: word,
    zh,
    cue,
    answer: letter,
    sound: letter,
    ...(position ? { position } : {}),
  };
}

function hardSoft(letter: 'c' | 'g', hardness: HardSoft, word: string, zh: string, cue: MouthCue): PhonicsItem {
  return {
    id: `z2-${letter}-${word}`,
    say: word,
    show: word,
    zh,
    cue,
    answer: hardness === 'hard' ? HARD_OPTION : SOFT_OPTION,
    sound: `${hardness} ${letter}`,
    letter,
    hardness,
  };
}

function shortVowel(word: string, vowel: 'a' | 'e' | 'i' | 'o' | 'u', zh: string, cue: MouthCue): PhonicsItem {
  const index = word.indexOf(vowel);
  const show = `${word.slice(0, index)} _ ${word.slice(index + 1)}`;
  return {
    id: `z3-${word}`,
    say: word,
    show,
    zh,
    cue,
    answer: vowel,
    sound: `short ${vowel}`,
  };
}

function longPair(short: string, long: string, vowel: 'a' | 'i' | 'o' | 'u', zh: string, cue: MouthCue): PhonicsItem {
  return {
    id: `z4-${short}-${long}`,
    say: long,
    show: `${short} / ${long}`,
    zh,
    cue,
    answer: long,
    sound: `long ${vowel}`,
    pair: [short, long],
  };
}

function blend(code: string, word: string, zh: string, cue: MouthCue): PhonicsItem {
  return {
    id: `z5-${code}`,
    say: word,
    show: word,
    zh,
    cue,
    answer: code,
    sound: code,
    pattern: code,
  };
}

function digraph(code: string, word: string, zh: string, cue: MouthCue): PhonicsItem {
  return {
    id: `z6-${code}-${word}`,
    say: word,
    show: word,
    zh,
    cue,
    answer: code,
    sound: code,
    pattern: code,
  };
}

function silent(pattern: SilentPattern, word: string, indexes: readonly number[], zh: string, cue: MouthCue): PhonicsItem {
  return {
    id: `z7-${word}`,
    say: word,
    show: word,
    zh,
    cue,
    answer: `p${indexes[0] ?? 0}`,
    sound: pattern,
    pattern,
    letters: word,
    silent: indexes,
  };
}

function team(code: string, word: string, zh: string, cue: MouthCue): PhonicsItem {
  return {
    id: `z8-${code}-${word}`,
    say: word,
    show: word,
    zh,
    cue,
    answer: code,
    sound: code,
    pattern: code,
  };
}

const Z1: readonly PhonicsItem[] = [
  consonant('b', 'bat', 'b 讀 /b/，bat 球棒', 'lips'),
  consonant('c', 'cat', 'c 讀硬音 /k/，cat 貓', 'tongue'),
  consonant('d', 'dog', 'd 讀 /d/，dog 狗', 'tongue'),
  consonant('f', 'fan', 'f 讀 /f/，fan 扇', 'teeth'),
  consonant('g', 'gum', 'g 讀硬音 /g/，gum 香口膠', 'tongue'),
  consonant('h', 'hat', 'h 讀 /h/，hat 帽', 'open'),
  consonant('j', 'jam', 'j 讀 /dʒ/，jam 果醬', 'tongue'),
  consonant('k', 'king', 'k 讀 /k/，king 國王', 'tongue'),
  consonant('l', 'leg', 'l 讀 /l/，leg 腿', 'tongue'),
  consonant('m', 'map', 'm 讀 /m/，map 地圖', 'lips'),
  consonant('n', 'net', 'n 讀 /n/，net 網', 'tongue'),
  consonant('p', 'pen', 'p 讀 /p/，pen 筆', 'lips'),
  consonant('q', 'queen', 'q 讀 /kw/，queen 皇后', 'round'),
  consonant('r', 'rat', 'r 讀 /r/，rat 老鼠', 'tongue'),
  consonant('s', 'sun', 's 讀 /s/，sun 太陽', 'teeth'),
  consonant('t', 'top', 't 讀 /t/，top 頂', 'tongue'),
  consonant('v', 'van', 'v 讀 /v/，van 貨車', 'teeth'),
  consonant('w', 'web', 'w 讀 /w/，web 蜘蛛網', 'round'),
  consonant('x', 'box', 'x 在字尾讀 /ks/，box 盒子', 'teeth', 'end'),
  consonant('y', 'yes', 'y 讀 /j/，yes 是', 'wide'),
  consonant('z', 'zoo', 'z 讀 /z/，zoo 動物園', 'teeth'),
];

const Z2: readonly PhonicsItem[] = [
  hardSoft('c', 'hard', 'can', 'c 後面係 a，讀硬音 /k/', 'tongue'),
  hardSoft('c', 'hard', 'cat', 'c 後面係 a，讀硬音 /k/', 'tongue'),
  hardSoft('c', 'hard', 'cup', 'c 後面係 u，讀硬音 /k/', 'tongue'),
  hardSoft('c', 'hard', 'cap', 'c 後面係 a，讀硬音 /k/', 'tongue'),
  hardSoft('c', 'soft', 'city', 'c 後面係 i，讀軟音 /s/', 'teeth'),
  hardSoft('c', 'soft', 'circle', 'c 後面係 i，讀軟音 /s/', 'teeth'),
  hardSoft('c', 'soft', 'ice', 'c 後面係 e，讀軟音 /s/', 'teeth'),
  hardSoft('c', 'soft', 'face', 'c 後面係 e，讀軟音 /s/', 'teeth'),
  hardSoft('g', 'hard', 'gum', 'g 後面係 u，讀硬音 /g/', 'tongue'),
  hardSoft('g', 'hard', 'game', 'g 後面係 a，讀硬音 /g/', 'tongue'),
  hardSoft('g', 'hard', 'go', 'g 後面係 o，讀硬音 /g/', 'tongue'),
  hardSoft('g', 'hard', 'goat', 'g 後面係 o，讀硬音 /g/', 'tongue'),
  hardSoft('g', 'soft', 'giant', 'g 後面係 i，讀軟音 /dʒ/', 'tongue'),
  hardSoft('g', 'soft', 'gem', 'g 後面係 e，讀軟音 /dʒ/', 'tongue'),
  hardSoft('g', 'soft', 'gel', 'g 後面係 e，讀軟音 /dʒ/', 'tongue'),
  hardSoft('g', 'soft', 'page', 'g 後面係 e，讀軟音 /dʒ/', 'tongue'),
];

const Z3: readonly PhonicsItem[] = [
  shortVowel('cat', 'a', '短 a，嘴巴張大，cat 貓', 'open'),
  shortVowel('hat', 'a', '短 a，嘴巴張大，hat 帽', 'open'),
  shortVowel('map', 'a', '短 a，嘴巴張大，map 地圖', 'open'),
  shortVowel('bag', 'a', '短 a，嘴巴張大，bag 袋', 'open'),
  shortVowel('bed', 'e', '短 e，嘴角咧開，bed 床', 'wide'),
  shortVowel('pen', 'e', '短 e，嘴角咧開，pen 筆', 'wide'),
  shortVowel('red', 'e', '短 e，嘴角咧開，red 紅色', 'wide'),
  shortVowel('hen', 'e', '短 e，嘴角咧開，hen 母雞', 'wide'),
  shortVowel('pin', 'i', '短 i，嘴角咧開，pin 大頭針', 'wide'),
  shortVowel('sit', 'i', '短 i，嘴角咧開，sit 坐', 'wide'),
  shortVowel('pig', 'i', '短 i，嘴角咧開，pig 豬', 'wide'),
  shortVowel('fin', 'i', '短 i，嘴角咧開，fin 魚鰭', 'wide'),
  shortVowel('hot', 'o', '短 o，嘴唇圓圓，hot 熱', 'round'),
  shortVowel('hop', 'o', '短 o，嘴唇圓圓，hop 跳', 'round'),
  shortVowel('pot', 'o', '短 o，嘴唇圓圓，pot 煲', 'round'),
  shortVowel('dog', 'o', '短 o，嘴唇圓圓，dog 狗', 'round'),
  shortVowel('cup', 'u', '短 u，嘴唇圓圓，cup 杯', 'round'),
  shortVowel('sun', 'u', '短 u，嘴唇圓圓，sun 太陽', 'round'),
  shortVowel('bus', 'u', '短 u，嘴唇圓圓，bus 巴士', 'round'),
  shortVowel('run', 'u', '短 u，嘴唇圓圓，run 跑', 'round'),
];

const Z4: readonly PhonicsItem[] = [
  longPair('cap', 'cape', 'a', 'cape 的 a 讀字母名，尾音 e 唔出聲', 'open'),
  longPair('tap', 'tape', 'a', 'tape 的 a 讀字母名，尾音 e 唔出聲', 'open'),
  longPair('mad', 'made', 'a', 'made 的 a 讀字母名，尾音 e 唔出聲', 'open'),
  longPair('bit', 'bite', 'i', 'bite 的 i 讀字母名，尾音 e 唔出聲', 'wide'),
  longPair('kit', 'kite', 'i', 'kite 的 i 讀字母名，尾音 e 唔出聲', 'wide'),
  longPair('pin', 'pine', 'i', 'pine 的 i 讀字母名，尾音 e 唔出聲', 'wide'),
  longPair('hop', 'hope', 'o', 'hope 的 o 讀字母名，尾音 e 唔出聲', 'round'),
  longPair('not', 'note', 'o', 'note 的 o 讀字母名，尾音 e 唔出聲', 'round'),
  longPair('cub', 'cube', 'u', 'cube 的 u 讀字母名，尾音 e 唔出聲', 'round'),
  longPair('tub', 'tube', 'u', 'tube 的 u 讀字母名，尾音 e 唔出聲', 'round'),
];

const Z5: readonly PhonicsItem[] = [
  blend('sn', 'snake', 'sn 連讀，snake 蛇', 'teeth'),
  blend('st', 'star', 'st 連讀，star 星星', 'teeth'),
  blend('sk', 'skip', 'sk 連讀，skip 跳過', 'teeth'),
  blend('sp', 'spot', 'sp 連讀，spot 斑點', 'teeth'),
  blend('sl', 'slip', 'sl 連讀，slip 滑', 'teeth'),
  blend('sw', 'swim', 'sw 連讀，swim 游水', 'round'),
  blend('sc', 'scarf', 'sc 連讀，scarf 頸巾', 'teeth'),
  blend('sm', 'smile', 'sm 連讀，smile 微笑', 'lips'),
  blend('bl', 'blue', 'bl 連讀，blue 藍色', 'lips'),
  blend('cl', 'clap', 'cl 連讀，clap 拍手', 'tongue'),
  blend('pl', 'plant', 'pl 連讀，plant 植物', 'lips'),
  blend('fl', 'flag', 'fl 連讀，flag 旗', 'teeth'),
  blend('gl', 'glue', 'gl 連讀，glue 膠水', 'tongue'),
  blend('br', 'bread', 'br 連讀，bread 麵包', 'lips'),
  blend('cr', 'crab', 'cr 連讀，crab 蟹', 'tongue'),
  blend('dr', 'drum', 'dr 連讀，drum 鼓', 'tongue'),
  blend('fr', 'frog', 'fr 連讀，frog 青蛙', 'teeth'),
  blend('gr', 'grass', 'gr 連讀，grass 草', 'tongue'),
  blend('tr', 'tree', 'tr 連讀，tree 樹', 'tongue'),
];

const Z6: readonly PhonicsItem[] = [
  digraph('ch', 'chip', 'ch 一齊讀，chip 薯片', 'tongue'),
  digraph('ch', 'chop', 'ch 一齊讀，chop 砍', 'tongue'),
  digraph('ch', 'chin', 'ch 一齊讀，chin 下巴', 'tongue'),
  digraph('sh', 'ship', 'sh 一齊讀，ship 船', 'teeth'),
  digraph('sh', 'shop', 'sh 一齊讀，shop 店', 'teeth'),
  digraph('sh', 'fish', 'sh 一齊讀，fish 魚', 'teeth'),
  digraph('th', 'thumb', 'th 一齊讀，thumb 拇指', 'tongue'),
  digraph('th', 'thin', 'th 一齊讀，thin 薄', 'tongue'),
  digraph('th', 'bath', 'th 一齊讀，bath 洗澡', 'tongue'),
  digraph('wh', 'whale', 'wh 一齊讀，whale 鯨魚', 'round'),
  digraph('wh', 'wheel', 'wh 一齊讀，wheel 輪', 'round'),
  digraph('wh', 'white', 'wh 一齊讀，white 白色', 'round'),
  digraph('tch', 'match', 'tch 一齊讀，match 比賽', 'tongue'),
  digraph('tch', 'catch', 'tch 一齊讀，catch 接住', 'tongue'),
  digraph('tch', 'watch', 'tch 一齊讀，watch 手錶', 'tongue'),
];

const Z7: readonly PhonicsItem[] = [
  silent('kn', 'knee', [0], 'kn 的 k 唔出聲，knee 膝頭', 'tongue'),
  silent('kn', 'knit', [0], 'kn 的 k 唔出聲，knit 織', 'tongue'),
  silent('kn', 'knot', [0], 'kn 的 k 唔出聲，knot 結', 'tongue'),
  silent('kn', 'knife', [0], 'kn 的 k 唔出聲，knife 刀', 'tongue'),
  silent('wr', 'write', [0], 'wr 的 w 唔出聲，write 寫', 'round'),
  silent('wr', 'wrist', [0], 'wr 的 w 唔出聲，wrist 手腕', 'round'),
  silent('wr', 'wrap', [0], 'wr 的 w 唔出聲，wrap 包', 'round'),
  silent('wr', 'wrench', [0], 'wr 的 w 唔出聲，wrench 扳手', 'round'),
  silent('ck', 'duck', [2], 'ck 的 c 唔出聲，duck 鴨', 'tongue'),
  silent('ck', 'back', [2], 'ck 的 c 唔出聲，back 背', 'tongue'),
  silent('ck', 'neck', [2], 'ck 的 c 唔出聲，neck 頸', 'tongue'),
  silent('ck', 'sock', [2], 'ck 的 c 唔出聲，sock 襪', 'tongue'),
  silent('mb', 'lamb', [3], 'mb 的 b 唔出聲，lamb 小羊', 'lips'),
  silent('mb', 'thumb', [4], 'mb 的 b 唔出聲，thumb 拇指', 'lips'),
  silent('mb', 'comb', [3], 'mb 的 b 唔出聲，comb 梳', 'lips'),
  silent('mb', 'climb', [4], 'mb 的 b 唔出聲，climb 爬', 'lips'),
  silent('gh', 'night', [2, 3], 'gh 的 g 同 h 都唔出聲，night 夜晚', 'open'),
  silent('gh', 'light', [2, 3], 'gh 的 g 同 h 都唔出聲，light 光', 'open'),
  silent('gh', 'right', [2, 3], 'gh 的 g 同 h 都唔出聲，right 右', 'open'),
  silent('gh', 'high', [2, 3], 'gh 的 g 同 h 都唔出聲，high 高', 'open'),
  silent('st', 'listen', [3], 'listen 的 t 唔出聲', 'tongue'),
  silent('st', 'castle', [3], 'castle 的 t 唔出聲，castle 城堡', 'tongue'),
  silent('st', 'whistle', [4], 'whistle 的 t 唔出聲，whistle 哨子', 'tongue'),
  silent('st', 'fasten', [3], 'fasten 的 t 唔出聲，fasten 扣好', 'tongue'),
];

const Z8: readonly PhonicsItem[] = [
  team('ai', 'rain', 'ai 讀長 a，rain 雨', 'open'),
  team('ai', 'train', 'ai 讀長 a，train 火車', 'open'),
  team('ay', 'day', 'ay 讀長 a，day 日子', 'open'),
  team('ay', 'play', 'ay 讀長 a，play 玩', 'open'),
  team('ea', 'sea', 'ea 讀長 e，sea 海', 'wide'),
  team('ea', 'tea', 'ea 讀長 e，tea 茶', 'wide'),
  team('ee', 'tree', 'ee 讀長 e，tree 樹', 'wide'),
  team('ee', 'feet', 'ee 讀長 e，feet 腳', 'wide'),
  team('oa', 'boat', 'oa 讀長 o，boat 船', 'round'),
  team('oa', 'soap', 'oa 讀長 o，soap 肥皂', 'round'),
  team('ow', 'snow', 'ow 讀長 o，snow 雪', 'round'),
  team('ow', 'grow', 'ow 讀長 o，grow 長大', 'round'),
  team('au', 'sauce', 'au 一齊讀，sauce 醬', 'round'),
  team('au', 'autumn', 'au 一齊讀，autumn 秋天', 'round'),
  team('aw', 'saw', 'aw 一齊讀，saw 看見', 'round'),
  team('aw', 'draw', 'aw 一齊讀，draw 畫', 'round'),
  team('ie', 'pie', 'ie 讀長 i，pie 批', 'wide'),
  team('ie', 'tie', 'ie 讀長 i，tie 領呔', 'wide'),
  team('ew', 'new', 'ew 一齊讀，new 新', 'round'),
  team('ew', 'few', 'ew 一齊讀，few 少', 'round'),
  team('oo', 'moon', 'oo 讀長音，moon 月亮', 'round'),
  team('oo', 'food', 'oo 讀長音，food 食物', 'round'),
];

export const PHONICS_ZONES: readonly PhonicsZone[] = [
  {
    id: 1,
    order: 1,
    nameZh: '字母沙灘',
    nameEn: 'Consonants',
    total: 10,
    need: 8,
    kind: 'consonant',
    tutorial: [
      { en: 'bat', zh: '球棒' },
      { en: 'cat', zh: '貓' },
      { en: 'gum', zh: '香口膠' },
      { en: 'box', zh: '盒子' },
      { en: 'fox', zh: '狐狸' },
    ],
    items: Z1,
  },
  {
    id: 2,
    order: 2,
    nameZh: '軟硬岩岸',
    nameEn: 'Hard and Soft',
    total: 8,
    need: 6,
    kind: 'hard-soft',
    tutorial: [
      { en: 'can', zh: '罐' },
      { en: 'city', zh: '城市' },
      { en: 'gum', zh: '香口膠' },
      { en: 'giant', zh: '巨人' },
    ],
    items: Z2,
  },
  {
    id: 3,
    order: 3,
    nameZh: '短元音谷',
    nameEn: 'Short Vowels',
    total: 10,
    need: 8,
    kind: 'short-vowel',
    tutorial: [
      { en: 'cat', zh: '貓' },
      { en: 'bed', zh: '床' },
      { en: 'pin', zh: '大頭針' },
      { en: 'hot', zh: '熱' },
      { en: 'cup', zh: '杯' },
    ],
    items: Z3,
  },
  {
    id: 4,
    order: 4,
    nameZh: '長元音丘',
    nameEn: 'Long Vowels',
    total: 8,
    need: 6,
    kind: 'long-vowel',
    tutorial: [
      { en: 'bit / bite', zh: '短 i 同長 i' },
      { en: 'cap / cape', zh: '短 a 同長 a' },
      { en: 'hop / hope', zh: '短 o 同長 o' },
      { en: 'cub / cube', zh: '短 u 同長 u' },
    ],
    items: Z4,
  },
  {
    id: 5,
    order: 5,
    nameZh: '拼搭橋',
    nameEn: 'Blends',
    total: 10,
    need: 7,
    kind: 'blend',
    tutorial: [
      { en: 'snake', zh: '蛇' },
      { en: 'star', zh: '星星' },
      { en: 'flag', zh: '旗' },
    ],
    items: Z5,
  },
  {
    id: 6,
    order: 6,
    nameZh: '雙音洞',
    nameEn: 'Digraphs',
    total: 10,
    need: 7,
    kind: 'digraph',
    tutorial: [
      { en: 'chip', zh: '薯片' },
      { en: 'ship', zh: '船' },
      { en: 'thumb', zh: '拇指' },
      { en: 'whale', zh: '鯨魚' },
      { en: 'match', zh: '比賽' },
    ],
    items: Z6,
  },
  {
    id: 7,
    order: 7,
    nameZh: '靜音林',
    nameEn: 'Silent Letters',
    total: 8,
    need: 6,
    kind: 'silent',
    tutorial: [
      { en: 'knee', zh: '膝頭' },
      { en: 'write', zh: '寫' },
      { en: 'duck', zh: '鴨' },
      { en: 'lamb', zh: '小羊' },
      { en: 'night', zh: '夜晚' },
      { en: 'listen', zh: '聽' },
    ],
    items: Z7,
  },
  {
    id: 8,
    order: 8,
    nameZh: '雙元音灣',
    nameEn: 'Vowel Digraphs',
    total: 10,
    need: 7,
    kind: 'vowel-team',
    tutorial: [
      { en: 'rain', zh: '雨' },
      { en: 'day', zh: '日子' },
      { en: 'sea', zh: '海' },
      { en: 'tree', zh: '樹' },
      { en: 'boat', zh: '船' },
      { en: 'snow', zh: '雪' },
      { en: 'sauce', zh: '醬' },
      { en: 'saw', zh: '看見' },
      { en: 'pie', zh: '批' },
      { en: 'new', zh: '新' },
      { en: 'moon', zh: '月亮' },
    ],
    items: Z8,
  },
];

export function isPhonicsZoneId(value: unknown): value is PhonicsZoneId {
  return typeof value === 'number' && (PHONICS_ZONE_IDS as readonly number[]).includes(value);
}

export function phonicsZone(zoneId: PhonicsZoneId): PhonicsZone {
  const zone = PHONICS_ZONES.find((item) => item.id === zoneId);
  if (!zone) throw new Error(`Unknown phonics zone ${zoneId}`);
  return zone;
}

export function phonicsItem(zoneId: PhonicsZoneId, itemId: string): PhonicsItem | null {
  return phonicsZone(zoneId).items.find((item) => item.id === itemId) ?? null;
}
