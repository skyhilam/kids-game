# 語音島（Phonics Island）

Hub 休息站小遊戲，跟小小出遊家同一個 Pages 網站（`/kids-game/`）。對象 5–8 歲；後面幾個小區可以到約 9 歲。沒有登入、沒有計時、沒有扣分，也不用麥克風評分。每個小區大約 2–4 分鐘，中途可以離開。

從 Hub 的「語音島」卡進入。世界地圖有 8 個小區，由易到難。過關蓋印並解鎖下一個。右上角的「選擇遊戲」回到 Hub。

## 解鎖順序

沒有延後的小區。第 1 區一開始就開。第 N 區要第 N−1 區已蓋印才開。

1. 字母沙灘 Consonants：Bb–Zz 的字母音，加上例字。
2. 軟硬岩岸 Hard/Soft C & G：`can` / `city`、`gum` / `giant`。不考 get、girl、give。
3. 短元音谷 Short a e i o u。
4. 長元音丘 Long a i o u：元音讀自己的字母名。最小對比如 `bit` / `bite`、`cap` / `cape`、`hop` / `hope`、`cub` / `cube`。
5. 拼搭橋 Consonant blends：`sn st sk sp sl sw sc sm`、`bl cl pl fl gl`、`br cr dr fr gr tr`。
6. 雙音洞 Digraphs：`ch sh th wh tch`。
7. 靜音林 Silent letters：`kn wr ck mb gh`，以及 `listen` 這類 `st`（t 唔出聲）。
8. 雙元音灣 Vowel digraphs：`ai ay ea ee oa ow au aw ie ew oo`。這區的 `ow` 只讀長 o（`snow`），`oo` 讀長音（`moon`）。

一局進行中離開或重新載入，不會把未完成的那一局寫入進度。已蓋印的小區仍開着。失敗的一局不蓋印；如果下一個小區本來鎖住，就繼續鎖住。已經解鎖的後面小區，不會因為重玩前面一區失敗而重新鎖上。

## 過關、題型與星星

過關才有星星，按該局錯題計算。未過關是 0 星，不蓋印。0 次錯是 3 星。仍過關時，錯題不多於 `ceil((題數 − 過關所需) / 2)` 是 2 星；再多但仍過關是 1 星。同一區再玩，星星保留較高的一次，印章不會收回。

| 小區 | 技能 | 題型 | 過關 | 星星 |
| --- | --- | --- | --- | --- |
| 1 字母沙灘 | 輔音字母音 | 看字，點字母。10 題 | 至少 8 題 | 錯 0 題 3 星；錯 1 題 2 星；錯 2 題 1 星 |
| 2 軟硬岩岸 | 硬音與軟音的 C、G | 「硬音 Hard」「軟音 Soft」兩顆按鈕。C 和 G 都會出現。8 題 | 至少 6 題 | 錯 0 題 3 星；錯 1 題 2 星；錯 2 題 1 星 |
| 3 短元音谷 | 短 a e i o u | 看 `c _ t` 這類空格，點元音。10 題 | 至少 8 題 | 同第 1 區 |
| 4 長元音丘 | 長元音讀字母名 | 最小對比兩顆字，點會讀自己名的那個。8 題 | 至少 6 題 | 同第 2 區 |
| 5 拼搭橋 | 子音連綴 | 點開頭的連綴。10 題 | 至少 7 題 | 錯 0 題 3 星；錯 1–2 題 2 星；錯 3 題 1 星 |
| 6 雙音洞 | ch sh th wh tch | 點雙字母音。10 題 | 至少 7 題 | 同第 5 區 |
| 7 靜音林 | 唔出聲的字母 | 點單詞裡唔出聲的那一格。`gh` 點 g 或 h 都算對。8 題 | 至少 6 題 | 同第 2 區 |
| 8 雙元音灣 | 雙元音 | 點元音組合。10 題 | 至少 7 題 | 同第 5 區 |

每一區先顯示一版教學，例字是這款遊戲自己的字，再按「開始挑戰」。點選之後立即顯示對或錯，然後先去下一題。答完一局才打開結果視窗：過關有印章和星星，失敗是「再試一次」，下一個小區保持原本的鎖。

## 錯題本

答錯的題會進入該區的錯題本。地圖上出現「重溫錯題」。重做時答對就從本子拿掉，答錯就留下。星星和解鎖不會因為重做而改變。重做到一半就離開，不會改錯題本；要等這一輪重做做完才寫入。

## 家長摘要

地圖上的「家長摘要」列出 8 個小區的準確率和最佳星星。準確率是已完成回合的答對數除以作答次數；還沒玩過的小區顯示「—」。低於 80%，或錯題本還有題的小區，會出現在「建議重溫」，最多列出三個音。

## 儲存與重設

進度只放在這部瀏覽器的 `localStorage`，鍵名是 `kids-phonics-island-v1`。沒有登入，不會上傳。形狀是：

```json
{
  "version": 1,
  "zones": {
    "1": {
      "cleared": false,
      "bestStars": 0,
      "attempts": 0,
      "correct": 0,
      "rounds": 0,
      "wrongBook": []
    }
  }
}
```

`zones` 的鍵是 `"1"` 到 `"8"`。`cleared` 為 true 時 `bestStars` 是 1、2 或 3；還沒過關則星星是 0。`wrongBook` 是該區題目 id。寫不進去或格式不對時，遊戲仍可玩，只是進度回到空白。

只刪這一條，不要清空整個 `localStorage`（其他遊戲和素材工房用別的鍵）。在遊戲頁面的主控台執行：

```js
localStorage.removeItem('kids-phonics-island-v1')
```

然後重新載入。地圖回到第 1 區開啟、第 2–8 區鎖住。重新載入頁面會回到 Hub；已保存的印章要再點「語音島」才看得到。

## 音訊與無聲

目標音和例字用瀏覽器的英文 Web Speech（`en`）朗讀，沿用遊戲既有的英文語音。右上角喇叭可以關掉音效和朗讀。裝置沒有語音、朗讀失敗，或已經靜音時，畫面上仍有字母和口型提示，該區可以照樣答完，不會被聲音擋住。

## 檔案

| 檔案 | 作用 |
| --- | --- |
| `src/phonics/zones.ts` | 8 區題庫、題數、過關線、教學例字 |
| `src/phonics/round.ts` | 出題、對錯、星星 |
| `src/phonics/progress.ts` | `kids-phonics-island-v1`、解鎖、錯題本、家長摘要 |
| `src/phonics/copy.ts` | 介面文字和每區教學 |
| `src/phonics/speech.ts` | 英文朗讀；失敗就靜音 |
| `src/components/PhonicsPlay.vue` | 地圖、教學、答題、結果、摘要 |
| `src/components/PhonicsArt.vue` | 小島、鎖、星星、印章、口型的平面 SVG |
| `src/components/Hub.vue` | Hub 最後一張「語音島」卡 |
| `src/App.vue` | `phonics` 活動，非同步載入 `PhonicsPlay`，回家回到 Hub |
| `tests/phonics.test.ts` | 題庫、評分、進度、無聲 |
| `tests/hub.test.ts` | Hub 卡，以及 browser-check 仍檢查「小小出遊家」標題 |
| `scripts/browser-check.mjs` | `runPhonics(page)` |

## 可貼進 PR 的自測備註

用約 1024×768 的視窗。全新進度可先刪 `kids-phonics-island-v1`。手機另用約 390px 寬看一次。

### Hub 入口

- [ ] Hub 有「語音島」卡，說明是「聽音認字母，8 個小島逐個解鎖。」，並標 Phonics Island · 8 區。
- [ ] 點進去看到世界地圖，8 個小區。第 1 區「可以入去」，第 2–8 區「未解鎖」。
- [ ] 「選擇遊戲」回到 Hub。野餐、刷牙、送貨、貼紙、聽一聽、出遊順序卡、公式島的卡仍在。

### 第 1 區 字母沙灘

- [ ] 教學例字有 bat、cat、gum、box、fox。按「開始挑戰」後是 10 題，點字母，答完立即知道對錯。
- [ ] 10 題全對：結果有印章和 3 星，第 2 區解鎖。
- [ ] 重新載入後再進語音島，第 2 區仍然開着。家長摘要裡第 1 區是 100%。
- [ ] 沒有聲音時仍看得到字和口型，可以答完。

### 第 2 區 軟硬岩岸

- [ ] 教學例字有 can、city、gum、giant。選項是硬音和軟音，這一局同時有 C 和 G。
- [ ] 答 2 題後按「選擇遊戲」，回到 Hub，畫面沒有報錯。再進去，第 1 區仍是 100%，這一局未完成的兩題沒有被當成過關。
- [ ] 另開一局故意錯到不及格（8 題裡錯超過 2 題）：結果未過關，第 3 區保持進入這一局之前的鎖（本來鎖住就仍鎖住，本來已解鎖就仍解鎖）。

### 第 6 區 雙音洞

- [ ] 要先蓋印第 1–5 區才進得去。教學有 chip、ship、thumb、whale、match。
- [ ] 一局 10 題，點 ch、sh、th、wh 或 tch。至少 7 題對才蓋印並得到星星。少於 7 題則失敗，第 7 區保持鎖住。

### 第 8 區 雙元音灣

- [ ] 要先蓋印第 7 區。教學會說明 `ow` 讀長 o（snow）、`oo` 讀長音（moon）。
- [ ] 一局 10 題，點 ai、ay、ea、ee、oa、ow、au、aw、ie、ew 或 oo。至少 7 題對才蓋印。
- [ ] 家長摘要有 8 行。錯題可以「重溫錯題」，答對後從錯題本消失。

### 手機

- [ ] 約 390×844。語音島地圖和字母沙灘的字可讀，選項按鈕高度夠手指按，頁面沒有橫向溢出。

## browser-check

`scripts/browser-check.mjs` 的 `runPhonics(page)` 在公式島步驟之後、旋轉回歸之前執行。野餐、刷牙、送貨的既有步驟沒有改。

先 `npm run build`，再執行：

```sh
node scripts/browser-check.mjs
```

腳本會啟動 `vite preview`（`http://127.0.0.1:4173/kids-game/`），並用本機 Chrome。它會：

1. 桌面 1024×768：刪掉 `kids-phonics-island-v1`，從 Hub 進入語音島，確認 8 個 `[data-phonics-zone]` 而且只有第 1 區未鎖。第 1 區教學後，用 `data-phonics-answer` 答對 10 題。`#phonicsResult` 為 `data-passed=true`、`data-stars=3`，第 2 區解鎖。重新載入後第 2 區仍解鎖。第 2 區答 2 題後按「選擇遊戲」回 Hub，沒有 page error。家長摘要第 1 區是 100%。
2. 用 `page.evaluate` 寫入 localStorage，令第 1–7 區已過關，再各完成第 6 區和第 8 區一輪全對。
3. 第 2 區全部答錯直到失敗，確認 `data-passed=false`，第 3 區的鎖與失敗前相同。
4. 手機 390×844：打開語音島和第 1 區，選項 `boundingBox` 高度至少 48，`document.documentElement.scrollWidth` 不大於 390。

截圖寫入 `browser-out/phonics-map.png`（桌面地圖）和 `browser-out/phonics-mobile.png`（手機第 1 區）。`browser-out/browser.log` 有一行 `phonics: 8 zones, Z1 3 stars, Z2 persists, Z1 100%, Z6 and Z8 cleared, Z2 fail keeps Z3, mobile ok`。

## 無回歸

野餐、打敗蛀牙蟲、送貨員來了、貼紙學單字、聽一聽揀圖這 5 個遊戲的玩法沒有改，`scripts/browser-check.mjs` 裡對應的野餐、刷牙、送貨步驟也沒有改。出遊順序卡和公式島同樣保持原樣。Vite 的 `base` 仍是 `/kids-game/`。

## 原創美術與品牌

小島、字母泡泡、口型、星星、鎖和印章都是這款遊戲自己的平面 SVG 和幾何圖形。沒有 JEI、JEI Pen、Brain Safari 的名稱、海報插畫或真人兒童照片。例字是通用的自然拼讀例子。
