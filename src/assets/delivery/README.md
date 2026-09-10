# 送貨透明插畫

由內建 ImageGen 生成的新素材，保留原始 PNG 與 alpha 通道；沒有手動移除背景或重新繪製。實際尺寸 1254 × 1254，RGBA。四個裁切框登記於 `src/art/sprites.ts`，以 `GameSprite` 在所有遊戲重用。

| 名稱 | 圖像 | 裁切框 x, y, width, height |
| --- | --- | --- |
| truck | 側面藍色送貨車 | 26, 125, 638, 408 |
| truck-top | 向右俯視送貨車 | 677, 125, 552, 368 |
| parcel | 紙箱包裹 | 53, 686, 580, 463 |
| courier | 小熊送貨員 | 784, 551, 420, 662 |

原始生成檔：`exec-38465400-e826-4f9a-9323-f69a355dd310.png`。

最終提示詞：

> Generate a transparent PNG game sprite atlas with real alpha transparency. 1024x1024 square divided into a 2 by 2 grid, four isolated illustrations with wide gutters and 30 pixel clear margins in each cell. Children's picture-book gouache style, soft rounded silhouettes, pastel natural colors, delicate cocoa outlines. Top left: sky blue delivery truck, side view facing right. Top right: blue delivery truck viewed directly from overhead, nose facing right, golden parcel in cargo bed. Bottom left: golden cardboard parcel tied with coral twine bow, blank label, no writing. Bottom right: smiling friendly bear courier standing, sage green cap, blue overalls, holding parcel. Fully visible, no overlaps, no crops, no scenery, no labels, no numbers, no lettering, no logo. True transparent pixels surrounding the four objects. No painted checkerboard, no solid background. High quality game illustration assets.
