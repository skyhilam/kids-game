# 超市與食材

參考 `IMG_5497 Large.jpeg` 的題材，以內建 ImageGen 生成。原始 PNG 為 1254 × 1254 RGBA，保留真正透明通道，未額外去背或改動像素。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `snack` | 零食 |
| `frozen-food` | 冷凍食品 |
| `drink-carton` | 飲料紙盒 |
| `apple` | 蘋果 |
| `banana` | 香蕉 |
| `carrot` | 紅蘿蔔 |
| `corn` | 玉米 |
| `watermelon` | 西瓜 |
| `bread` | 麵包 |
| `cabbage` | 高麗菜 |
| `fish` | 魚 |
| `meat` | 肉類 |
| `canned-food` | 罐頭 |
| `shopping-cart` | 購物車 |
| `checkout-counter` | 收銀台 |
| `eggs` | 雞蛋 |

各裁切框依實際輪廓加 6 px 留白，已登記於 `src/art/sprites.ts`，可透過 `GameSprite` 使用。生成日期：2026-09-18；最終生成檔：`exec-384d24de-fa5d-4656-a643-d36c3eea4586.png`。參考照片只提供題材，書頁文字、版面和照片背景不納入素材。

處理狀態及照片 SHA-256 見 [reference-progress.json](../../art/reference-progress.json)。

螃蟹、蝦和廚師沿用已有 `crab`、`shrimp`、`chef` 素材。
