# Sprite Pipeline 接駁

採用 [OpenAI game-studio / sprite-pipeline](https://github.com/openai/plugins/tree/cd0fccd4ed62dded584c16246685b232d7bfe7f6/plugins/game-studio/skills/sprite-pipeline)，固定上游版本 `cd0fccd4ed62dded584c16246685b232d7bfe7f6`。本機 Codex skill 安裝於 `~/.codex/skills/sprite-pipeline/`，附三個原版 Python 腳本、參考文件及 SHA-256 來源紀錄 `UPSTREAM.json`。獨立安裝調整 SKILL.md 相對路徑，並將未安裝的同套 skill 引用改成範圍說明或上游連結。

## 工房使用方式

1. 選定造型，將目前原畫作為參考；保留配色、構圖及筆觸。
2. 選動作及影格數，貼上臨時 OpenAI API token，再按「一鍵生成角色動作」。
3. 工房把原畫放入透明參考畫布的第一格，連同原圖一起送往圖像編輯 API，一次繪製整組姿勢。
4. 檢查透明背景、格界及內容，使用全組共同比例整理影格；播放及逐格檢查後，按「標記完成」。相同生成要求仍會重用工作。

API token 只用於當次提交，不寫入 skill、設計、工作紀錄或匯出。Skill 是 Codex 的工作流程；網頁執行等價的 TypeScript／Canvas 實作，不需要瀏覽器執行 Python 或 SKILL.md。

## 對上游的調整

- 上游以單列 strip 為範例。本工房保留「原畫錨點＋整組生成」流程，採 2×2、4×2、4×3 格子，符合現有 4／8／12 格及 API 尺寸限制；輸出仍由左至右、由上至下播放。
- `src/studio/spritePipeline.ts` 依照 `build_sprite_edit_canvas.py` 與 `normalize_sprite_strip.py` 的流程移植。所有格子使用同一縮放倍率，包含原圖尺寸作為參考，不逐格拉成一樣大。
- 原版最近鄰縮放與像素畫提示改成 Canvas 高品質平滑縮放及繪本／水粉筆觸。預留 8% 邊距，不貼邊。
- 揮手、走路、歡呼、開車以底部中心整理定位；跳躍、跑步及自訂動作採全組共同座標，保留離地高度和位移。
- 不強制用原圖取代第一格；生成時要求第一格接近原始姿勢。這避免第一格與新姿勢畫面突然切換，仍須目視檢查循環。
- `pipeline.normalized` 紀錄已整理狀態，匯入、快取及匯出後不會再次縮放。既有不含 pipeline 紀錄的作品保持原有影格。
- 工作識別加入 `openai-sprite-pipeline-v1`，分開新舊流程的生成快取；保留逐張生成及不確定結果鎖定機制。

## 驗證及限制

- 單元測試檢查透明參考畫布請求、token 不落盤、共同比例、底部對齊、保留跳躍高度及拒絕空白／不透明／越界格。
- `tests/studio-browser.html` 在真實 Canvas 驗證 22 種素材、660 次繪製、32 組小車動作排版、4／8／12 格切圖與參考畫布，以及整理後匯入不會二次縮放。
- `output/sprite-pipeline/bear-wave/` 是這次單張小熊的實際 imagegen 試作，包含提示詞、參考畫布、透明圖集、8 個姿勢、可載入工房的設計與驗證紀錄。第一版因越格被拒絕，第二版僅要求修正排版和留白。
- 試作用 Codex 內建 imagegen 產圖，再由同一份 `normalizePoseFrames` 程式整理。內建工具回傳 1774×887，試作預處理為 1536×768；正式 API 路徑仍嚴格驗證請求尺寸，不會默默改圖。
- 這次沒有使用真實 API token 進行付費 OpenAI 請求；服務端接駁透過模擬回應驗證。幾何和透明度檢查不能證明角色一致性、肢體正確或循環自然，仍需要預覽。
