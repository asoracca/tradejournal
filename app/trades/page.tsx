"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Trade = { id: string; ticker: string; type: string; side: string; quantity: number; entryPrice: number; exitPrice: number | null; status: string; createdAt: string };

function fmtDate(s: string) { try { return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return s; } }

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  useEffect(() => { fetch("/api/trades").then((r) => r.json()).then((d) => setTrades(Array.isArray(d) ? d : [])); }, []);
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">All Trades</h1>
      <p className="text-gray-500 text-sm">Click any trade for its chart, deep AI analysis, and related news.</p>
      {trades.length === 0 ? <p className="text-gray-500">No trades yet.</p> : (
        <div className="space-y-2">
          {trades.map((t) => (
            <Link key={t.id} href={"/trades/" + t.id} className="card p-4 flex items-center gap-3 flex-wrap hover:border-emerald-700 transition">
              <span className="font-bold">{t.ticker}</span>
              <span className={"text-xs px-2 py-0.5 rounded-full " + (t.side === "BUY" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300")}>{t.side}</span>
              <span className="text-gray-400 text-sm font-mono">{t.quantity} @ {t.entryPrice}{t.exitPrice != null ? " → " + t.exitPrice : ""}</span>
              <span className="text-xs text-gray-500 uppercase">{t.type}</span>
              <span className={"text-xs px-2 py-0.5 rounded-full " + (t.status === "OPEN" ? "bg-sky-900/50 text-sky-300" : "bg-gray-800 text-gray-400")}>{t.status}</span>
              <span className="ml-auto text-xs text-gray-600">{fmtDate(t.createdAt)} →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
