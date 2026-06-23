"use client";

import { useState } from "react";

type Contract = { contractSymbol: string; strike: number; bid: number; ask: number; lastPrice: number; impliedVolatility: number; volume: number; openInterest: number; inTheMoney: boolean };
type Chain = { underlyingPrice: number; expirationDates: number[]; calls: Contract[]; puts: Contract[] };

export default function OptionsPage() {
  const [ticker, setTicker] = useState("");
  const [chain, setChain] = useState<Chain | null>(null);
  const [exp, setExp] = useState<number | null>(null);
  const [side, setSide] = useState<"calls" | "puts">("calls");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trading, setTrading] = useState<Contract | null>(null);
  const [qty, setQty] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);

  async function load(expiration?: number) {
    const tk = ticker.trim();
    if (!tk) return;
    setLoading(true); setError(null); setMsg(null);
    try {
      const url = "/api/options?ticker=" + encodeURIComponent(tk) + (expiration ? "&expiration=" + expiration : "");
      const r = await fetch(url);
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Failed to load chain");
      setChain(data);
      setExp(expiration ?? (data.expirationDates && data.expirationDates[0]) ?? null);
    } catch (e) { setError((e as Error).message); setChain(null); }
    finally { setLoading(false); }
  }

  async function placeTrade() {
    if (!trading || !chain) return;
    const entry = trading.lastPrice || trading.ask || trading.bid || 0;
    const optType = side === "calls" ? "CALL" : "PUT";
    await fetch("/api/trades", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker.trim().toUpperCase(), type: "OPTION", side: "BUY", quantity: qty, entryPrice: entry,
        optionType: optType, strike: trading.strike,
        expiration: exp ? new Date(exp * 1000).toISOString().slice(0, 10) : "",
        strategy: "Options", notes: "From options chain",
      }),
    });
    setMsg("Paper-traded " + qty + "x " + ticker.trim().toUpperCase() + " " + trading.strike + " " + optType + " @ $" + entry.toFixed(2) + " — check your Dashboard.");
    setTrading(null);
  }

  const rowsAll = chain ? (side === "calls" ? chain.calls : chain.puts) : [];
  const rows = chain ? [...rowsAll].sort((a, b) => Math.abs(a.strike - chain.underlyingPrice) - Math.abs(b.strike - chain.underlyingPrice)).slice(0, 24).sort((a, b) => a.strike - b.strike) : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold gradient-text">Options Chain</h1>
        <p className="text-gray-400 text-sm mt-1">Live calls & puts. Tap any contract to paper-trade it.</p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="card p-4 flex gap-2 items-end">
        <label className="flex-1"><span className="block text-xs text-gray-400 mb-1">Ticker</span><input className="input uppercase" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" /></label>
        <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-5 py-2 font-medium">{loading ? "…" : "Load"}</button>
      </form>

      {error && <div className="card border-red-800/60 p-4 text-sm text-red-300">⚠ {error}</div>}
      {msg && <div className="card p-4 text-sm text-emerald-300">✓ {msg}</div>}

      {chain && (
        <>
          <div className="card p-4 flex flex-wrap items-center gap-4">
            <div><div className="text-xs text-gray-400">Spot</div><div className="font-mono font-bold">${chain.underlyingPrice?.toFixed(2)}</div></div>
            <label className="text-sm"><span className="text-gray-400 mr-2">Expiration</span>
              <select className="input inline-block w-auto" value={exp ?? ""} onChange={(e) => load(Number(e.target.value))}>
                {(chain.expirationDates || []).map((d) => <option key={d} value={d}>{new Date(d * 1000).toLocaleDateString()}</option>)}
              </select>
            </label>
            <div className="ml-auto flex gap-1 text-sm">
              <button onClick={() => setSide("calls")} className={"px-3 py-1 rounded " + (side === "calls" ? "bg-emerald-600" : "bg-gray-800")}>Calls</button>
              <button onClick={() => setSide("puts")} className={"px-3 py-1 rounded " + (side === "puts" ? "bg-pink-600" : "bg-gray-800")}>Puts</button>
            </div>
          </div>

          <div className="card p-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-left text-xs"><tr><th className="py-1">Strike</th><th>Last</th><th>Bid</th><th>Ask</th><th>IV</th><th>Vol</th><th></th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.contractSymbol} className={"border-t border-gray-800 " + (c.inTheMoney ? "bg-pink-950/20" : "")}>
                    <td className="py-1.5 font-mono font-medium">{c.strike}</td>
                    <td className="font-mono">{c.lastPrice?.toFixed(2)}</td>
                    <td className="font-mono text-gray-400">{c.bid?.toFixed(2)}</td>
                    <td className="font-mono text-gray-400">{c.ask?.toFixed(2)}</td>
                    <td className="font-mono text-gray-400">{c.impliedVolatility ? (c.impliedVolatility * 100).toFixed(0) + "%" : "—"}</td>
                    <td className="font-mono text-gray-500">{c.volume ?? 0}</td>
                    <td><button onClick={() => { setTrading(c); setQty("1"); setMsg(null); }} className="text-xs bg-gray-800 hover:bg-emerald-700 rounded px-2 py-0.5">trade</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="text-gray-500 text-sm p-2">No contracts found.</p>}
          </div>
        </>
      )}

      {trading && (
        <div className="card p-5 space-y-3 border-emerald-700/50">
          <h2 className="font-semibold">Paper-trade {ticker.trim().toUpperCase()} {trading.strike} {side === "calls" ? "CALL" : "PUT"}</h2>
          <p className="text-xs text-gray-400">Entry ≈ ${(trading.lastPrice || trading.ask || trading.bid || 0).toFixed(2)} per contract · 1 contract = 100 shares. Exp {exp ? new Date(exp * 1000).toLocaleDateString() : "—"}.</p>
          <label className="block max-w-[160px]"><span className="block text-xs text-gray-400 mb-1">Contracts</span><input className="input" type="number" step="1" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          <div className="flex gap-2">
            <button onClick={placeTrade} className="bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2 text-sm font-medium">Add to journal</button>
            <button onClick={() => setTrading(null)} className="text-sm text-gray-400 hover:text-gray-200 px-3">cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
