# 月餅迴紋針 · Mooncake Maximizer

以中秋為主題的純前端增量遊戲。目前完成 `SPEC.md` 的 Act I「人間製餅坊」，使用 React、TypeScript、Vite 與 Vitest。

## 本機執行

```sh
npm ci
npm run dev
```

正式建置與 Cloudflare Workers 本機預覽：

```sh
npm run build
npm run worker:dev
```

`wrangler.toml` 提供 `dist/` 靜態資產；目前沒有 API、排行榜或 CTF 端點。正式部署可在完成 Cloudflare 登入與帳號設定後執行 `npm run deploy`。

## 玩法與本次範圍

- 手動壓模、購買自動壓模機、補充麵粉、調整售價與升級行銷。
- 月相影響需求，中秋前後有額外需求加成；頁面顯示月相及中秋倒數。
- 累計售出 2,000 顆後解鎖玉兔搗藥台提示並記錄轉場，Act I 經濟繼續運作。
- Act II 專案樹與 Act III 尚未實作。自動採購的核心邏輯已預留，但新局不會解鎖；麵粉加成同樣供未來專案使用。
- 遊戲每 100 ms 更新一次，每幀最多補算 50 次。背景分頁暫停，不計離線收益。
- 每 10 秒及分頁隱藏時自動存檔；支援手動存檔、JSON 匯出／匯入與二次確認重新開始。
- 存檔 key 為 `mooncake-save-v1`，目前 schema 為 v4，支援舊版本遷移。舊存檔中的月餅庫存與累計銷量小數會退回麵粉，既有現金保留；生產與銷售的小數進度另行保存。損毀的本機存檔會開啟新局並留下提示；非法匯入不會覆蓋正在玩的進度。

所有核心狀態集中在 `GameState`，由純函數 `apply`／`tick` 更新；瀏覽器 I/O 位於 `src/runtime/store.ts`，React 介面位於 `src/ui/`。

## 驗證

```sh
npm run typecheck
npm test
npm run build
```

測試涵蓋核心生產與经济、決定性亂數、麵粉守恆、月相、轉場、存檔遷移與驗證、固定步長補算，以及瀏覽器存檔 adapter。目前未配置 lint 或 formatter 指令。

## 限制

遊戲狀態與存檔完全由客戶端持有，可以被修改；本專案不宣稱能真正防作弊。目前尚未提供排行榜、完整成就系統或 CTF 挑戰。
