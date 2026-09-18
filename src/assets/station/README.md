# 火車站

參考 `IMG_5499 Large.jpeg` 的題材，以內建 ImageGen 生成。原始 PNG 為 1254 × 1254 RGBA，保留真正透明通道，未額外去背或改動像素。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `train` | 火車 |
| `stairs` | 樓梯 |
| `timetable` | 時刻表 |
| `conductor` | 列車長 |
| `station-staff` | 站務員 |
| `route-map` | 路線圖 |
| `ticket-machine` | 售票機 |
| `platform` | 月台 |
| `ticket-gate` | 驗票閘門 |
| `station-hall` | 車站大廳 |
| `lockers` | 置物櫃 |
| `restroom` | 洗手間 |
| `passenger` | 乘客 |
| `railway-track` | 鐵軌 |
| `escalator` | 電扶梯 |
| `ticket-counter` | 售票窗口 |

各裁切框依實際輪廓加 6 px 留白，已登記於 `src/art/sprites.ts`，可透過 `GameSprite` 使用。生成日期：2026-09-18；最終生成檔：`exec-9d966fea-d76e-4930-bcd0-c3434c514fbe.png`。參考照片只提供題材，書頁文字、版面和照片背景不納入素材。

處理狀態及照片 SHA-256 見 [reference-progress.json](../../art/reference-progress.json)。
