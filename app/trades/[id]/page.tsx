"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";

type Trade = { id: string; ticker: string; type: string; side: string; quantity: number; entryPrice: number; exitPrice: number | null; status: string; createdAt: string; strategy: string | null; notes: string | null; optionType: string | null; strike: number | null; aiComment?: { text: string } | null };
type Hist = { date: string; close: number };
type News = { title: string; publisher: string; link: string; time: number };

export default function TradeDetail({ params }: { params: { id: string } }) {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [analysis, setAnalysis] = useState<string>("");
  const [loadingA, setLoadingA] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const t = await (await fetch("/api/trades/" + params.id)).json();
        if (!active) return;
        if (t.error) { setErr("Trade not found"); setLoadingA(false); return; }
        setTrade(t);
        const h = await (await fetch("/api/history?ticker=" + encodeURIComponent(t.ticker) + "&range=6mo")).json().catch(() => []);
        const hh = Array.isArray(h) ? h : [];
        if (active) setHist(hh);
        fetch("/api/news?ticker=" + encodeURIComponent(t.ticker)).then((r) => r.json()).then((d) => { if (active) setNews(d.news || []); }).catch(() => {});
        let trend = "";
        if (hh.length > 2) {
          const first = hh[0].close, last = hh[hh.length - 1].close;
          trend = "Over ~6 months the price moved from $" + first.toFixed(2) + " to $" + last.toFixed(2) + " (" + (((last - first) / first) * 100).toFixed(1) + "%).";
        }
        const summary = "Trade: " + t.side + " " + t.quantity + " " + t.ticker + " (" + t.type + ") at $" + t.entryPrice + ". " +
          (t.exitPrice != null ? "Closed at $" + t.exitPrice + "." : "Still open.") +
          " Strategy: " + (t.strategy || "n/a") + ". Notes: " + (t.notes || "none") + ". " + trend;
        const a = await (await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary }) })).json();
        if (active) { setAnalysis(a.analysis || ""); setLoadingA(false); }
      } catch (e) { if (active) { setErr((e as Error).message); setLoadingA(false); } }
    })();
    return () => { active = false; };
  }, [params.id]);

  if (err) return <div className="max-w-3xl mx-auto"><Link href="/trades" className="text-emerald-400 text-sm">← Back</Link><p className="text-gray-400 mt-4">{err}.</p></div>;
  if (!trade) return <div className="max-w-3xl mx-auto text-gray-500">Loading…</div>;

  const pnl = trade.exitPrice != null ? (trade.exitPrice - trade.entryPrice) * trade.quantity * (trade.type === "OPTION" ? 100 : 1) * (trade.side === "BUY" ? 1 : -1) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/trades" className="text-emerald-400 text-sm hover:underline">← Back to trades</Link>

      <header className="flex flex-wrap items-end gap-3">
        <h1 className="text-4xl font-bold gradient-text">{trade.ticker}</h1>
        <span className={"text-xs px-2 py-1 rounded-full " + (trade.side === "BUY" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300")}>{trade.side}</span>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400 uppercase">{trade.type}</span>
        <span className={"text-xs px-2 py-1 rounded-full " + (trade.status === "OPEN" ? "bg-sky-900/50 text-sky-300" : "bg-gray-800 text-gray-400")}>{trade.status}</span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat"><div className="text-xs uppercase text-gray-500">Entry</div><div className="text-xl font-bold font-mono mt-1">${trade.entryPrice}</div></div>
        <div className="stat"><div className="text-xs uppercase text-gray-500">Exit</div><div className="text-xl font-bold font-mono mt-1">{trade.exitPrice != null ? "$" + trade.exitPrice : "—"}</div></div>
        <div className="stat"><div className="text-xs uppercase text-gray-500">Quantity</div><div className="text-xl font-bold font-mono mt-1">{trade.quantity}</div></div>
        <div className="stat"><div className="text-xs uppercase text-gray-500">P&L</div><div className={"text-xl font-bold font-mono mt-1 " + (pnl == null ? "text-gray-400" : pnl >= 0 ? "text-emerald-400" : "text-red-400")}>{pnl == null ? "open" : (pnl >= 0 ? "+$" : "-$") + Math.abs(pnl).toFixed(2)}</div></div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-4">6-Month Price · entry &amp; exit marked</h2>
        {hist.length > 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={hist} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} minTickGap={40} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#6b7280" }} width={48} />
              <Tooltip contentStyle={{ background: "#0b0b12", border: "1px solid #1f2937", fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="close" stroke="#34d399" dot={false} strokeWidth={2} />
              <ReferenceLine y={trade.entryPrice} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: "Entry", fill: "#38bdf8", fontSize: 10, position: "insideTopLeft" }} />
              {trade.exitPrice != null && <ReferenceLine y={trade.exitPrice} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Exit", fill: "#f59e0b", fontSize: 10, position: "insideBottomLeft" }} />}
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 text-sm">No price history available for {trade.ticker}.</p>}
      </div>

      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-3">🤖 Deep AI Analysis</h2>
        {loadingA ? <p className="text-emerald-400 text-sm">Thinking…</p> : <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{analysis}</div>}
      </div>

      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-3">📰 Related News</h2>
        {news.length === 0 ? <p className="text-gray-500 text-sm">No recent headlines found.</p> : (
          <ul className="space-y-3">
            {news.map((n, i) => (
              <li key={i}>
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-200 hover:text-emerald-400">{n.title}</a>
                <div className="text-xs text-gray-600">{n.publisher}{n.time ? " · " + new Date(n.time * 1000).toLocaleDateString() : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
