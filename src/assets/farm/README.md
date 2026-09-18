# 農場動物

參考 `IMG_5488 Large.jpeg` 的動物主題，以內建 ImageGen 重新繪製為專案的柔和童書風格。照片只用作題材參考；書頁文字、版面及照片背景不納入素材。

`sprites.png` 是 1254 × 1254 RGBA 原始生成圖片，保留真正透明通道。16 款動物已登記於 `src/art/sprites.ts`，每個裁切框保留約 8 px 邊界，可直接使用 `GameSprite`。

| 名稱 | 動物 |
| --- | --- |
| `sheep` | 綿羊 |
| `dog` | 狗 |
| `squirrel` | 松鼠 |
| `rabbit` | 兔子 |
| `donkey` | 驢子 |
| `pig` | 豬 |
| `cow` | 乳牛 |
| `bird` | 小鳥 |
| `horse` | 馬 |
| `cat` | 貓 |
| `mouse` | 老鼠 |
| `duck` | 鴨子 |
| `tortoise` | 陸龜 |
| `frog` | 青蛙 |
| `chicken` | 雞 |
| `chick` | 小雞 |

生成日期：2026-09-18。完整初始提示詞見 [prompt.txt](prompt.txt)，最終調整留白的提示詞見 [spacing-prompt.txt](spacing-prompt.txt)。最終生成檔：`exec-e7b5f703-3bbb-4dcd-b5d2-f67a68825301.png`。沒有使用 CLI 生成、手動去背或改動像素。

處理狀態、參考照片 SHA-256 及驗證結果統一記錄在 [reference-progress.json](../../art/reference-progress.json)。
