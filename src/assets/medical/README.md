# 醫院用品

參考 `IMG_5496 Large.jpeg` 的題材，以內建 ImageGen 生成。原始 PNG 為 1254 × 1254 RGBA，保留真正透明通道，未額外去背或改動像素。完整提示詞見 [prompt.txt](prompt.txt)。

| 名稱 | 題材 |
| --- | --- |
| `wheelchair` | 輪椅 |
| `iv-stand` | 點滴架 |
| `hospital-bed` | 病床 |
| `medical-record` | 病歷 |
| `medical-mask` | 口罩 |
| `bandage` | 繃帶 |
| `medicine-bottle` | 藥瓶 |
| `x-ray` | X 光片 |
| `stethoscope` | 聽診器 |
| `patient` | 病人 |
| `crutches` | 拐杖 |
| `thermometer` | 體溫計 |
| `syringe` | 針筒 |
| `tweezers` | 鑷子 |
| `cotton-balls` | 棉花球 |
| `medical-cart` | 醫療推車 |

各裁切框依實際輪廓加 6 px 留白，已登記於 `src/art/sprites.ts`，可透過 `GameSprite` 使用。生成日期：2026-09-18；最終生成檔：`exec-beb192d3-72ae-4f85-82a7-00347ee1c5b1.png`。參考照片只提供題材，書頁文字、版面和照片背景不納入素材。

處理狀態及照片 SHA-256 見 [reference-progress.json](../../art/reference-progress.json)。

照片中的醫生、護士沿用 `doctor`、`nurse`，不重複製作角色。
