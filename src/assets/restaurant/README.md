# 餐廳餐點

參考 `IMG_5498 Large.jpeg` 的題材，以內建 ImageGen 生成。原始 PNG 為 1254 × 1254 RGBA，保留真正透明通道，未額外去背或改動像素。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `pizza` | 披薩 |
| `juice` | 果汁 |
| `hot-dog` | 熱狗 |
| `ice-cream` | 冰淇淋 |
| `fries` | 薯條 |
| `cake` | 蛋糕 |
| `pudding` | 布丁 |
| `fried-rice` | 炒飯 |
| `dumplings` | 水餃 |
| `spaghetti` | 義大利麵 |
| `steak` | 牛排 |
| `milk` | 牛奶 |
| `salad` | 沙拉 |
| `sandwich` | 三明治 |
| `menu` | 菜單 |
| `cutlery` | 餐具 |

各裁切框依實際輪廓加 6 px 留白，已登記於 `src/art/sprites.ts`，可透過 `GameSprite` 使用。生成日期：2026-09-18；最終生成檔：`exec-77a5e2a7-1575-4be9-8f89-af876c7f9cdb.png`。參考照片只提供題材，書頁文字、版面和照片背景不納入素材。

處理狀態及照片 SHA-256 見 [reference-progress.json](../../art/reference-progress.json)。

水餃外型的最終修正提示詞見 [correction-prompt.txt](correction-prompt.txt)。漢堡與收銀台沿用 `burger`、`checkout-counter`。
