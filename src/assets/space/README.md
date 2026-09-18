# 太空

參考 `IMG_5491 Large.jpeg` 的題材，以內建 ImageGen 生成。原始 PNG 為 1254 × 1254 RGBA，保留真正透明通道，未額外去背或改動像素。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `mercury` | 水星 |
| `venus` | 金星 |
| `earth` | 地球 |
| `mars` | 火星 |
| `jupiter` | 木星 |
| `saturn` | 土星 |
| `uranus` | 天王星 |
| `neptune` | 海王星 |
| `pluto` | 冥王星 |
| `black-hole` | 黑洞 |
| `astronaut` | 太空人 |
| `rocket` | 火箭 |
| `comet` | 彗星 |
| `ufo` | 飛碟 |
| `satellite` | 人造衛星 |
| `star` | 星星 |

各裁切框依實際輪廓加 6 px 留白，已登記於 `src/art/sprites.ts`，可透過 `GameSprite` 使用。生成日期：2026-09-18；最終生成檔：`exec-47317f0c-1759-42ea-89b3-9baf6564b00c.png`。參考照片只提供題材，書頁文字、版面和照片背景不納入素材。

處理狀態及照片 SHA-256 見 [reference-progress.json](../../art/reference-progress.json)。

照片中的太陽沿用既有 `sun` 素材，不重複生成。
