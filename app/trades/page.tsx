"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Trade = { id: string; ticker: string; type: string; side: string; quantity: number; entryPrice: number; exitPrice: number | null; status: string; mode: string; createdAt: string; tradeDate: string | null };

function fmtDate(t: Trade) { try { return new Date(t.tradeDate || t.createdAt).toLocaleDateString(); } catch { return ""; } }

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function load() { const d = await (await fetch("/api/trades")).json(); setTrades(Array.isArray(d) ? d : []); }
  useEffect(() => { load(); }, []);

  function toggle(id: string) { setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { setSel((s) => (s.size === trades.length ? new Set() : new Set(trades.map((t) => t.id)))); }

  async function bulk(action: "REAL" | "PAPER" | "DELETE" | "STRATEGY") {
    if (sel.size === 0) return;
    if (action === "DELETE" && !window.confirm("Delete " + sel.size + " trade(s)? This can't be undone.")) return;
    let strat = "";
    if (action === "STRATEGY") { strat = window.prompt("Set strategy for " + sel.size + " trade(s):", "Buy & Hold") || ""; if (!strat) return; }
    setBusy(true);
    for (const id of Array.from(sel)) {
      if (action === "DELETE") await fetch("/api/trades/" + id, { method: "DELETE" });
      else if (action === "STRATEGY") await fetch("/api/trades/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strategy: strat }) });
      else await fetch("/api/trades/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: action }) });
    }
    setSel(new Set()); await load(); setBusy(false);
  }

  const allChecked = trades.length > 0 && sel.size === trades.length;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <header>
        <h1 className="text-3xl font-bold gradient-text">All Trades</h1>
        <p className="text-gray-400 text-sm mt-1">Tick trades to bulk-edit — move to Real/Paper, set a strategy, or delete. Tap a row to open its details.</p>
      </header>

      {trades.length > 0 && (
        <div className="card p-3 flex items-center gap-3 flex-wrap sticky top-16 z-10">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-violet-500 w-4 h-4" />
            Select all <span className="text-gray-500">({sel.size} selected)</span>
          </label>
          {sel.size > 0 && (
            <div className="flex gap-2 ml-auto flex-wrap">
              <button disabled={busy} onClick={() => bulk("REAL")} className="text-xs bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-1.5 disabled:opacity-50">→ Real 💵</button>
              <button disabled={busy} onClick={() => bulk("PAPER")} className="text-xs bg-gray-700 hover:bg-gray-600 rounded px-3 py-1.5 disabled:opacity-50">→ Paper 📝</button>
              <button disabled={busy} onClick={() => bulk("STRATEGY")} className="text-xs bg-gray-700 hover:bg-gray-600 rounded px-3 py-1.5 disabled:opacity-50">Set strategy</button>
              <button disabled={busy} onClick={() => bulk("DELETE")} className="text-xs bg-red-700 hover:bg-red-600 rounded px-3 py-1.5 disabled:opacity-50">Delete</button>
            </div>
          )}
        </div>
      )}

      {busy && <p className="text-violet-300 text-sm">Updating {sel.size} trade(s)…</p>}

      {trades.length === 0 ? (
        <p className="text-gray-400">No trades yet.</p>
      ) : (
        <div className="space-y-2">
          {trades.map((t) => (
            <div key={t.id} className={"card p-3 flex items-center gap-3 " + (sel.has(t.id) ? "border-violet-500/60" : "")}>
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} className="accent-violet-500 w-4 h-4 shrink-0" />
              <Link href={"/trades/" + t.id} className="flex items-center gap-3 flex-1 flex-wrap min-w-0">
                <span className="font-bold">{t.ticker}</span>
                {t.mode === "REAL" && <span className="text-xs px-2 py-0.5 rounded-full bg-pink-900/50 text-pink-200">💵</span>}
                <span className={"text-xs px-2 py-0.5 rounded-full " + (t.side === "BUY" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300")}>{t.side}</span>
                <span className="text-gray-400 text-sm font-mono">{t.quantity} @ {t.entryPrice}{t.exitPrice != null ? " → " + t.exitPrice : ""}</span>
                <span className="text-xs text-gray-500 uppercase">{t.type}</span>
                <span className={"text-xs px-2 py-0.5 rounded-full " + (t.status === "OPEN" ? "bg-sky-900/50 text-sky-300" : "bg-gray-800 text-gray-400")}>{t.status}</span>
                <span className="ml-auto text-xs text-gray-600">{fmtDate(t)} →</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
