# 共用遊戲素材

三款遊戲共用 `GameSprite.vue`，角色、道具與場景都由 `sprites.ts` 登記。素材不依賴特定關卡、遊戲狀態或全域 SVG symbol；元件可直接放在一般網頁、按鈕、對話框或 SVG 棋盤裡。

## 使用方式

```vue
<script setup lang="ts">
import GameSprite from '../components/GameSprite.vue';
</script>

<template>
  <!-- 具語意的獨立圖片，提供螢幕閱讀器名稱 -->
  <GameSprite name="bear" label="小熊嚮導" width="80" height="80" />

  <!-- SVG 棋盤中的裝飾素材，不提供 label 即自動隱藏於輔助閱讀 -->
  <svg viewBox="0 0 600 400">
    <GameSprite name="tree" x="30" y="20" width="80" height="100" />
    <GameSprite name="car-top" x="200" y="180" width="100" height="66" />
  </svg>
</template>
```

`name` 有 TypeScript 型別檢查。`x`、`y`、`width`、`height`、`class` 及其他 SVG 屬性會傳入根元素；CSS 可以設定尺寸。元件保持原圖比例並裁掉圖集其餘部分。方向、動畫和遊戲規則由使用元件的畫面決定。

## 新增素材或遊戲

1. 將有真正透明背景的 PNG 放入 `src/assets/<主題>/`。也可使用單張圖片，不一定要製作圖集。
2. 在 `sprites.ts` 匯入圖片並登記 `atlases`：圖片網址、實際像素寬高。
3. 在 `sprites` 增加名稱、所屬 `atlas` 和 `frame: [x, y, width, height]`。單張圖片的 frame 就是 `[0, 0, 圖片寬, 圖片高]`。留少量透明邊界，避免裁掉描邊。
4. 在新遊戲直接使用 `<GameSprite name="新名稱" />`。既有名稱可跨遊戲使用，無須複製檔案或修改 GameSprite。
5. 執行 `npm test` 和 `npm run build`，再於手機與桌機檢查實際大小。測試會檢查圖片尺寸、透明通道和裁切範圍。

圖片由 Vite 匯入並產生版本化網址，會配合部署的 base path；同一圖集由瀏覽器快取共用。

## 目前素材

| 分類 | 名稱 |
| --- | --- |
| 角色 | `bear`, `courier`, `kid`, `kid-cheer`, `bug-coral`, `bug-purple`, `tooth` |
| 交通工具 | `car`（側面，用於封面）, `car-top`（俯視，用於棋盤轉向）, `truck`, `truck-top` |
| 道具 | `burger`, `toothbrush`, `parcel` |
| 場景 | `home`, `shop`, `park`, `picnic-place`（空場景）, `picnic`（完成場景） |
| 自然裝飾 | `tree`, `flower`, `sun` |

箭頭、音量、關閉等介面符號仍由 `IconDefs.vue` 和 `assets/icons.svg` 提供，使用 `currentColor` 配合介面。它們不屬於遊戲插畫素材。

## 視覺方向與來源

柔和童書插畫、暖色描邊、圓潤輪廓、清楚表情；角色在小尺寸下仍可辨認。三套原始 PNG 均由內建 ImageGen 生成，保留 alpha 通道。

- 野餐素材與生成提示詞：`../assets/picnic/README.md`
- 刷牙素材與生成提示詞：`../assets/tooth/README.md`

- 送貨素材與生成提示詞：`../assets/delivery/README.md`
