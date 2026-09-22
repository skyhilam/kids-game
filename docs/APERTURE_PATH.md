# 光圈路徑等待（野餐、刷牙 · 甲）

野餐與刷牙的可走光圈是 DOM `button.step-target`，掛在 `MazeBoard` 的 `#board` / `.board` 上。Android Chrome / UIAutomator 在點擊後立刻 dump，常會看到 **可走光圈為空**——那不是卡關，是走路動畫期間刻意拿掉按鈕。

對齊本調查 **verdict B**：不是觸控命中壞掉，也不是 #15/#16/#17 迴歸把關卡鎖死。真人與正確等待的自動化都能走完 L1 到 win-ready。不要為了 CUA 提早結束動畫或作弊通關。

## 為什麼 TAP 後 `cds=[]`

1. `requestMove` 一成功就設 `inFlight`；`interactive` 變成 `false`（`useGameSession`）。
2. `MazeBoard` 在 `!interactive` 時 `links = []`，**卸載**所有 `step-target`。
3. `.board.moving .step-target` 也會 `opacity:0; pointer-events:none`（雙重保險）。
4. 走路時間是 `moveDuration`：減少動態 **80ms**，否則 `clamp(length * 3, 650, 1080)` ms。
5. `settleFlight` 之後 `inFlight` 清空；若未卡住 / 未過關，下一組光圈再掛上。

因此「TAP 向下前往路口 / 前往路口 → 下一幀 dump 沒有 path btn」與產品設計一致。同一天較早的野餐最短煙霧（漢堡→公園）能 PASS，代表關卡與點擊鏈路可用；甲 FAIL 是 **等太短 / 把飛行中空樹當成死路**。

## 鉤子

| 時刻 | `data-path-ready` | `button.step-target` |
| --- | --- | --- |
| 歡迎 / 說明 / 卡住 / 過關卡疊在上、或走路中 | `false` | 0（不在無障礙樹） |
| 可玩且有出路 | `true` | ≥1；`aria-label` 見下 |

等 `[data-path-ready="true"]`（或等到出現 `step-target`）再找下一圈。不要在 TAP 後立刻要求下一顆光圈。

最長一步走路 **1080ms**。建議 TAP 後最多等約 **1.2s** 再取樣；或直接等 `data-path-ready="true"`。

## 名稱（L1）

- 野餐（預設方向前綴）：起點唯一光圈是 **「向下前往路口」**（`向{向}前往{路口}`）。
- 刷牙（`ToothBoard` 覆寫、無方向）：起點唯一光圈是 **「前往路口」**。

點完第一格後會再出現下一組（野餐常是「向…前往漢堡店」；刷牙是「前往終點」與「前往蛀牙蟲」等）。跟 hint / 解法走即可；過關後改等 `docs/WIN_READY.md` 的 `[data-win-ready="true"]`。

## 劇本（自動化）

- **P1** 關歡迎，等 `data-path-ready="true"`，picnic 見「向下前往路口」、tooth 見「前往路口」。
- **P2** TAP 該鈕；**立刻** dump 時允許 0 顆 path btn 且 `data-path-ready="false"`。
- **P3** 等 `data-path-ready="true"` 後再有 ≥1 顆 path btn；跟解法走到 win-ready（兩顆 CTA）。
- **P4** 窄螢幕（≤600）與桌面同一契約；Phaser canvas 是 `pointer-events: none`，點的是 DOM 鈕。
