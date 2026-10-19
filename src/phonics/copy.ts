import { PHONICS_ZONES, type PhonicsZoneId } from './zones';

/** All Phonics Island UI copy, plus one teaching paragraph per zone. */

export type PhonicsLesson = {
  title: string;
  body: string;
};

function examples(id: PhonicsZoneId): string {
  const zone = PHONICS_ZONES.find((item) => item.id === id);
  if (!zone) return '';
  return zone.tutorial.map((word) => `${word.en}（${word.zh}）`).join('、');
}

export const PHONICS_LESSONS: Record<PhonicsZoneId, PhonicsLesson> = {
  1: {
    title: '字母沙灘',
    body: `每個輔音有自己的讀音。睇住個字，點返個字母。c 同 g 呢度讀硬音，好似 cat、gum。x 喺字尾，好似 box、fox。例：${examples(1)}。`,
  },
  2: {
    title: '軟硬岩岸',
    body: `c 同 g 後面係 a、o、u，通常讀硬音；後面係 e、i、y，通常讀軟音。呢區只用規則字，唔考 get、girl、give。例：${examples(2)}。`,
  },
  3: {
    title: '短元音谷',
    body: `短元音 a e i o u 嘴形唔同。c _ t 讀 cat，中間係短 a。例：${examples(3)}。`,
  },
  4: {
    title: '長元音丘',
    body: `長元音會讀自己的字母名。bit 係短 i，bite 係長 i，尾嘅 e 唔出聲。同樣睇 cap / cape、hop / hope、cub / cube。例：${examples(4)}。`,
  },
  5: {
    title: '拼搭橋',
    body: `兩個輔音連住一齊讀，好似 snake 開頭的 sn、flag 開頭的 fl。例：${examples(5)}。`,
  },
  6: {
    title: '雙音洞',
    body: `兩個字母合作一個音：chip 的 ch、ship 的 sh、thumb 的 th、whale 的 wh、match 的 tch。例：${examples(6)}。`,
  },
  7: {
    title: '靜音林',
    body: `有啲字母唔出聲。kn 的 k、wr 的 w、ck 的 c、mb 的 b、gh 的 g 同 h、listen 的 t。點返唔出聲嗰個字母。例：${examples(7)}。`,
  },
  8: {
    title: '雙元音灣',
    body: `兩個元音合作。ow 呢區只讀長 o，好似 snow，唔係 cow。oo 讀長音，好似 moon，唔係 book。例：${examples(8)}。`,
  },
};

export const PHONICS_COPY = {
  title: '語音島',
  titleEn: 'Phonics Island',
  eyebrow: '語 音 島',
  subtitle: '8 個小區，由易到難。聽個音，或者睇口型，點返啱嘅字。',
  home: '選擇遊戲',
  exit: '離開',
  welcomeEyebrow: '語 音 島 · Phonics Island',
  welcomeBody: '由字母沙灘出發，一路玩到雙元音灣。每個小區先睇教學，再答題。過關就蓋印，解鎖下一個小區。',
  start: '開始遊戲',
  mission: '集齊 8 個小區印章',
  missionLabel: '今日小任務',
  footer: ['從容遊玩', '不計時', '8 個小區'] as const,
  footnote: '不計時。中途離開，已過關的進度會留喺呢部裝置。',
  muted: '而家靜音緊。',
  noAudio: '而家讀唔到聲。睇住字母同口型，一樣可以完成。',
  replay: '再聽一次',

  cue: {
    open: '張大口',
    wide: '嘴角咧開',
    round: '嘴唇圓圓',
    teeth: '牙齒輕輕咬',
    lips: '雙唇合埋',
    tongue: '舌尖頂一頂',
  },

  map: {
    title: '世界地圖',
    note: '由左至右、由易到難。過關就會解鎖下一個小區。',
    locked: '未解鎖',
    open: '可以入去',
    stamped: '已蓋印',
    enter: '入去',
    enterLocked: '先過上一個小區',
    starsLabel: '最佳星星',
    summary: '家長摘要',
    wrongBook: '錯題本',
    allClear: '8 個小區全部蓋印！',
  },

  tutorial: {
    eyebrow: '教 學',
    next: '開始挑戰',
    begin: '開始挑戰',
    back: '返回地圖',
  },

  round: {
    prompt: '點返啱嘅音',
    promptEnd: '點字尾嘅字母',
    promptSilent: '點唔出聲嘅字母',
    promptLong: '點元音會讀自己名嘅字',
    correct: '答對喇！',
    wrong: (answer: string) => `唔啱。正確答案係 ${answer}。`,
    next: '下一題',
    progress: (answered: number, total: number) => `${answered} / ${total}`,
    guideSub: '點錯會記低，答完一題先去下一題。',
  },

  result: {
    passEyebrow: '小 區 過 關',
    passTitle: '蓋印成功！',
    passBody: (title: string) => `${title}已經蓋印。`,
    failEyebrow: '再 試 一 次',
    failTitle: '差一點點',
    failBody: '今次未夠數，下一個小區仍然鎖住。再試一次，慢慢聽。',
    score: (correct: number, total: number) => `答對 ${correct} / ${total} 題`,
    stars: (stars: number) => `${stars} 粒星`,
    retry: '再試一次',
    nextZone: '下一個小區',
    backToMap: '返回地圖',
    unlocked: (title: string) => `${title}已解鎖！`,
    finished: '全部 8 個小區都蓋印喇！',
  },

  summary: {
    eyebrow: '給 家 長',
    title: '家長摘要',
    body: '8 個小區的準確率、最佳星星，同建議重溫的音。',
    zone: '小區',
    accuracy: '準確率',
    rounds: '回合',
    stars: '星星',
    noData: '未玩',
    locked: '鎖住',
    review: '建議重溫',
    reviewEmpty: '暫時冇需要重溫的小區。',
    sounds: '可以再練的音',
    back: '返回地圖',
  },

  retry: {
    eyebrow: '錯 題 本',
    title: '重做錯題',
    body: '答對就會由錯題本剔走。答錯會留低，下次再試。星星同解鎖唔會因為重做而改變。',
    done: '錯題本清晒喇！',
    remaining: (count: number) => `仲有 ${count} 題留喺錯題本。`,
    back: '返回地圖',
  },

  help: {
    title: '遊戲說明',
    task: '8 個小區由易到難：字母沙灘、軟硬岩岸、短元音谷、長元音丘、拼搭橋、雙音洞、靜音林、雙元音灣。',
    controls: '每個小區先睇教學，再點答案。答完即時知對錯。讀唔到聲的時候，睇字母同口型一樣可以玩完。',
    parent: '家長摘要可以睇每個小區的準確率，同建議重溫的音。進度會保存在這部裝置。',
    back: '返回遊戲',
  },
} as const;
