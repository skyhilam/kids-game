# 海洋生物

參考 `IMG_5489 Large.jpeg`，使用內建 ImageGen 生成 16 款原創童書風格插畫。原始 PNG 為 1254 × 1254 RGBA，保留真正透明背景，不包含參考書頁的文字或版面。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `penguin` | 企鵝 |
| `whale` | 鯨魚 |
| `polar-bear` | 北極熊 |
| `dolphin` | 海豚 |
| `seal` | 海豹 |
| `octopus` | 章魚 |
| `sea-anemone` | 海葵 |
| `ray` | 魟魚 |
| `clownfish` | 小丑魚 |
| `seahorse` | 海馬 |
| `shark` | 鯊魚 |
| `jellyfish` | 水母 |
| `crab` | 螃蟹 |
| `starfish` | 海星 |
| `shrimp` | 蝦 |
| `coral` | 珊瑚 |

裁切框以實際輪廓加 6 px 留白，登記於 `src/art/sprites.ts`，可直接透過 `GameSprite` 使用。生成日期：2026-09-18；原始生成檔：`exec-160790d3-fba7-488a-83a8-4bdbf262808f.png`。圖片未經像素修改或額外去背。

處理狀態、照片 SHA-256 和驗證結果見 [reference-progress.json](../../art/reference-progress.json)。
