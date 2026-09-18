# 城市建築

參考 `IMG_5495 Large.jpeg` 的題材，以內建 ImageGen 生成。原始 PNG 為 1254 × 1254 RGBA，保留真正透明通道，未額外去背或改動像素。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `parking-lot` | 停車場 |
| `department-store` | 百貨公司 |
| `gas-station` | 加油站 |
| `library` | 圖書館 |
| `grocery-store` | 雜貨店 |
| `fire-station` | 消防局 |
| `bakery` | 麵包店 |
| `playground` | 遊樂場 |
| `hair-salon` | 理髮店 |
| `hospital` | 醫院 |
| `pharmacy` | 藥局 |
| `bank` | 銀行 |
| `bookstore` | 書店 |
| `gym` | 體育館 |
| `post-office` | 郵局 |
| `fire-hydrant` | 消防栓 |

各裁切框依實際輪廓加 6 px 留白，已登記於 `src/art/sprites.ts`，可透過 `GameSprite` 使用。生成日期：2026-09-18；最終生成檔：`exec-a18c0c86-54ab-4262-9022-7f10076cbc35.png`。參考照片只提供題材，書頁文字、版面和照片背景不納入素材。

處理狀態及照片 SHA-256 見 [reference-progress.json](../../art/reference-progress.json)。
