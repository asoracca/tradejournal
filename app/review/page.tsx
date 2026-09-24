"use client";

import { useEffect, useState } from "react";

type Trade = {
  id: string;
  ticker: string;
  type: string;
  side: string;
  quantity: number;
  entryPrice: number;
  status: string;
  mode: string;
  costBasis: string;
};
const LEV3 = [
  "SOXL",
  "SOXS",
  "TQQQ",
  "SQQQ",
  "KORU",
  "UPRO",
  "SPXL",
  "SPXU",
  "TNA",
  "TZA",
  "LABU",
  "LABD",
  "NUGT",
  "DUST",
  "YINN",
  "YANG",
  "UDOW",
  "SDOW",
  "FNGU",
  "BULZ",
  "WEBL",
  "FAS",
  "FAZ",
];
type Concentration = { ticker: string; notional: string; percent: string };

export default function ReviewPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [concentration, setConcentration] = useState<Concentration[]>([]);
  const [totalCost, setTotalCost] = useState("0.00");
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/trades");
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Trades unavailable");
        const ledgerResponse = await fetch("/api/ledger?mode=PAPER");
        const ledger = await ledgerResponse.json();
        if (!ledgerResponse.ok)
          throw Error(ledger.error || "Portfolio unavailable");
        if (active) {
          setConcentration(ledger.concentration);
          setTotalCost(ledger.costBasis);
        }
        const open = (Array.isArray(data) ? data : []).filter(
          (t: Trade) => t.status === "OPEN" && t.mode === "PAPER",
        );
        if (active) setTrades(open);
        if (open.length === 0) {
          if (active) setLoading(false);
          return;
        }
        const lines = open
          .map((t: Trade) => {
            const n = t.costBasis;
            return (
              "- " +
              t.side +
              " " +
              t.quantity +
              " " +
              t.ticker +
              " (" +
              t.type +
              ")" +
              (LEV3.includes(t.ticker) ? " [3x leveraged ETF]" : "") +
              ", ~$" +
              n
            );
          })
          .join("\n");
        const summary =
          "Open paper portfolio, " +
          open.length +
          " positions, total notional $" +
          ledger.costBasis +
          ":\n" +
          lines;
        const r = await (
          await fetch("/api/portfolio-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summary }),
          })
        ).json();
        if (active) {
          setReview(r.review || "");
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          setErr((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const rows = concentration.map((row) => ({
    ticker: row.ticker,
    notional: row.notional,
    pct: Number(row.percent),
  }));
  const levCount = trades.filter((t) => LEV3.includes(t.ticker)).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold gradient-text">
          AI Portfolio Review
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          The AI looks at your open paper positions together — concentration,
          leverage, and what to watch.
        </p>
      </header>

      {err && (
        <p role="alert" className="text-red-400">
          {err}
        </p>
      )}
      {trades.length === 0 && !loading && !err ? (
        <div className="card p-6 text-gray-400">
          No open positions yet. Open some on the Dashboard, then come back.
        </div>
      ) : (
        <>
          <div className="card p-5">
            <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-3">
              Concentration · {rows.length} names · ${totalCost} total
              {levCount ? " · " + levCount + " leveraged ⚡" : ""}
            </h2>
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.ticker}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {r.ticker}
                      {LEV3.includes(r.ticker) ? " ⚡" : ""}
                    </span>
                    <span className="text-gray-400 font-mono">
                      {r.pct.toFixed(0)}% · ${r.notional}
                    </span>
                  </div>
                  <div className="h-2 bg-pink-950/40 rounded mt-1">
                    <div
                      className="h-2 rounded bg-gradient-to-r from-pink-400 to-fuchsia-500"
                      style={{ width: r.pct + "%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-3">
              🤖 The AI&apos;s take
            </h2>
            {loading ? (
              <p className="text-pink-300 text-sm">
                Reviewing your whole book…
              </p>
            ) : err ? (
              <p className="text-red-400 text-sm">{err}</p>
            ) : (
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">
                {review}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
