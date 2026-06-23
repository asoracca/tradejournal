"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

type Trade = {
  id: string; createdAt: string; ticker: string; type: string; side: string;
  quantity: number; entryPrice: number; exitPrice: number | null; status: string;
  optionType: string | null; strike: number | null; notes: string | null;
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

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [accountSize, setAccountSize] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTrades() {
    try {
      const res = await fetch("/api/trades");
      if (!res.ok) throw new Error("Couldn't reach the database");
      const data = await res.json();
      setTrades(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }

  useEffect(() => { loadTrades(); }, []);

  function update(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  const mult = form.type === "OPTION" ? 100 : 1;
  const calc = useMemo(() => {
    const entry = num(form.entryPrice), stop = num(form.stopLoss), target = num(form.target);
    const qty = num(form.quantity), acct = num(accountSize);
    const riskPerUnit = stop ? Math.abs(entry - stop) : 0;
    const rewardPerUnit = target ? Math.abs(target - entry) : 0;
    const totalRisk = riskPerUnit * qty * mult;
    const totalReward = rewardPerUnit * qty * mult;
    const riskPct = acct ? (totalRisk / acct) * 100 : 0;
    const rr = totalRisk ? totalReward / totalRisk : 0;
    return { totalRisk, totalReward, riskPct, rr };
  }, [form.entryPrice, form.stopLoss, form.target, form.quantity, accountSize, mult]);

  const riskTone = calc.riskPct === 0 ? "text-gray-400"
    : calc.riskPct <= 1 ? "text-emerald-400"
    : calc.riskPct <= 2 ? "text-yellow-400" : "text-red-400";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const noteExtras = [
        form.notes,
        form.stopLoss ? "Stop: " + form.stopLoss : "",
        form.target ? "Target: " + form.target : "",
        calc.riskPct ? "Risk: " + calc.riskPct.toFixed(2) + "% ($" + calc.totalRisk.toFixed(0) + ")" : "",
        calc.rr ? "R:R 1:" + calc.rr.toFixed(2) : "",
      ].filter(Boolean).join(" | ");
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, notes: noteExtras }),
      });
      if (!res.ok) throw new Error("Failed to save trade");
      setForm(emptyForm);
      await loadTrades();
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  const stats = useMemo(() => {
    const total = trades.length;
    const open = trades.filter((t) => t.status === "OPEN").length;
    const closed = trades.filter((t) => t.status !== "OPEN");
    const wins = closed.filter((t) => t.exitPrice != null &&
      (t.side === "BUY" ? t.exitPrice > t.entryPrice : t.exitPrice < t.entryPrice)).length;
    const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
    return { total, open, closed: closed.length, winRate };
  }, [trades]);

  const isOption = form.type === "OPTION";
  const maxRisk = num(accountSize) * 0.02;
  const stratDesc = STRATEGIES.find((s) => s.name === form.strategy)?.desc;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Trading Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Plan every trade. Know your risk before you enter.</p>
          <a href="/learn" className="text-xs text-emerald-400 hover:underline">New to trading? Read the quick guide →</a>
        </div>
        <label className="card px-4 py-2 flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Account Size</span>
          <span className="text-gray-500">$</span>
          <input className="bg-transparent w-28 outline-none text-emerald-400 font-mono" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} />
        </label>
      </header>

      {error && (
        <div className="card border-red-800/60 p-4 text-sm text-red-300">
          ⚠ {error}. This usually means the live database password in Vercel needs updating (see chat).
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Trades" value={String(stats.total)} />
        <Stat label="Open" value={String(stats.open)} accent="text-emerald-400" />
        <Stat label="Closed" value={String(stats.closed)} />
        <Stat label="Win Rate" value={stats.closed ? stats.winRate + "%" : "—"} accent="text-emerald-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-6 lg:col-span-2 grid grid-cols-2 gap-4">
          <h2 className="col-span-2 text-lg font-semibold flex items-center gap-2"><span className="text-emerald-400">▮</span> Log a Trade</h2>
          <Field label="Ticker"><input className="input uppercase" value={form.ticker} onChange={(e) => update("ticker", e.target.value)} placeholder="AAPL" required /></Field>
          <Field label="Type"><select className="input" value={form.type} onChange={(e) => update("type", e.target.value)}><option value="STOCK">Stock</option><option value="OPTION">Option</option><option value="FUTURE">Future</option></select></Field>
          <Field label="Side"><select className="input" value={form.side} onChange={(e) => update("side", e.target.value)}><option value="BUY">Buy / Long</option><option value="SELL">Sell / Short</option></select></Field>
          <Field label="Quantity"><input className="input" type="number" step="any" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} required /></Field>
          <Field label="Entry Price"><input className="input" type="number" step="any" value={form.entryPrice} onChange={(e) => update("entryPrice", e.target.value)} required /></Field>
          <Field label="Stop Loss"><input className="input" type="number" step="any" value={form.stopLoss} onChange={(e) => update("stopLoss", e.target.value)} placeholder="protect downside" /></Field>
          <Field label="Target / Take Profit"><input className="input" type="number" step="any" value={form.target} onChange={(e) => update("target", e.target.value)} placeholder="profit goal" /></Field>
          {isOption && (<>
            <Field label="Call / Put"><select className="input" value={form.optionType} onChange={(e) => update("optionType", e.target.value)}><option value="CALL">Call</option><option value="PUT">Put</option></select></Field>
            <Field label="Strike"><input className="input" type="number" step="any" value={form.strike} onChange={(e) => update("strike", e.target.value)} /></Field>
            <Field label="Expiration"><input className="input" type="date" value={form.expiration} onChange={(e) => update("expiration", e.target.value)} /></Field>
          </>)}
          <div className="col-span-2">
            <Field label="Strategy"><select className="input" value={form.strategy} onChange={(e) => update("strategy", e.target.value)}>{STRATEGIES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select></Field>
            <p className="text-xs text-gray-500 mt-1">{stratDesc}</p>
          </div>
          <div className="col-span-2"><Field label="Emotion"><input className="input" value={form.emotion} onChange={(e) => update("emotion", e.target.value)} placeholder="calm, fomo..." /></Field></div>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field></div>
          <div className="col-span-2 flex items-center gap-3 flex-wrap">
            <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-5 py-2.5 font-medium shadow-lg shadow-emerald-900/40 transition">{loading ? "Saving..." : "Add Trade"}</button>
            <span className="text-xs text-gray-500">Recommended max risk: <span className="text-emerald-400 font-mono">${maxRisk.toFixed(0)}</span> (2%)</span>
          </div>
        </form>

        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-4">Risk Analysis</h3>
            <Metric label="Risk on this trade" value={calc.totalRisk ? "$" + calc.totalRisk.toFixed(2) : "—"} tone={riskTone} />
            <Metric label="% of account" value={calc.riskPct ? calc.riskPct.toFixed(2) + "%" : "—"} tone={riskTone} />
            <Metric label="Potential profit" value={calc.totalReward ? "$" + calc.totalReward.toFixed(2) : "—"} tone="text-emerald-400" />
            <Metric label="Risk : Reward" value={calc.rr ? "1 : " + calc.rr.toFixed(2) : "—"} tone={calc.rr >= 2 ? "text-emerald-400" : "text-gray-300"} />
            <div className="mt-4 text-xs leading-relaxed text-gray-400 border-t border-gray-800 pt-3">
              {calc.riskPct === 0 ? "Add an entry, stop loss and quantity to see your risk."
                : calc.riskPct <= 2 ? "✓ Risk is within the beginner-safe 1–2% range."
                : "⚠ This risks more than 2% of your account. Consider a tighter stop or smaller size."}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-3">🤖 Starter Tips</h3>
            <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
              <li>Risk only 1–2% of your account per trade.</li>
              <li>Always set a stop loss before entering.</li>
              <li>Aim for a Risk:Reward of 1:2 or better.</li>
              <li>Write down your reason — review it later.</li>
            </ul>
            <a href="/learn" className="mt-3 inline-block text-xs text-emerald-400 hover:underline">Read full strategy guide →</a>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-4">Recent Trades</h2>
        {trades.length === 0 ? (
          <p className="text-gray-500">{error ? "Can't load trades yet." : "No trades yet. Add one above."}</p>
        ) : (
          <div className="space-y-3">
            {trades.map((t) => (
              <div key={t.id} className="card p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-lg">{t.ticker}</span>
                  <span className={"text-xs px-2 py-0.5 rounded-full " + (t.side === "BUY" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300")}>{t.side}</span>
                  <span className="text-gray-400 text-sm font-mono">{t.quantity} @ {t.entryPrice}{t.type === "OPTION" && t.strike ? " " + t.optionType + " " + t.strike : ""}</span>
                  <span className="ml-auto text-xs text-gray-500 uppercase">{t.type}</span>
                </div>
                {t.notes && <p className="mt-2 text-xs text-gray-500 font-mono">{t.notes}</p>}
                {t.aiComment?.text && <p className="mt-2 text-sm text-gray-300 border-l-2 border-emerald-700 pl-3">🤖 {t.aiComment.text}</p>}
              </div>
            ))}
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
  return (<div className="stat"><div className="text-xs uppercase tracking-wide text-gray-500">{label}</div><div className={"text-2xl font-bold font-mono mt-1 " + (accent || "text-gray-100")}>{value}</div></div>);
}
function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (<div className="flex items-center justify-between py-1.5"><span className="text-sm text-gray-400">{label}</span><span className={"font-mono font-semibold " + tone}>{value}</span></div>);
}
