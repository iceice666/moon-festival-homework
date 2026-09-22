# AI Collaboration Retrospective

## 1. 你用了哪些 AI / Agent？

- **Pi**（Coding Agent，Claude Sonnet）：規格討論、專案骨架、測試與實作撰寫

分工方式是：我負責定義要做什麼、判斷規格是否合理、決定架構取捨與驗收標準；
實作與測試程式碼大部分交給 Agent 產出，我負責 review 與拍板。

---

## 2. AI 做得最好的一件事

**把「模糊的遊戲點子」逼成可驗證的數值規格。**

我一開始只說「想做月餅版的 Universal Paperclips」。
Agent 沒有直接開始寫遊戲，而是先追問範圍、技術棧、要哪些機制，
然後產出一份帶有明確公式與常數的 SPEC：

```
demandRate = BASE_DEMAND × (REFERENCE_PRICE / price)^ELASTICITY
           × marketingMult × phaseMult × festivalMult
```

更關鍵的是它提出了 §2「系統模型」那六條紀律
（單一狀態樹、純函數 reducer、固定 timestep、seeded PRNG、數值不變量、UI 不可寫 state）。

這幾條看起來很囉嗦，但**它們是後面所有測試能成立的前提**。
如果 tick 會讀 `Date.now()` 或 `Math.random()`，AC-5 的「相同 seed 跑 10000 tick 結果相同」
根本寫不出來。等於是先把程式碼設計成「可被驗證的形狀」，再開始實作。

---

## 3. AI 搞砸的一件事

**它寫出了兩條互相矛盾、數學上不可能同時成立的驗收條件。**

SPEC 裡的月相設定是：

- 朔望週期 `LUNAR_CYCLE = 180` 秒
- 照度 `illumination = (1 - cos(2π × phase)) / 2`，所以**滿月落在 `t = 90 + 180k`**
- 中秋每 12 分鐘一次，峰值訂在 `gameTime mod 720 === 360`

問題是 `360 mod 180 = 0`，那個時間點的照度是 **0，是新月**。

於是同一份 spec 裡的兩條 AC 直接打架：

```
AC-13: festivalMult(360) === 3.0     // 中秋峰值在 t=360
AC-13: illumination(360) === 1       // 中秋必為滿月
```

一個「中秋節」被排在了新月那天。

這個錯誤的麻煩之處在於，**兩條規格單獨看都完全合理**，
「中秋乘數是 3 倍」沒問題，「中秋是滿月」也沒問題，
只有把它們放進同一個三角函數模型才會爆炸。

---

## 4. 我怎麼發現它錯了

不是靠讀 spec 讀出來的——我 review 過那份 spec 兩次，都沒看出問題。

是**實作階段被測試逼出來的**。

我採用 TDD，先讓 Agent 把 AC 寫成失敗的測試（22 個測試全failed），
再實作 `economy.ts` 讓它們pass。當 Agent 要同時滿足這兩條斷言時，
矛盾才浮出來：`festivalMult` 的峰值偏移量無論怎麼設，
都無法讓 `illumination` 在同一時刻等於 1。

換句話說，**是「把驗收條件寫成可執行的程式碼」這個動作抓到的**。
只要 AC 還停留在自然語言，這個 bug 就會一路活到玩家發現
「中秋節那天月亮是黑的」為止。

---

## 5. 最後怎麼解決

我沒有選擇最省事的做法——把斷言值改掉讓它過。

因為那只是掩蓋矛盾，下次改週期參數時同樣的 bug 會再長回來。

實際做法分三步：

**(1) 修正規格，讓峰值落在真正的滿月**

峰值偏移改為 `450`（= 90 + 180×2），確實是滿月，
而且首次中秋落在 7.5 分鐘，比原本的 t=90（1.5 分鐘就過節）更合理。

**(2) 把隱含的約束寫成程式碼與註解**

```ts
/**
 * 中秋 must fall on a full moon, and full moons sit at LUNAR_CYCLE/2 + k*LUNAR_CYCLE.
 * Therefore (FESTIVAL_PEAK_OFFSET - LUNAR_CYCLE/2) % LUNAR_CYCLE must be 0.
 */
export const FESTIVAL_PEAK_OFFSET = 450;
```

**(3) 讓測試守住這個約束，而不是守住某個時間點**

原本的測試寫死了 `360` 這個magic number，我把它改成引用常數，
並直接assert那條數學關係：

```ts
expect(illumination(FESTIVAL_PEAK_OFFSET)).toBeCloseTo(1, 10);
expect((FESTIVAL_PEAK_OFFSET - LUNAR_CYCLE / 2) % LUNAR_CYCLE).toBe(0);
expect(FESTIVAL_PERIOD % LUNAR_CYCLE).toBe(0);
```

這樣以後任何人（包含 AI）調整週期或峰值，只要破壞了
「中秋必為滿月」這個要求，測試就會立刻紅燈。

對應 commit：`fix(core/lunar): move 中秋 peak onto an actual full moon`

---

## 6. 如果重做一次，我會怎麼改變 AI 協作方式

**(1) Spec review 時要主動找「條件之間的交互作用」，而不是逐條檢查**

我 review spec 的方式是一條一條看合不合理，這抓不到矛盾。
應該要問的是：「這幾條約束能同時成立嗎？」
特別是牽涉到週期、比例、上下限這類彼此耦合的數值時。

**(2) 把數學條件當成一等公民寫進 spec**

原本的 spec 只寫了「中秋 = 每 4 個朔望週期的滿月，即 mod 720 === 450」，
這是把**結論**寫進去。更好的寫法是把**約束**寫進去：
`(峰值 - 週期/2) mod 週期 === 0`。
前者是一個可能算錯的數字，後者是一條不會算錯的規則。

**(3) 測試裡禁止magic number**

最初的測試寫 `festivalMult(360)`，等於把 spec 的錯誤複製了一份到測試裡。
如果當時就引用常數，實作一改常數，測試會自己抓到不一致。
現在我的原則是：**測試斷言的是關係，不是特定數值**。

**(4) 繼續維持「AI 不准自己改斷言」這條界線**

過程中我明確要求：測試失敗時，先判斷是實作錯還是規格錯，
不可以直接調整斷言讓測試變綠。
這次的 bug 如果放任 Agent「讓測試過」，它極可能直接把 `illumination` 那條斷言刪掉。

---

## Incident（必須保留的 AI Failure 紀錄）

### 我想要什麼

中秋節當天需求倍率最高（3.0 倍），而且中秋節在遊戲裡應該是**滿月**。

### AI 做了什麼

在 SPEC 中把中秋峰值訂在 `gameTime mod 720 === 360`，
但依照同一份 spec 的照度公式，`t = 360` 時 `illumination = 0`——那是**新月**。

同時它還把「中秋必為滿月」也寫成了一條驗收條件，
導致 AC-13 自相矛盾、不可能通過。

### 我怎麼發現

先把所有 AC 寫成失敗的測試，再實作讓它們轉綠。
實作 `economy.ts` 時發現無論峰值怎麼設，這兩條斷言都不可能同時滿足：

```
✗ AC-13: 中秋當下乘數為 3.0，平日為 1.0
✗ AC-13: 中秋當下必為滿月

expected illumination(360) to be close to 1
received: 0
```

規格 review 兩次都沒看出來，是測試抓到的。

### 怎麼解決

1. 峰值改為 `450`（= 90 + 180×2，確實是滿月）
2. 在 SPEC 與程式碼中明確寫出約束：`(峰值 - 週期/2) mod 週期 === 0`
3. 測試改為引用常數並斷言該不變量，移除寫死的 `360`

修正後 22 個測試全數通過。
