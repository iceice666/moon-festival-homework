import { useRef, useState, useSyncExternalStore } from "react";
import { autoPressCost, demandRate, festivalMult, illumination, marketingCost, phaseMult, timeToFestival } from "../core/economy";
import { ACT2_SOLD_THRESHOLD, FLOUR_BATCH_SIZE, FLOUR_PER_CAKE, LUNAR_CYCLE, MAX_PRICE, MIN_PRICE } from "../core/types";
import { formatCountdown } from "../runtime/loop";
import type { GameStore } from "../runtime/store";

const number = (value: number, digits = 1) => value.toLocaleString("zh-TW", { maximumFractionDigits: digits });
const money = (value: number) => `$${number(value, 2)}`;
const phases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
const phaseNames = ["新月", "眉月", "上弦月", "盈凸月", "滿月", "虧凸月", "下弦月", "殘月"];

export function App({ store }: { store: GameStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const notice = useSyncExternalStore(store.subscribe, store.getNotice);
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const phase = Math.floor(((state.gameTime % LUNAR_CYCLE) / LUNAR_CYCLE * 8) + 0.5) % 8;
  const demand = demandRate(state);
  const festival = festivalMult(state.gameTime);
  const production = state.autoPress;
  const pressCost = autoPressCost(state.autoPress);
  const adCost = marketingCost(state.marketingLevel);
  const frozen = state.act === 3;

  function changePrice(value: number) {
    store.dispatch({ type: "SET_PRICE", price: value });
    setPriceDraft(null);
  }
  function exportSave() {
    const url = URL.createObjectURL(new Blob([store.exportSave()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mooncake-save.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    store.notify("存檔已匯出；請妥善保管下載的 JSON 檔案。");
  }

  return <main className="shell">
    <header className="masthead">
      <div><p className="eyebrow">MOONCAKE MAXIMIZER / 月餅最佳化計畫</p><h1>月餅迴紋針<span>一顆，然後是整個宇宙。</span></h1></div>
      <div className="chapter">ACT I<span>人間製餅坊</span></div>
    </header>

    <section className={`moon-banner ${festival > 1 ? "festival" : ""}`} aria-label="月相與中秋">
      <div className="moon-symbol" aria-hidden="true">{phases[phase]}</div>
      <div><strong>{phaseNames[phase]}<span className="quiet"> · 照度 {number(illumination(state.gameTime) * 100, 0)}%</span></strong><p>月相需求 ×{number(phaseMult(state.gameTime), 2)}{festival > 1 ? `　中秋熱潮 ×${number(festival, 2)}` : "　月有陰晴圓缺，生意也是。"}</p></div>
      <div className="countdown"><span>距離中秋</span><strong>{formatCountdown(timeToFestival(state.gameTime))}</strong></div>
    </section>

    <div className="resources">
      <div><span>現金</span><strong>{money(state.cash)}</strong><small>預估營收 {money(Math.min(demand, production || demand) * state.price)} / 秒＊</small></div>
      <div><span>麵粉</span><strong>{number(state.flour)}<em>兩</em></strong><small>{state.flour < state.clickYield * FLOUR_PER_CAKE ? "麵粉不足，請補貨" : "一兩麵粉，一顆月餅"}</small></div>
      <div><span>未售出庫存</span><strong>{number(state.mooncakes, 0)}<em>顆</em></strong><small>自動售出，不必手動出貨</small></div>
      <div><span>累計售出</span><strong>{number(state.sold, 0)}<em>顆</em></strong><small>目標 {number(ACT2_SOLD_THRESHOLD, 0)} 顆 · 玉兔搗藥台</small></div>
    </div>

    <div className="workshop">
      <section className="panel production"><div className="section-heading"><span>01 / 生產</span><h2>把月亮壓進模子裡</h2></div>
        <button className="press-button" disabled={frozen || state.flour < state.clickYield * FLOUR_PER_CAKE} onClick={() => store.dispatch({ type: "MANUAL_PRESS" })}><span className="cake" aria-hidden="true">餅</span><strong>手動壓模</strong><small>每次 +{number(state.clickYield)} 顆 · 消耗 {number(state.clickYield * FLOUR_PER_CAKE)} 兩麵粉</small></button>
        <div className="detail-row"><span>自動壓模機</span><strong>{number(state.autoPress, 0)} 台</strong></div>
        <div className="detail-row"><span>自動產能</span><strong>{number(production)} 顆 / 秒</strong></div>
        <button className="wide" disabled={frozen || state.cash < pressCost || !Number.isFinite(pressCost)} onClick={() => store.dispatch({ type: "BUY_AUTO_PRESS" })}>購買壓模機 <span>{money(pressCost)}</span></button>
        <p className="hint">每台每秒製作 1 顆，完成整顆才入庫。製作進度 {Math.floor(state.productionProgress * 100)}%；麵粉不足一顆時暫停。</p>
      </section>

      <section className="panel"><div className="section-heading"><span>02 / 經營</span><h2>好月餅，也要好生意</h2></div>
        <label className="field-label" htmlFor="price">月餅單價 <span>元 / 顆</span></label>
        <form className="price-control" onSubmit={(event) => { event.preventDefault(); const value = Number(priceDraft ?? state.price); if ((priceDraft ?? "x").trim() && Number.isFinite(value)) changePrice(value); }}>
          <button type="button" aria-label="降低單價" disabled={frozen || state.price <= MIN_PRICE} onClick={() => changePrice(Math.round((state.price - 0.01) * 100) / 100)}>−</button>
          <input id="price" type="number" min={MIN_PRICE} max={MAX_PRICE} step="0.01" required disabled={frozen} value={priceDraft ?? state.price} onChange={(event) => setPriceDraft(event.target.value)} />
          <button type="button" aria-label="提高單價" disabled={frozen || state.price >= MAX_PRICE} onClick={() => changePrice(Math.round((state.price + 0.01) * 100) / 100)}>＋</button>
          <button disabled={frozen} type="submit">設定</button>
        </form>
        <div className="detail-row"><span>市場需求</span><strong>{number(demand, 2)} 顆 / 秒</strong></div>
        <p className="hint">月餅整顆販售，購買進度 {Math.floor(state.salesProgress * 100)}%。降價、月相與中秋會影響需求；售罄時不累積訂單。</p>
        <hr /><div className="detail-row"><span>行銷等級</span><strong>Lv. {state.marketingLevel}</strong></div>
        <button className="wide" disabled={frozen || state.cash < adCost || !Number.isFinite(adCost)} onClick={() => store.dispatch({ type: "UPGRADE_MARKETING" })}>升級行銷 <span>{money(adCost)}</span></button>
        <p className="hint">街坊口耳相傳。每升一級，需求變為 1.5 倍。</p>
        <hr /><div className="detail-row"><span>麵粉現貨 · 每批 {number(FLOUR_BATCH_SIZE + state.flourBonus, 0)} 兩</span><strong>{money(state.flourPrice)}</strong></div>
        <button className="wide" disabled={frozen || state.cash < state.flourPrice} onClick={() => store.dispatch({ type: "BUY_FLOUR" })}>買一批麵粉 <span>{money(state.flourPrice)}</span></button>
        <p className="hint">現貨價格隨市場浮動。自動採購需於 Act II 解鎖。{state.autoBuyFlour ? `（已解鎖；現金高於 ${money(state.autoBuyThreshold)} 時自動補貨）` : ""}</p>
      </section>
    </div>

    <section className="panel journey"><div><p className="eyebrow">下一站 / 月亮那一頭</p><h2>{state.act >= 2 ? "玉兔搗藥台已解鎖" : "月宮正在觀察你的製餅坊"}</h2><p>{state.act >= 2 ? "玉兔自月中探出頭來，願意為你搗藥。Act I 已完成，人間製餅坊將持續運作；Act II 科技與專案將於後續版本開放。" : `再售出 ${number(Math.max(0, ACT2_SOLD_THRESHOLD - state.sold))} 顆月餅，就能引起玉兔的注意。`}</p></div><div className="progress-wrap"><span>{Math.min(100, state.sold / ACT2_SOLD_THRESHOLD * 100).toFixed(1)}%</span><progress aria-label="玉兔搗藥台解鎖進度" value={Math.min(state.sold, ACT2_SOLD_THRESHOLD)} max={ACT2_SOLD_THRESHOLD} /></div></section>
    <section className="panel event-log"><div className="section-heading"><span>製餅坊手記</span><h2>月下消息</h2></div>{state.log.length === 0 ? <p className="hint">爐火剛點起。先壓一顆月餅，讓故事開始。</p> : <ol>{state.log.map((entry, index) => <li key={`${entry.at}-${index}`}><time>{formatCountdown(entry.at)}</time>{entry.text}</li>)}</ol>}</section>

    <footer><div className="save-actions"><button onClick={store.save}>立即存檔</button><button onClick={exportSave}>匯出存檔</button><button onClick={() => fileInput.current?.click()}>匯入存檔</button><button className="danger" onClick={() => setConfirmReset(true)}>重新開始</button></div>
      <input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 1_000_000) { store.notify("存檔過大，請選擇小於 1 MB 的 JSON 檔案。"); return; } if (!window.confirm("匯入存檔將覆蓋目前進度，確定繼續？")) return; try { store.importSave(await file.text()); } catch { store.notify("無法讀取檔案，目前進度未變更。"); } }} />
      <p role="status">{notice}</p><p className="hint">＊預估營收受庫存與麵粉供應限制。遊戲時間 {formatCountdown(state.gameTime)} · 切換分頁時暫停，不計離線收益。</p>
    </footer>
    {confirmReset && <div className="modal-backdrop"><section className="panel modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">重新點起爐火？</h2><p>目前所有進度將被清除，且無法復原。建議先匯出存檔。</p><div className="save-actions"><button autoFocus onClick={() => setConfirmReset(false)}>保留進度</button><button className="danger" onClick={() => { store.restart(); setPriceDraft(null); setConfirmReset(false); }}>確認清除並重新開始</button></div></section></div>}
  </main>;
}
