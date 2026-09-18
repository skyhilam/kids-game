# 參考照片處理進度

**14／14 張已處理。新增 224 款透明素材，連同原有 22 款，共 246 款。**

一次只處理一張；完成圖片、登記、透明背景與裁切檢查、測試和建置後才標記已處理。原始照片保留不變。SHA-256、輸出與驗證詳情見 [reference-progress.json](reference-progress.json)。

| 參考照片 | 狀態 | 主題 | 新增素材 |
| --- | --- | --- | --- |
| IMG_5488 Large.jpeg | ✅ 已處理 | 農場動物 | 16 |
| IMG_5489 Large.jpeg | ✅ 已處理 | 海洋生物 | 16 |
| IMG_5490 Large.jpeg | ✅ 已處理 | 史前動物 | 16 |
| IMG_5491 Large.jpeg | ✅ 已處理 | 太空 | 16 |
| IMG_5492 Large.jpeg | ✅ 已處理 | 樂器 | 16 |
| IMG_5493 Large.jpeg | ✅ 已處理 | 職業人物 | 16 |
| IMG_5494 Large.jpeg | ✅ 已處理 | 花園 | 16 |
| IMG_5495 Large.jpeg | ✅ 已處理 | 城市建築 | 16 |
| IMG_5496 Large.jpeg | ✅ 已處理 | 醫院用品 | 16 |
| IMG_5497 Large.jpeg | ✅ 已處理 | 超市與食材 | 16 |
| IMG_5498 Large.jpeg | ✅ 已處理 | 餐廳餐點 | 16 |
| IMG_5499 Large.jpeg | ✅ 已處理 | 火車站 | 16 |
| IMG_5500 Large.jpeg | ✅ 已處理 | 工地機具 | 16 |
| IMG_5501 Large.jpeg | ✅ 已處理 | 學校用品 | 16 |

全部圖片已透過內建 ImageGen 生成並加入 `GameSprite` 登記。224 個新裁切框已核對完整輪廓、真正透明背景及相鄰素材隔離。135 項測試、正式建置、桌機與手機預覽均通過。

執行 `npm run sprites:status` 可重新以實際來源及輸出雜湊核對狀態。圖片儲存位置及完整提示詞見 [素材索引](README.md#視覺方向與來源)。
