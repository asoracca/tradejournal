"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Blobfish } from "./blobfish";

type Trade = {
  id: string; createdAt: string; ticker: string; type: string; side: string;
  quantity: number; entryPrice: number; exitPrice: number | null; status: string; mode: string;
  stopLoss: number | null; target: number | null;
  optionType: string | null; strike: number | null; strategy: string | null; notes: string | null;
  aiComment?: { text: string } | null;
};

const STRATEGIES: { name: string; desc: string }[] = [
  { name: "Buy & Hold", desc: "Hold for the long term and ride out short-term swings. Lowest stress." },
  { name: "Swing Trade", desc: "Hold days to weeks to catch a single price swing." },
  { name: "Momentum", desc: "Buy strength — assets already moving up on high volume." },
  { name: "Breakout", desc: "Enter as price breaks above resistance or below support." },
  { name: "Mean Reversion", desc: "Bet an overstretched price snaps back to its average." },
  { name: "Dividend / Income", desc: "Hold mainly to collect regular dividend payments." },
  { name: "Day Trade", desc: "Open and close same day. Fast and risky — advanced." },
];

const emptyForm = {
  ticker: "", type: "STOCK", side: "BUY", quantity: "", entryPrice: "",
  stopLoss: "", target: "", optionType: "CALL", strike: "", expiration: "",
  strategy: "Buy & Hold", emotion: "", notes: "",
};

function num(v: string): number { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function mlt(t: Trade): number { return t.type === "OPTION" ? 100 : 1; }
function dir(t: Trade): number { return t.side === "BUY" ? 1 : -1; }
function realized(t: Trade): number { return t.exitPrice != null ? (t.exitPrice - t.entryPrice) * t.quantity * mlt(t) * dir(t) : 0; }
function unreal(t: Trade, price?: number): number | null { return price != null ? (price - t.entryPrice) * t.quantity * mlt(t) * dir(t) : null; }
function pnlStr(n: number): string { return (n >= 0 ? "+$" : "-$") + Math.abs(n).toFixed(2); }
function tone(n: number): string { return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-gray-300"; }
function fmtDate(s: string): string {
  try { return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return s; }
}
function hitStatus(t: Trade, price?: number): "STOP" | "TARGET" | null {
  if (price == null) return null;
  const long = t.side === "BUY";
  if (t.stopLoss != null && (long ? price <= t.stopLoss : price >= t.stopLoss)) return "STOP";
  if (t.target != null && (long ? price >= t.target : price <= t.target)) return "TARGET";
  return null;
}

export default function Dashboard() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<"PAPER" | "REAL">("PAPER");
  const [view, setView] = useState<"PAPER" | "REAL">("PAPER");
  const [sizeMode, setSizeMode] = useState<"shares" | "dollars">("shares");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startBalStr, setStartBalStr] = useState("100000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const notified = useRef<Set<string>>(new Set());

  async function loadTrades() {
    try {
      const res = await fetch("/api/trades");
      if (!res.ok) throw new Error("Couldn't reach the database");
      const data = await res.json();
      setTrades(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }

  async function loadPrices(symbols: string[]) {
    const entries = await Promise.all(symbols.map(async (s) => {
      try {
        const r = await fetch("/api/quote?ticker=" + encodeURIComponent(s));
        if (!r.ok) return null;
        const q = await r.json();
        return typeof q.price === "number" ? ([s, q.price] as [string, number]) : null;
      } catch { return null; }
    }));
    setPrices((prev) => ({ ...prev, ...Object.fromEntries(entries.filter(Boolean) as [string, number][]) }));
  }

  async function lookupTicker() {
    const tk = form.ticker.trim();
    if (!tk) { setLivePrice(null); return; }
    setLookingUp(true);
    try {
      const r = await fetch("/api/quote?ticker=" + encodeURIComponent(tk));
      if (!r.ok) { setLivePrice(null); return; }
      const q = await r.json();
      if (typeof q.price === "number") { setLivePrice(q.price); setForm((f) => ({ ...f, entryPrice: f.entryPrice ? f.entryPrice : String(q.price) })); }
      else setLivePrice(null);
    } catch { setLivePrice(null); } finally { setLookingUp(false); }
  }

  useEffect(() => { loadTrades(); }, []);
  useEffect(() => {
    const syms = Array.from(new Set(trades.filter((t) => t.status === "OPEN" && t.type !== "OPTION").map((t) => t.ticker)));
    if (syms.length) loadPrices(syms);
  }, [trades]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    for (const t of trades.filter((x) => x.status === "OPEN")) {
      const h = hitStatus(t, prices[t.ticker]);
      if (h && !notified.current.has(t.id + h)) {
        notified.current.add(t.id + h);
        new Notification(t.ticker + (h === "STOP" ? " hit your stop loss" : " hit your target"), { body: "Now at " + prices[t.ticker] });
      }
    }
  }, [prices, trades]);

  function enableAlerts() {
    if (typeof window === "undefined" || !("Notification" in window)) { setAlertsOn(true); return; }
    Notification.requestPermission().then((p) => setAlertsOn(p === "granted"));
  }

  function update(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  const entryNum = num(form.entryPrice);
  const m = form.type === "OPTION" ? 100 : 1;
  const effShares = (sizeMode === "dollars" && entryNum > 0) ? num(form.quantity) / entryNum : num(form.quantity);

  const calc = useMemo(() => {
    const stop = num(form.stopLoss), target = num(form.target), acct = num(startBalStr);
    const totalRisk = (stop ? Math.abs(entryNum - stop) : 0) * effShares * m;
    const totalReward = (target ? Math.abs(target - entryNum) : 0) * effShares * m;
    const riskPct = acct ? (totalRisk / acct) * 100 : 0;
    const rr = totalRisk ? totalReward / totalRisk : 0;
    return { totalRisk, totalReward, riskPct, rr };
  }, [form.stopLoss, form.target, entryNum, effShares, startBalStr, m]);

  const riskTone = calc.riskPct === 0 ? "text-gray-400" : calc.riskPct <= 1 ? "text-emerald-400" : calc.riskPct <= 2 ? "text-yellow-400" : "text-red-400";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const noteExtras = [form.notes, calc.rr ? "R:R 1:" + calc.rr.toFixed(2) : ""].filter(Boolean).join(" | ");
      const payload = { ...form, quantity: effShares, stopLoss: form.stopLoss, target: form.target, notes: noteExtras, mode };
      if (editingId) {
        const res = await fetch("/api/trades/" + editingId, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Failed to update trade");
      } else {
        const res = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Failed to save trade");
      }
      setForm(emptyForm); setEditingId(null); setSizeMode("shares"); setLivePrice(null);
      await loadTrades();
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  function editStart(t: Trade) {
    setEditingId(t.id); setSizeMode("shares"); setLivePrice(null); setMode(t.mode === "REAL" ? "REAL" : "PAPER");
    setForm({
      ticker: t.ticker, type: t.type, side: t.side, quantity: String(t.quantity), entryPrice: String(t.entryPrice),
      stopLoss: t.stopLoss != null ? String(t.stopLoss) : "", target: t.target != null ? String(t.target) : "",
      optionType: t.optionType || "CALL", strike: t.strike != null ? String(t.strike) : "", expiration: "",
      strategy: t.strategy || "Buy & Hold", emotion: "", notes: "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); setSizeMode("shares"); setLivePrice(null); setMode(view); }

  async function closeTrade(t: Trade) {
    const live = prices[t.ticker];
    const input = window.prompt("Close " + t.ticker + " — enter the price you're closing at:", live ? String(live) : "");
    if (!input) return;
    await fetch("/api/trades/" + t.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exitPrice: Number(input), status: "CLOSED" }) });
    await loadTrades();
  }
  async function deleteTrade(t: Trade) {
    if (!window.confirm("Delete this trade?")) return;
    await fetch("/api/trades/" + t.id, { method: "DELETE" });
    await loadTrades();
  }

  const isReal = (t: Trade) => t.mode === "REAL";
  const inView = trades.filter((t) => (view === "REAL" ? isReal(t) : !isReal(t)));
  const open = inView.filter((t) => t.status === "OPEN");
  const closed = inView.filter((t) => t.status !== "OPEN");
  const startBal = num(startBalStr);
  const realizedTotal = closed.reduce((a, t) => a + realized(t), 0);
  const openTotal = open.reduce((a, t) => a + (unreal(t, prices[t.ticker]) ?? 0), 0);
  const equity = startBal + realizedTotal + openTotal;
  const wins = closed.filter((t) => realized(t) > 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
  const costBasis = open.reduce((a, t) => a + t.entryPrice * t.quantity * mlt(t), 0);
  const marketValue = open.reduce((a, t) => { const p = prices[t.ticker]; return a + (p != null ? p : t.entryPrice) * t.quantity * mlt(t); }, 0);

  const isOption = form.type === "OPTION";
  const stratDesc = STRATEGIES.find((s) => s.name === form.strategy)?.desc;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{view === "REAL" ? "Real Portfolio" : "Paper Trading Desk"}</h1>
          <p className="text-gray-400 text-sm mt-1">{view === "REAL" ? "Your real holdings (delayed prices — Schwab is the source of truth)." : "Practice with fake money and live market prices."}</p>
          <a href="/learn" className="text-xs text-emerald-400 hover:underline">New to trading? Read the quick guide →</a>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="card p-1 flex gap-1">
            <button onClick={() => { setView("PAPER"); setMode("PAPER"); }} className={"px-3 py-1.5 rounded-lg text-sm " + (view === "PAPER" ? "bg-emerald-600" : "")}>📝 Paper</button>
            <button onClick={() => { setView("REAL"); setMode("REAL"); }} className={"px-3 py-1.5 rounded-lg text-sm " + (view === "REAL" ? "bg-pink-600" : "")}>💵 Real</button>
          </div>
          {view === "PAPER" && (
            <label className="card px-4 py-2 flex items-center gap-3">
              <span className="text-xs uppercase tracking-wide text-gray-400">Starting Balance</span>
              <span className="text-gray-400">$</span>
              <input className="bg-transparent w-24 outline-none text-emerald-400 font-mono" value={startBalStr} onChange={(e) => setStartBalStr(e.target.value)} />
            </label>
          )}
        </div>
      </header>

      {error && <div className="card border-red-800/60 p-4 text-sm text-red-300">⚠ {error}.</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {view === "PAPER" ? (<>
          <Stat label="Account Equity" value={"$" + equity.toFixed(0)} accent={tone(equity - startBal)} />
          <Stat label="Realized P&L" value={pnlStr(realizedTotal)} accent={tone(realizedTotal)} />
          <Stat label="Open P&L" value={pnlStr(openTotal)} accent={tone(openTotal)} />
          <Stat label="Win Rate" value={closed.length ? winRate + "%" : "—"} accent="text-emerald-400" />
        </>) : (<>
          <Stat label="Cost Basis" value={"$" + costBasis.toFixed(0)} />
          <Stat label="Market Value" value={"$" + marketValue.toFixed(0)} accent={tone(marketValue - costBasis)} />
          <Stat label="Open P&L" value={pnlStr(openTotal)} accent={tone(openTotal)} />
          <Stat label="Realized P&L" value={pnlStr(realizedTotal)} accent={tone(realizedTotal)} />
        </>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-6 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <h2 className="col-span-2 text-lg font-semibold flex items-center gap-2">
            <span className="text-emerald-400">▮</span> {editingId ? "Edit Position" : "Open a Position"}
            {editingId && <button type="button" onClick={cancelEdit} className="ml-auto text-xs text-gray-400 hover:text-gray-200">cancel edit</button>}
          </h2>
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">Account:</span>
            <button type="button" onClick={() => setMode("PAPER")} className={"text-xs px-2 py-0.5 rounded " + (mode === "PAPER" ? "bg-emerald-600" : "bg-gray-800")}>📝 Paper</button>
            <button type="button" onClick={() => setMode("REAL")} className={"text-xs px-2 py-0.5 rounded " + (mode === "REAL" ? "bg-pink-600" : "bg-gray-800")}>💵 Real money</button>
          </div>
          <div>
            <Field label="Ticker"><input className="input uppercase" value={form.ticker} onChange={(e) => { update("ticker", e.target.value); setLivePrice(null); }} onBlur={lookupTicker} placeholder="AAPL  (futures: ES=F)" required /></Field>
            {lookingUp && <p className="text-xs text-pink-300 mt-1">fetching price…</p>}
          </div>
          <Field label="Type"><select className="input" value={form.type} onChange={(e) => update("type", e.target.value)}><option value="STOCK">Stock</option><option value="OPTION">Option</option><option value="FUTURE">Future</option></select></Field>
          <Field label="Side"><select className="input" value={form.side} onChange={(e) => update("side", e.target.value)}><option value="BUY">Buy / Long</option><option value="SELL">Sell / Short</option></select></Field>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{sizeMode === "shares" ? "Quantity (shares)" : "Amount ($)"}</span>
              <div className="flex gap-1 text-xs">
                <button type="button" onClick={() => setSizeMode("shares")} className={"px-1.5 py-0.5 rounded " + (sizeMode === "shares" ? "bg-emerald-600" : "bg-gray-800")}>Shares</button>
                <button type="button" onClick={() => setSizeMode("dollars")} className={"px-1.5 py-0.5 rounded " + (sizeMode === "dollars" ? "bg-emerald-600" : "bg-gray-800")}>Dollars</button>
              </div>
            </div>
            <input className="input" type="number" step="any" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} required />
            {sizeMode === "dollars" && entryNum > 0 && num(form.quantity) > 0 && (<p className="text-xs text-gray-400 mt-1">= {(num(form.quantity) / entryNum).toFixed(4)} shares</p>)}
          </div>
          <div>
            <Field label="Entry Price"><input className="input" type="number" step="any" value={form.entryPrice} onChange={(e) => update("entryPrice", e.target.value)} required /></Field>
            {livePrice != null && <button type="button" onClick={() => update("entryPrice", livePrice.toFixed(2))} className="text-xs text-pink-300 hover:underline mt-1">↻ live ${livePrice.toFixed(2)}</button>}
          </div>
          <Field label="Stop Loss"><input className="input" type="number" step="any" value={form.stopLoss} onChange={(e) => update("stopLoss", e.target.value)} placeholder="optional" /></Field>
          <Field label="Target"><input className="input" type="number" step="any" value={form.target} onChange={(e) => update("target", e.target.value)} placeholder="optional" /></Field>
          {entryNum > 0 && (
            <div className="col-span-2 -mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-gray-400">Quick stop:</span>
              {[5, 10, 15].map((p) => { const px = (entryNum * (1 - p / 100)).toFixed(2); return <button type="button" key={"s" + p} onClick={() => update("stopLoss", px)} className="bg-gray-800 hover:bg-red-900/50 rounded px-2 py-0.5">-{p}% (${px})</button>; })}
              <span className="text-gray-400 ml-2">Quick target:</span>
              {[10, 20, 30].map((p) => { const px = (entryNum * (1 + p / 100)).toFixed(2); return <button type="button" key={"t" + p} onClick={() => update("target", px)} className="bg-gray-800 hover:bg-emerald-900/50 rounded px-2 py-0.5">+{p}% (${px})</button>; })}
            </div>
          )}
          {isOption && (<>
            <Field label="Call / Put"><select className="input" value={form.optionType} onChange={(e) => update("optionType", e.target.value)}><option value="CALL">Call</option><option value="PUT">Put</option></select></Field>
            <Field label="Strike"><input className="input" type="number" step="any" value={form.strike} onChange={(e) => update("strike", e.target.value)} /></Field>
            <Field label="Expiration"><input className="input" type="date" value={form.expiration} onChange={(e) => update("expiration", e.target.value)} /></Field>
          </>)}
          <div className="col-span-2">
            <Field label="Strategy"><select className="input" value={form.strategy} onChange={(e) => update("strategy", e.target.value)}>{STRATEGIES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select></Field>
            <p className="text-xs text-gray-400 mt-1">{stratDesc}</p>
          </div>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field></div>
          <div className="col-span-2">
            <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-5 py-2.5 font-medium shadow-lg shadow-emerald-900/40 transition">{loading ? "Saving..." : editingId ? "Save Changes" : (mode === "REAL" ? "Log Real Position" : "Open Paper Position")}</button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-2">Risk Meter</h3>
            <div className="mb-4"><Blobfish level={calc.riskPct} pct={calc.riskPct} /></div>
            <Metric label="Risk on this trade" value={calc.totalRisk ? "$" + calc.totalRisk.toFixed(2) : "—"} tone={riskTone} />
            <Metric label="% of account" value={calc.riskPct ? calc.riskPct.toFixed(2) + "%" : "—"} tone={riskTone} />
            <Metric label="Potential profit" value={calc.totalReward ? "$" + calc.totalReward.toFixed(2) : "—"} tone="text-emerald-400" />
            <Metric label="Risk : Reward" value={calc.rr ? "1 : " + calc.rr.toFixed(2) : "—"} tone={calc.rr >= 2 ? "text-emerald-400" : "text-gray-300"} />
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{view === "REAL" ? "Real Holdings" : "Open Positions"}</h2>
          {!alertsOn && <button onClick={enableAlerts} className="text-xs bg-gray-800 hover:bg-gray-700 rounded px-3 py-1">🔔 Enable alerts</button>}
        </div>
        {open.length === 0 ? (
          <p className="text-gray-400">No {view === "REAL" ? "real holdings" : "open positions"} yet.</p>
        ) : (
          <div className="space-y-3">
            {open.map((t) => {
              const price = prices[t.ticker];
              const u = unreal(t, price);
              const hit = hitStatus(t, price);
              const cls = hit === "STOP" ? "border-red-500/70 bg-red-950/30" : hit === "TARGET" ? "border-emerald-500/70 bg-emerald-950/30" : "hover:border-emerald-700";
              return (
                <div key={t.id} onClick={() => router.push("/trades/" + t.id)} className={"card p-4 cursor-pointer transition " + cls}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-lg">{t.ticker}</span>
                    {isReal(t) && <span className="text-xs px-2 py-0.5 rounded-full bg-pink-900/50 text-pink-200">💵 REAL</span>}
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (t.side === "BUY" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300")}>{t.side}</span>
                    <span className="text-gray-400 text-sm font-mono">{t.quantity} @ {t.entryPrice}{t.type === "OPTION" && t.strike ? " " + t.optionType + " " + t.strike : ""}</span>
                    <span className="text-sm font-mono text-gray-300">{price != null ? "Now: " + price.toFixed(2) : t.type === "OPTION" ? "live N/A" : "—"}</span>
                    <span className={"text-sm font-mono font-semibold " + (u == null ? "text-gray-500" : tone(u))}>{u == null ? "" : pnlStr(u)}</span>
                    {hit && <span className={"text-xs px-2 py-0.5 rounded-full font-semibold " + (hit === "STOP" ? "bg-red-900/60 text-red-200" : "bg-emerald-900/60 text-emerald-200")}>{hit === "STOP" ? "✋ Stop hit" : "🎯 Target hit"}</span>}
                    <span className="ml-auto flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); editStart(t); }} className="text-xs bg-gray-800 hover:bg-gray-700 rounded px-3 py-1">Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); closeTrade(t); }} className="text-xs bg-gray-800 hover:bg-gray-700 rounded px-3 py-1">Close</button>
                      <button onClick={(e) => { e.stopPropagation(); deleteTrade(t); }} className="text-xs text-gray-500 hover:text-red-400 px-2">✕</button>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">🕒 {fmtDate(t.createdAt)}{t.stopLoss != null ? " · stop " + t.stopLoss : ""}{t.target != null ? " · target " + t.target : ""} · tap for details →</div>
                  {t.aiComment?.text && <p className="mt-2 text-sm text-gray-300 border-l-2 border-emerald-700 pl-3">🤖 {t.aiComment.text}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Trade History</h2>
        {closed.length === 0 ? (
          <p className="text-gray-400">No closed trades yet.</p>
        ) : (
          <div className="space-y-3">
            {closed.map((t) => {
              const rr = realized(t);
              return (
                <div key={t.id} onClick={() => router.push("/trades/" + t.id)} className="card p-4 cursor-pointer hover:border-emerald-700 transition">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold">{t.ticker}</span>
                    {isReal(t) && <span className="text-xs px-2 py-0.5 rounded-full bg-pink-900/50 text-pink-200">💵 REAL</span>}
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (t.side === "BUY" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300")}>{t.side}</span>
                    <span className="text-gray-400 text-sm font-mono">{t.quantity} @ {t.entryPrice} → {t.exitPrice}</span>
                    <span className={"text-sm font-mono font-semibold " + tone(rr)}>{pnlStr(rr)}</span>
                    <span className="ml-auto flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); editStart(t); }} className="text-xs bg-gray-800 hover:bg-gray-700 rounded px-3 py-1">Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); deleteTrade(t); }} className="text-xs text-gray-500 hover:text-red-400 px-2">✕</button>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">🕒 {fmtDate(t.createdAt)} · tap for details →</div>
                  {t.aiComment?.text && <p className="mt-2 text-sm text-gray-300 border-l-2 border-emerald-700 pl-3">🤖 {t.aiComment.text}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (<label className="block"><span className="block text-xs text-gray-400 mb-1">{label}</span>{children}</label>);
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (<div className="stat"><div className="text-xs uppercase tracking-wide text-gray-400">{label}</div><div className={"text-2xl font-bold font-mono mt-1 " + (accent || "text-gray-100")}>{value}</div></div>);
}
function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (<div className="flex items-center justify-between py-1.5"><span className="text-sm text-gray-400">{label}</span><span className={"font-mono font-semibold " + tone}>{value}</span></div>);
}
