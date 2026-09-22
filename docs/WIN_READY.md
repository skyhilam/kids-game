# 通關等待（野餐、刷牙）

野餐與刷牙共用 `MazePlay` → `MazeOverlays` → `MazeDialog`。過關後角色先走完，卡片才打開。這段等待要留著。

走路途中光圈會暫時消失：見 `docs/APERTURE_PATH.md`（等 `data-path-ready`，不要在 TAP 後立刻要求下一圈）。

對齊 PR #14 **verdict B**：不要縮短 settle 或 `moveDuration`，也不要提早 `showModal`。提早打開（scheme C）要先問產品，這裡不做。

## 鉤子

只在過關拍子上：

| 時刻 | `data-win-ready` | `aria-busy` | 對話框 |
| --- | --- | --- | --- |
| 已判定過關，reveal 未到 | `false` | `true` | 關閉。`getByRole('dialog')` 找不到 |
| `showModal` 同一輪 | `true` | `false` | 打開。標題與兩個按鈕在無障礙樹裡 |

一般 reveal 是 **650ms**，`prefers-reduced-motion: reduce` 是 **100ms**。走路時間不變：減少動態 **80ms**，否則 `clamp(length * 3, 650, 1080)`。

`revealed` 在 `showModal` 之後發出。等 `[data-win-ready="true"]` 或等 `revealed` 都可以。歡迎、卡住、說明、救援沒有這兩個屬性。

最長一次點擊到卡片打開是長邊 **1080 + 650 = 1730ms**，不超過 3 秒。約 1.5 秒取樣會落在長邊的關閉拍子裡，不要用那個間隔。

## 檢查

過關且 win-ready 之後：

- `getByRole('dialog')`
- `#dialogTitle` 看得到。野餐是「已到達公園」，刷牙是「牙齒亮晶晶」
- `#nextBtn` 名稱是「下一關」；最後一關或全部完成時是「從頭再玩」
- `#replayBtn` 名稱正好是「再玩本關」
- 兩顆都可按。主按鈕最小高度 62px、寬 100%；「再玩本關」最小高度 49px

卡住時沒有 reveal 等待：

- `#retryBtn` 名稱含「再試一次」
- 按下後同一關從起點再走，可以繼續

## 劇本

- **W1** 第 1 關走到 win-ready，兩顆通關按鈕都在。
- **W2** 「再玩本關」連續三次，仍是這一關。
- **W3** 「下一關」進入下一關。最後一關的主按鈕是「從頭再玩」。
- **W4** 高關卡取樣要等 win-ready。從致勝那一步起 3 秒內會到；或直接等 `revealed` / `[data-win-ready="true"]`。
- **W5** 卡住後按「再試一次」，關卡恢復。
- **W6** 減少動態仍等 100ms 才 win-ready，走路時間不縮。
