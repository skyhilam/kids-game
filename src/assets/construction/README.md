# 工地機具

參考 `IMG_5500 Large.jpeg` 的題材，以內建 ImageGen 生成。原始 PNG 為 1254 × 1254 RGBA，保留真正透明通道，未額外去背或改動像素。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `bulldozer` | 推土機 |
| `cement-truck` | 水泥車 |
| `loader` | 裝土機 |
| `dump-truck` | 砂石車 |
| `excavator` | 挖土機 |
| `road-roller` | 壓路機 |
| `forklift` | 堆高機 |
| `construction-building` | 施工建築 |
| `traffic-cone` | 交通錐 |
| `crane` | 吊車 |
| `hard-hat` | 安全帽 |
| `jackhammer` | 鑽地機 |
| `hammer` | 鐵鎚 |
| `flashlight` | 手電筒 |
| `blueprint` | 工程藍圖 |
| `bricks` | 磚塊 |

各裁切框依實際輪廓加 6 px 留白，已登記於 `src/art/sprites.ts`，可透過 `GameSprite` 使用。生成日期：2026-09-18；最終生成檔：`exec-888d7286-d723-41ce-a04b-c049db317acd.png`。參考照片只提供題材，書頁文字、版面和照片背景不納入素材。

處理狀態及照片 SHA-256 見 [reference-progress.json](../../art/reference-progress.json)。

堆高機與施工建築的最終間距修正見 [correction-prompt.txt](correction-prompt.txt)。工程師沿用 `engineer`。
