"use client";

import { useEffect, useState } from "react";

type Trade = {
  id: string; ticker: string; type: string; side: string;
  quantity: number; entryPrice: number; status: string;
};

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  useEffect(() => {
    fetch("/api/trades").then((r) => r.json()).then((d) => setTrades(Array.isArray(d) ? d : []));
  }, []);
  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">All Trades</h1>
      {trades.length === 0 ? (
        <p className="text-gray-500">No trades yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-left">
            <tr><th className="py-2">Ticker</th><th>Type</th><th>Side</th><th>Qty</th><th>Entry</th><th>Status</th></tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-t border-gray-800">
                <td className="py-2 font-medium">{t.ticker}</td>
                <td>{t.type}</td>
                <td className={t.side === "BUY" ? "text-emerald-400" : "text-red-400"}>{t.side}</td>
                <td>{t.quantity}</td>
                <td>{t.entryPrice}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
