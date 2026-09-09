# 一起去野餐｜Vue 3 + TypeScript 小遊戲

**現在就玩：** https://game1.iclover.net/kids-game/

iPad／iPhone：用 **Safari** 打開上面網址即可。按分享鈕 →「加入主畫面」，之後可以像 App 一樣全螢幕玩。請不要用 WhatsApp／WeChat 內置預覽開啟，那些預覽多數唔會執行遊戲程式。

`https://skyhilam.github.io/kids-game/` 會自動轉去同一個遊戲。

## 開始玩
電腦：用瀏覽器開啟 [線上版本](https://game1.iclover.net/kids-game/)，或本機開啟 `index.html`，按「出發啦！」。
手機／平板：建議用 Safari／Chrome 開啟上述網址。部分聊天軟件或檔案預覽不會執行 HTML 入面嘅 JavaScript。

## 玩法
點一下發光圓圈，小車會自動沿小路行到下一個路口。
亦可以由小車向相鄰光圈輕掃；電腦可用方向鍵。
必須先到漢堡店，再到公園。走過嘅路會變橙色，同一段路不能再行，包括反方向。
行到盡頭或未買漢堡就到公園，會有溫柔提示，可以重新出發。冇計時、冇扣分。
「提一提」會找出仍可完成任務嘅路線，將下一步變成綠色光圈；已無解時提供重新出發選項。

## 三個小關卡
1. 跟住小路走：熟習點選操作，沿路自動買漢堡。
2. 記得買漢堡：辨認通往漢堡店嘅路，學習先後次序。
3. 小小探路家：探索有分岔同盡頭嘅小路。
右上角「？」可選關卡及查看陪玩說明。
地圖按提供相片嘅任務和規則重新繪製，唔係原書迷宮逐線複製。

## 網站部署
已用 GitHub Pages 公開於 https://game1.iclover.net/kids-game/ （`skyhilam.github.io/kids-game` 會轉去呢度）。
將 `index.html` 放入網站任意公開目錄即可。
純靜態檔案，毋須安裝套件、編譯、後端或資料庫。
本機亦可在此目錄執行：

    python3 -m http.server 8080

然後用瀏覽器開啟 http://localhost:8080 。

## 聲音、私隱與離線
所有畫面、程式同音效均包含喺 HTML 內，冇外部資源請求、廣告、追蹤器或登入。
遊戲本身可離線運作，不保存個人資料，重新載入會由第一關開始。
音效可用右上角喇叭關閉。
粵語旁白使用瀏覽器提供嘅廣東話語音；裝置冇該語音時，自動保留圖示、文字同音效，不會改用普通話朗讀粵語。
裝置語音能否離線運作，視乎裝置有冇下載對應語音。

## 技術
Vue 3 + TypeScript + Vite。畫面、關卡地圖同原創 SVG 插圖（`art-bear`、`art-car`、`art-burger`、`art-shop`、`art-home`、`art-park`、`art-picnic`、`art-picnic-place`、`art-tree`、`art-flower`）都保留。
支援觸控、滑鼠、方向鍵，響應式手機／平板版面及減少動態效果設定。
遊戲規則（無向路段、先漢堡後公園、提示搜尋）喺 `src/game/`，可用 `npm test` 驗證。
公開 repo 嘅 `main` 已禁止 force-push／刪除分支，Wiki 關閉。

本機開發：

    npm install
    npm test
    npm run dev

正式檔由 GitHub Actions 建置並發佈到 GitHub Pages。
