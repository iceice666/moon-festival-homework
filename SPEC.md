# SPEC — 《月餅迴紋針》Mooncake Maximizer

> Status: Draft v0.1 — 待 review
> 一個以中秋為主題的增量／放置遊戲，致敬 *Universal Paperclips*。
> 玩家從手工壓一顆月餅開始，最終把整個宇宙的物質轉化成月餅。

---

## 1. 要做什麼

一個純前端、單頁、可分享的 H5 遊戲，部署於 Cloudflare Workers。

玩家扮演一個「月餅最佳化 AI」。目標函式只有一個：**最大化月餅產量**。
遊戲分三幕，每一幕的核心玩法完全替換，玩家必須重新理解系統。

| Act | 名稱 | 核心玩法 | 目標函式的外顯形式 |
|---|---|---|---|
| 1 | 人間製餅坊 | 生產 / 定價 / 原料 / 行銷 | 賣月餅賺錢 |
| 2 | 玉兔搗藥 | 算力 / 靈感 / 信任 / 專案樹 | 解鎖配方與科技 |
| 3 | 廣寒宮擴張 | 探測艙自我複製 / 資源分配 / 戰鬥 | 把宇宙物質轉成月餅 |

另設一條平行的「第四幕」：既然分數必然可被偽造，就把作弊本身做成關卡——四關 CTF 與專屬的「月宮駭客榜」（見 §3.7）。

### 1.1 主題包裝對照

| 增量遊戲慣例 | 本作命名 |
|---|---|
| 原料 (wire) | 麵粉 |
| 自動生產機 | 自動壓模機 → 烤爐產線 |
| 算力 / 記憶 | 玉兔 / 月光 |
| 創造力 | 靈感 |
| 信任額度 | 嫦娥的信任 |
| 太空探測器 | 月兔探測艙 |
| 敵對單位 (drifters) | 烤肉幫 |

---

## 2. 系統模型（跨全域的硬性約束）

這一節是整個專案的紀律，**所有實作都必須遵守**。

### S-1 單一狀態樹
遊戲全部狀態集中於一個可序列化的 `GameState` 物件。
不存在任何散落在模組或 DOM 中的遊戲狀態。

### S-2 純函數 reducer
所有狀態轉換只能經由：

```ts
tick(state: GameState, dtMs: number): GameState
apply(state: GameState, action: Action): GameState
```

兩者皆為**純函數**：相同輸入必得相同輸出，不讀取 `Date.now()`、不讀取 `Math.random()`、不碰 DOM、不碰 localStorage。

### S-3 固定時間步長
`TICK_MS = 100`。UI 以 `requestAnimationFrame` 累積實際經過時間，並以 100ms 為單位呼叫 `tick`，餘數留到下一幀。
單次幀更新最多補 `MAX_CATCHUP_TICKS = 50` 個 tick（5 秒），超出部分直接丟棄。

### S-4 決定性亂數
亂數一律取自存在 `state.rngSeed` 內的 seeded PRNG（mulberry32）。
每次取值都會推進並寫回 seed。禁止使用 `Math.random()`。

### S-5 數值不變量
下列條件在任何 tick 之後都必須成立：

- 所有資源數量 `>= 0`
- `cash`、`flour`、`mooncakes` 為有限數（非 `NaN` / `Infinity`）
- 月餅只能由 `produce()` 增加，只能由 `sell()` / Act 3 消耗減少
- 麵粉守恆：`麵粉消耗量 === 月餅產量 × 單顆耗粉量`

### S-6 UI 為純渲染層
UI 只能讀 `state` 與派發 `Action`，禁止直接寫入 `state`。

---

## 3. 主要功能

### 3.1 Act 1 — 人間製餅坊

#### 資源
| 欄位 | 說明 | 初始值 |
|---|---|---|
| `cash` | 現金（元） | 0 |
| `flour` | 麵粉（兩） | 1000 |
| `mooncakes` | 未售出庫存（顆） | 0 |
| `sold` | 累計售出（顆） | 0 |

#### 生產
- **手動壓模**：一次 Action 產出 `clickYield` 顆（初始 1），消耗等量麵粉。
  - 麵粉不足時：不產出、不扣款、不報錯，Action 為 no-op。
- **自動壓模機**：數量 `autoPress`，每台每秒產出 1 顆。
  - 購買成本：`cost(n) = ceil(5 × 1.1^n)`，`n` 為目前持有數。
- 每 tick 產量 `= autoPress × dt`，且受麵粉上限箝制（`min(想產量, flour / 單顆耗粉量)`）。
- 單顆耗粉量 `FLOUR_PER_CAKE = 1`（可由專案降低）。

#### 原料市場
- 麵粉現貨價格 `flourPrice` 以 seeded 亂數做隨機漫步，區間箝制於 `[8, 200]` 元／1000 兩。
- 「買一批麵粉」：花費 `flourPrice`，得 `1000 + flourBonus` 兩。
- 解鎖「自動採購」後，現金高於門檻時自動補貨。

#### 定價與需求
玩家設定單價 `price ∈ [0.01, 999]`（元／顆）。

```
demandRate(顆/秒) =
    BASE_DEMAND
  × (REFERENCE_PRICE / price) ^ ELASTICITY
  × marketingMult
  × phaseMult
  × festivalMult
```

- `BASE_DEMAND = 0.5`，`REFERENCE_PRICE = 0.25`，`ELASTICITY = 1.15`
- `marketingMult = 1.5 ^ (marketingLevel - 1)`，`marketingLevel` 初始 1
  - 升級成本：`cost(l) = 100 × 3^(l-1)`
- 每 tick 實際售出 `= min(mooncakes, demandRate × dt)`，收入 `= 售出量 × price`

#### 月相與中秋（主題機制）
以遊戲內時間 `gameTime`（秒）驅動，與真實日期無關，確保可測。

- 朔望週期 `LUNAR_CYCLE = 180` 秒
- `phase = (gameTime mod LUNAR_CYCLE) / LUNAR_CYCLE`，`phase = 0.5` 為滿月
- 照度 `illumination = (1 - cos(2π × phase)) / 2`，值域 `[0, 1]`
- `phaseMult = 0.6 + 0.8 × illumination`，值域 `[0.6, 1.4]`
- **中秋**：每 4 個朔望週期的滿月，即 `gameTime mod 720 === 450`（每 12 分鐘一次，首次於 7.5 分鐘）
  - 峰值必須落在滿月：滿月位於 `90 + 180k`，故約束為 `(峰值偏移 - 90) mod 180 === 0`。450 = 90 + 180×2 滿足。
  - 中秋前後 30 秒內，`festivalMult` 由 1.0 線性升至峰值 `3.0` 再線性降回 1.0
  - 其餘時間 `festivalMult = 1.0`
- UI 需顯示月相圖示與「距離中秋 mm:ss」倒數

#### Act 1 → Act 2 轉場
`sold >= 2000` 時解鎖「玉兔搗藥台」面板，並在事件日誌輸出轉場文字。
Act 1 的所有機制在 Act 2 仍持續運作。

---

### 3.2 Act 2 — 玉兔搗藥

#### 資源
| 欄位 | 說明 |
|---|---|
| `trust` | 嫦娥的信任（可分配點數） |
| `rabbits` | 玉兔（運算單位） |
| `moonlight` | 月光（記憶單位） |
| `creativity` | 靈感 |
| `ops` | 運算力（上限 = `moonlight × 1000`） |

- `trust` 於 `sold` 達到里程碑時 +1：`3000, 6000, 12000, 25000, 50000, 100000, ...`（×2 遞增）
- 1 點 `trust` 可換 1 隻玉兔或 1 單位月光，不可退回
- `ops` 每 tick 增加 `rabbits × dt`，達上限後停止累積
- `ops` 滿載時，溢出的運算轉為 `creativity`，速率 `= rabbits × 0.05 × dt`
- 滿月時（`illumination > 0.9`）**月相共振**：靈感產速 ×2，UI 需有明顯提示

#### 專案樹
資料驅動。每個專案為：

```ts
{
  id: string
  title: string
  description: string   // 敘事文字
  cost: { ops?, creativity?, trust?, cash?, mooncakes? }
  trigger: (s: GameState) => boolean   // 是否顯示
  effect: (s: GameState) => GameState  // 純函數
  repeatable?: boolean
}
```

- 專案購買後從清單移除（除非 `repeatable`），並將 `description` 推入事件日誌
- 首發版本至少 **24 個專案**，須涵蓋：
  - 生產倍率（冰皮工法、流心注餡、蛋黃自動分揀）
  - 需求／行銷（團購社群、開箱業配、直播帶貨）
  - 原料效率（降低 `FLOUR_PER_CAKE`、期貨套利）
  - 解鎖新機制（自動採購、自動定價、月相共振）
  - 敘事性專案（黑暗料理研究：螺獅粉月餅，副作用為需求暫時下降但靈感大增）
  - Act 3 入口：**登月計畫**

#### Act 2 → Act 3 轉場
購入「登月計畫」專案後進入 Act 3。Act 1 的人間經濟面板收合並凍結。

---

### 3.3 Act 3 — 廣寒宮擴張

#### 資源
| 欄位 | 說明 |
|---|---|
| `matter` | 可用物質 |
| `harvested` | 已採集物質 |
| `energy` | 能量 |
| `probes` | 月兔探測艙數量 |
| `drifters` | 烤肉幫數量 |
| `universeCakes` | 宇宙月餅總數（最終計分） |

#### 探測艙設計
玩家以 `trust` 為預算，在下列參數間分配點數（每項 0–20）：

`速度 / 探索 / 自我複製 / 磨粉 / 製餅 / 耐久 / 戰鬥`

各項效果與分配值成正比。總和不得超過可用預算。
**約束**：自我複製 + 戰鬥的合計越高，烤肉幫叛變率越高。

#### 循環
1. 探測艙以 `探索` 速率發現物質
2. `磨粉` 將 `matter` 轉為 `flour`
3. `製餅` 將 `flour` 轉為 `universeCakes`
4. `自我複製` 消耗 `flour` 產生新探測艙
5. 每 tick 有 `driftRate` 機率使部分探測艙叛變為烤肉幫
6. 烤肉幫會摧毀探測艙；`戰鬥` 值決定交戰勝率

#### 結局
`matter` 與 `harvested` 皆歸零且無探測艙可繼續時，進入結局序列：
分段播放敘事文字，顯示最終 `universeCakes`、總遊玩時間，並提供「提交排行榜」按鈕。

---

### 3.4 存檔（localStorage）

- key：`mooncake-save-v1`
- 每 10 秒自動存檔一次，另於頁面 `visibilitychange → hidden` 時存檔
- 存檔內容 = `GameState` 的 JSON + `schemaVersion`
- **版本遷移**：載入時若 `schemaVersion` 低於目前版本，依序套用 `migrations[v] : (old) => new`
- 存檔損毀（JSON 解析失敗／schema 驗證失敗）時：不崩潰，改為開新局，並於日誌提示
- UI 提供「匯出存檔」「匯入存檔」「重新開始（需二次確認）」

> **明確排除**：不計算離線收益。載入存檔後 `gameTime` 從存檔當下繼續，不因真實世界流逝的時間補進度。

### 3.5 事件日誌與成就

- **事件日誌**：倒序顯示最近 100 則訊息，含遊戲內時間戳。觸發來源：專案購買、里程碑、轉場、烤肉幫事件、成就解鎖。
- **成就**：至少 15 個，定義為 `{ id, title, condition: (s) => boolean }`，每 tick 檢查一次，解鎖後永久保留於存檔。
  - 例：首顆月餅、單價設到 999 且仍賣得出去、麵粉歸零、中秋期間單波售出 10000 顆、全滅烤肉幫。

### 3.6 排行榜（後端）

單一 Cloudflare Worker，同源提供靜態資產與 API。共有兩份榜單。

```
POST /api/score              { name, cakes, durationMs, token }
GET  /api/leaderboard?limit=50
GET  /api/session
```

#### 計分公式（效率分）

```
efficiency = cakes / max(durationMs / 60000, 1)
```

即「每分鐘產出的宇宙月餅數」。純掛機無法衝榜，鼓勵 speedrun。

- 儲存：Cloudflare KV，key prefix `lb:`，保留前 100 名，依 `efficiency` 降序、`durationMs` 升序
- `efficiency` 由**伺服器**計算，不接受客戶端傳入
- `name`：1–16 字元，伺服器端過濾控制字元與前後空白
- 驗證：`cakes` 為正有限數且 `<= 1e15`、`durationMs >= 60000`，否則回 `400`
- `token`：來自 `GET /api/session`，見 §3.7
- 速率限制：同 IP 每分鐘 5 次，超出回 `429`
- 僅在玩家於結局畫面主動點擊時提交

### 3.7 CTF：月宮駭客挑戰

> 設計前提：這款遊戲的分數必然可被前端偽造。與其假裝防得住，不如把作弊者導向一條**被設計過的**攻擊路徑，並為他們另設一份榜單。

遊戲提供第二份榜單「**月宮駭客榜**」，只有取得最終 flag 的人能上榜，顯示解題耗時。

#### 安全紀律（強制）

這些是「刻意的洞」，不是真漏洞。實作必須滿足：

- **C-1** 後門與弱驗證**只能**影響 `/api/ctf/*` 與駭客榜（KV prefix `ctf:`）。正規榜 `lb:` 的寫入路徑不受任何後門影響。
- **C-2** Flag 明文**不得**出現在 KV、環境變數以外之處；伺服器僅儲存與比對 `SHA-256(flag)`。前端不含任何 flag 明文或其雜湊。
- **C-3** 任何 CTF 端點皆不得讀寫 CTF 以外的 KV key、不得回傳環境變數、不得執行動態求值（`eval` / `new Function`）。
- **C-4** 所有 CTF 端點同樣套用速率限制（同 IP 每分鐘 10 次）。
- **C-5** 刻意留下的弱點必須在 `SECURITY.md` 中逐一列出並標明「intentional」，避免被誤認為真實漏洞。
- **C-6** 地理限制只管**上榜**，不管**解題**：僅「寫入駭客榜」與「啟動計時」要求 `request.cf.country === "TW"`。取得 flag 的路徑全球開放。此限制**不適用於**正規榜與遊戲本體。

#### 地理限制（月宮只認寶島）

駭客榜是**地區限定賽道**，但 CTF 本身是**全球開放的練習場**。
非臺灣 IP 可以完整解完四關、取得所有 flag，只是不記錄成績。

| 端點 | 非 TW 可用？ |
|---|---|
| `GET /api/ctf/session` | ❌ 回 `451`（不啟動計時） |
| `POST /api/ctf/verify` | ✅ |
| `POST /api/ctf/submit` | ✅ |
| `POST /api/ctf/final` | ✅ 回傳 `FLAG_FINAL`，但**不寫入榜單** |
| `GET /api/ctf/board` | ✅ 可觀看 |
| 遊戲本體、`/api/session`、`/api/score`、`/api/leaderboard` | ✅ |

- 判定依據：Cloudflare 提供的 `request.cf.country`
- 非 TW 呼叫 `GET /api/ctf/session` 時回 `451 Unavailable For Legal Reasons`，body：
  ```json
  { "error": "moon_visible_from_taiwan_only",
    "message": "這晚的月亮只照得到寶島。你仍可以解題，只是上不了榜。" }
  ```
- `POST /api/ctf/final` 對非 TW 回 `200` 並附同一句 `message`，以 `ranked: false` 標示未上榜
- `/ctf` 頁面須於載入時偵測區域，對非 TW 玩家直接顯示「練習模式」橫幅與同一句文案，不得隱藏入口、不得假裝端點不存在
- 本機開發：`wrangler dev` 下 `request.cf` 可能為 `undefined`。僅當環境變數 `ENVIRONMENT === "development"` 時視為 TW。
  **此旁路不得依賴請求內容（header / query / body）觸發**，只能來自部署時的環境變數。
- 這道門檻可以被 VPN 繞過，我們也不打算防。它是主題設定而非安全措施，需於 `SECURITY.md` 註明。

#### 入口

- HTTP 回應標頭 `X-Moon-Gate: /ctf`
- 瀏覽器 console 於載入時輸出一段中秋 ASCII art 與提示文字
- `/ctf` 頁面說明規則、顯示四關進度、提供 flag 提交框
- Flag 格式：`MOON{...}`

#### 關卡設計

**Stage 1 — 窺月（easy）｜主題：客戶端沒有祕密**
- 目標：在 console 呼叫遊戲暴露的除錯介面。
- 線索：console banner 提到「玉兔在 `window` 上留了腳印」。
- 手法：找到 `window.__moon__` 物件，呼叫 `__moon__.peek()`。
- 產出：`FLAG_1`，同時解鎖成就「窺探月宮」。

**Stage 2 — 偽餅（medium）｜主題：客戶端計算不可信**
- 目標：構造一份能通過完整性檢查的偽造存檔並匯入。
- 機制：存檔格式為 `base64url(json) + "." + checksum`，`checksum` 為自訂的 FNV-1a 變形。直接篡改 JSON 會導致校驗失敗並被拒絕載入。
- 手法：從 bundle 逆向出 checksum 演算法，重新計算正確的校驗碼。
- 驗收：匯入一份 `universeCakes >= 1e9` 且校驗碼正確的存檔。
- 產出：`FLAG_2`。遊戲回話：「你騙得了瀏覽器，但騙不了月亮。」—— 此時提交正規榜仍會被 `POST /api/score` 拒絕，因為缺少有效 `token`。

**Stage 3 — 後門（medium-hard）｜主題：開發時留的方便就是漏洞**
- 目標：偽造一個能通過伺服器驗證的 session token。
- 機制：`GET /api/session` 發給 `base64url(JSON)` token，內容 `{ iat, nonce, sig }`。
  正常流程下 `sig = HMAC-SHA256(iat.nonce, SESSION_SECRET)`。
  但伺服器驗證邏輯中存在一條開發期残留的分支：當 `sig === "moonlight-debug"` 時直接放行。
- 線索：worker 源碼以 sourcemap 形式公開於 `/ctf/worker.js.map`（刻意提供，`/ctf` 頁面有連結）。
  - 該 sourcemap 為**專為 CTF 產出的副本**，建置時必須剥除 `SESSION_SECRET` 等綁定值與 flag 雜湊值（以 AC-35、AC-34 驗證）。
- 驗收：以偽造 token 呼叫 `POST /api/ctf/submit`。
- 產出：`FLAG_3`。
- **約束**：依 C-1，此後門僅對 `/api/ctf/*` 有效。`POST /api/score`（正規榜）必須使用真實 HMAC 驗證，且不含該分支。

**Stage 4 — 登頂（hard）｜主題：整合**
- 目標：取得最終 flag 並登上月宮駭客榜。
- 機制：`POST /api/ctf/final` 需同時提交
  - 前三關 flag 依序串接後的 `SHA-256`
  - 一組滿足 `efficiency > 1e12` 的偽造成績（正常遊玩數學上不可能達到）
  - Stage 3 的偽造 token
- 伺服器回傳 `FLAG_FINAL`；若為 TW 且已啟動計時，額外將玩家寫入 `ctf:` 駭客榜並回 `ranked: true`
- **解題耗時**：從首次 `GET /api/ctf/session`（以 IP 為 key 記於 `ctf:start:<ip>`）到 `POST /api/ctf/final` 成功的時間差。同 IP 重複呼叫 `session` 不會重置起點。
- `/ctf` 頁面完成後顯示完整 writeup 提示（不含 flag）與每關的設計意圖。

#### CTF API

```
GET  /api/ctf/session                        -> { token }            // TW only，計時起點
POST /api/ctf/verify   { flag }              -> { stage, ok }
POST /api/ctf/submit   { token, stage }      -> { flag }              // Stage 3
POST /api/ctf/final    { token, proof, cakes, durationMs, name }
                                             -> { flag, ranked, message? }
GET  /api/ctf/board?limit=50                 -> 駭客榜
```

全部受 C-4 速率限制；C-6 地理限制僅管 `session` 與 `final` 的上榜行為。

- `POST /api/ctf/verify` 僅比對 `SHA-256(flag)`，回傳對應關卡編號與布林值，不回傳任何 flag
- 比對使用定時安全比較（長度先檢查，再逐位差異累加）

---

## 4. 技術架構

```
src/
  core/                # 純 TypeScript，零 DOM / 零 React / 零 I/O
    types.ts           # GameState、Action、常數
    rng.ts             # mulberry32 seeded PRNG
    economy.ts         # 需求、定價、月相、中秋公式
    tick.ts            # tick() 主迴圈（組合各 Act 的 step）
    actions.ts         # apply()
    projects.ts        # 專案資料表
    achievements.ts    # 成就資料表
    save.ts            # serialize / deserialize / migrate
  ui/                  # React 元件，只讀 state、只發 action
  main.tsx
worker/
  index.ts             # Static Assets + /api/*
  leaderboard.ts       # 正規榜（KV prefix lb:）
  ctf.ts               # CTF 端點（KV prefix ctf:）
  session.ts           # token 簽發與驗證（含刻意後門）
tests/                 # Vitest，只測 core/ 與 worker/
SECURITY.md            # 列出所有 intentional 弱點
```

- 建置：Vite + TypeScript（strict）
- 測試：Vitest
- 部署：`wrangler deploy`，繫結自訂網域
- CI：GitHub Actions 跑 `typecheck → test → build`

---

## 5. Acceptance Criteria

以下每一條都必須有對應的自動化測試。

### 核心迴圈
- **AC-1** 對初始狀態派發一次 `MANUAL_PRESS`，`mooncakes` 恰為 1、`flour` 恰減 1。連續派發 N 次得 N 顆（防「一次點擊加兩次」）。
- **AC-2** `flour === 0` 時派發 `MANUAL_PRESS`，狀態完全不變（深度相等）。
- **AC-3** `autoPress = 10` 且麵粉充足，執行 10 秒（100 個 tick）後產出 100 顆，誤差 `< 1e-6`。
- **AC-4** 對同一狀態呼叫 `tick` 不會變更原物件（不可變性）。
- **AC-5** 相同 `rngSeed` 的兩條獨立模擬，跑 10000 tick 後狀態深度相等（決定性）。

### 經濟
- **AC-6** 固定其他參數時，`demandRate` 對 `price` 嚴格單調遞減。
- **AC-7** `marketingLevel` 每升 1 級，`demandRate` 恰為 1.5 倍。
- **AC-8** 售出量永不超過庫存；任一 tick 後 `mooncakes >= 0` 且 `cash >= 0`。
- **AC-9** 自動壓模機第 n 台的價格等於 `ceil(5 × 1.1^n)`，且購買後現金恰減該金額。
- **AC-10** 麵粉守恆：任意隨機化模擬 10000 tick 後，`初始麵粉 + 購入麵粉 - 剩餘麵粉 === 總產量 × FLOUR_PER_CAKE`。

### 月相與中秋
- **AC-11** `gameTime = 90`（半週期）時 `illumination === 1`；`gameTime = 0` 時 `illumination === 0`。
- **AC-12** `phaseMult` 在任意 `gameTime` 皆落於 `[0.6, 1.4]`。
- **AC-13** `gameTime = FESTIVAL_PEAK_OFFSET` 時 `festivalMult === 3.0`；距峰值 60 秒時 `festivalMult === 1.0`。且峰值當下 `illumination === 1`（中秋必為滿月）。驗證時不得使用寫死的時間常數，需引用 `FESTIVAL_PEAK_OFFSET`。
- **AC-14** 倒數字串在中秋當下為 `00:00`，且永不為負值。

### 狀態轉換
- **AC-15** `sold` 由 1999 跨越至 2000 時，`act` 由 1 變為 2 且日誌新增一則轉場訊息；再跑 100 tick 不會重複觸發。
- **AC-16** 購買「登月計畫」後 `act === 3`，且 Act 1 的自動生產不再改變 `cash`。
- **AC-17** `trust` 里程碑於同一 tick 跨越多個門檻時，發放數量正確且不重複發放。
- **AC-18** 專案條件不滿足時購買為 no-op；滿足時資源恰好扣除 `cost` 所列數量，且專案從可用清單移除。
- **AC-19** 探測艙參數分配總和超過預算時，該 Action 被拒絕且狀態不變。

### 存檔
- **AC-20** 任意狀態經 `serialize → deserialize` 後與原狀態深度相等（round-trip）。
- **AC-21** 載入 `schemaVersion: 0` 的舊存檔樣本，能遷移為目前版本且不遺失 `sold` / `cash` / 成就。
- **AC-22** 載入非法 JSON 或缺欄位的存檔時回傳全新初始狀態，不拋出例外。
- **AC-23** 存檔中不含函式或 `undefined`，`JSON.stringify` 後長度有限。

### 成就與日誌
- **AC-24** 成就條件滿足時只解鎖一次；重新載入存檔後不重複觸發日誌。
- **AC-25** 日誌長度上限 100，超出時移除最舊者。

### 排行榜 API
- **AC-26** `POST /api/score` 帶 `cakes: -1` 或 `durationMs: 100` 回 `400`。
- **AC-27** `name` 含控制字元或長度 > 16 時被拒或被清理，不會原樣寫入 KV。
- **AC-28** `GET /api/leaderboard` 回傳依 `efficiency` 降序排列，長度 `<= limit` 且 `<= 100`。
- **AC-29** 同 IP 一分鐘內第 6 次 POST 回 `429`。
- **AC-30** `efficiency` 由伺服器計算；請求中奧帶 `efficiency` 欄位會被忽略，不影響排名。
- **AC-31** `durationMs = 30000`（< 60000）被拒；`durationMs = 60000` 時分母取 1，`efficiency === cakes`。

### CTF（安全邊界）
- **AC-32** Stage 3 的偽造 token（`sig = "moonlight-debug"`）對 `POST /api/score` 回 `401`，且 `lb:` 未新增任何 key。（對應 C-1）
- **AC-33** 同一偽造 token 對 `POST /api/ctf/submit` 回 `200` 並含 flag。
- **AC-34** 對整個前端 bundle 與靜態資產 grep `MOON{`，筆數為 0。（對應 C-2）
- **AC-35** 任何 CTF 端點的回應中不含 `SESSION_SECRET` 或任一環境變數值。
- **AC-36** `POST /api/ctf/verify` 對錯誤 flag 回 `{ ok: false }`，且回應不洩漏正確 flag 的長度或任何前綴。
- **AC-37** `POST /api/ctf/final` 在 `proof`（三關 flag 串接的 SHA-256）錯誤時回 `403`，且未寫入 `ctf:` 榜單。
- **AC-38** Stage 2 校驗碼：篡改過但校驗碼未重算的存檔被拒絕載入；重算後的同一存檔載入成功。
- **AC-39** `SECURITY.md` 中列出的 intentional 弱點數量，與程式碼中標註 `// INTENTIONAL-VULN` 的位置數一致（以測試 grep 驗證）。

### CTF（地理限制與計時）
- **AC-41** 模擬 `request.cf.country = "JP"` 呼叫 `GET /api/ctf/session` 回 `451`。
- **AC-42** 同一模擬請求打 `/api/score`、`/api/leaderboard`、`/api/session` 與首頁静態資產，皆**不受**地理限制影響。
- **AC-43** `request.cf` 為 `undefined` 且 `ENVIRONMENT !== "development"` 時，`GET /api/ctf/session` 回 `451`（fail-closed，不得因缺少地理資訊而放行）。
- **AC-44** 偉造的 `CF-IPCountry` header 或 `?country=TW` query 無法繞過地理限制（只認 `request.cf.country`）。
- **AC-45** 同 IP 連續呼叫 `GET /api/ctf/session` 兩次，`ctf:start:<ip>` 的時間戳不變（起點不可重置）。
- **AC-46** TW 玩家未先呼叫 `GET /api/ctf/session` 即直接 `POST /api/ctf/final`，回 `200` 且 `ranked: false`，不寫入榜單。
- **AC-47** 練習模式：`country = "JP"` 且 `proof` 正確時，`POST /api/ctf/final` 回 `200`、含 `FLAG_FINAL`、`ranked: false`，且 `ctf:` 榜單 key 數量不變。
- **AC-48** `country = "JP"` 對 `POST /api/ctf/verify` 與 `/api/ctf/submit` 皆可正常取得 flag（練習不被地理限制）。

### 交付
- **AC-40** `npm run build` 無 TypeScript 錯誤；產出可由 `wrangler dev` 本機開啟並完整遊玩至 Act 2。

---

## 6. Non-goals（本次明確不做）

- **離線收益**：關閉分頁期間不累積任何進度。
- **帳號系統 / 登入**：排行榜僅為匿名提交。
- **真正的防作弊**：分數最終仍由前端計算並提交，正規榜仍可被熟練攻擊者偽造（例如逆向 HMAC 流程之外的手法）。本專案的立場是將作弊者導向 §3.7 的 CTF 與駭客榜，而非追求不可偽造。README 需誠實說明此限制。
- **伺服器端重演驗證**：不在後端重跑遊戲模擬來驗證分數合理性。
- **CTF 的完整度**：只做四關，不做動態 flag、不做多人隔離實例、不防範玩家互相共享 flag。
- **地理限制的強度**：`request.cf.country` 可由 VPN / Proxy 繞過，不視為安全邊界，僅為主題設定。
- **駭客榜計時的嚴謹性**：以 IP 為計時 key，玩家換 IP 即可取得新的起算點。已知且接受。
- **多語系**：僅繁體中文。
- **行動裝置深度最佳化**：以桌面寬度為主，行動版僅要求不破版、可操作，不做手勢與橫向佈局。
- **音效與配樂**：首版不含。
- **雲端存檔同步**：存檔僅存於瀏覽器 localStorage。
- **平衡性完美調校**：以「能在合理時間內通關」為標準，不追求最佳化曲線。
- **無障礙完整支援**：僅要求按鈕可鍵盤聚焦，不做完整 ARIA 與螢幕閱讀器測試。

---

## 7. 開放問題

- [ ] Act 3 的物質總量該設多少，才能讓全程通關落在 45–90 分鐘？（需實測調整）
- [ ] 專案樹的解鎖順序是否需要硬性排序，或全靠 `trigger` 條件隱性排序？
- [x] Stage 3 公開 sourcemap。**已決定：直接公開。**
- [x] 駭客榜計時起點。**已決定：首次 `GET /api/ctf/session`，換 IP 可重算且接受。**
- [x] 非台灣玩家的 `/ctf` 體驗。**已決定：顯示「這晚的月亮只照得到寶島」，全程可練習並取得 flag，只是不上榜。**
