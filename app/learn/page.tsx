type Item = { title: string; body: string; tag?: string };

const STYLES: Item[] = [
  { title: "Buy & Hold", tag: "Beginner", body: "Buy quality assets and hold for years, letting compounding work while you ignore daily noise. Lowest stress and time commitment. What you already do, and a perfectly strong approach." },
  { title: "Swing Trading", tag: "Intermediate", body: "Hold for days to weeks to capture one price swing. Needs some chart-reading and more attention than buy & hold." },
  { title: "Day Trading", tag: "Advanced", body: "Open and close within the same day, nothing held overnight. Fast and stressful, and most beginners lose money. Approach with real caution." },
  { title: "Scalping", tag: "Advanced", body: "Dozens of tiny trades for small gains each. Requires fast execution and iron discipline. Not where to start." },
];

const STRATS: Item[] = [
  { title: "Momentum", body: "Buy assets already moving up strongly on heavy volume, betting the trend continues. The trend is your friend. (Your momentum-factor-backtest repo studies exactly this.)" },
  { title: "Breakout", body: "Enter the moment price breaks above a ceiling (resistance) or below a floor (support), expecting a larger move to follow." },
  { title: "Mean Reversion", body: "Bet that a price stretched far from its average snaps back. The opposite mindset to momentum, and what an oversold RSI hints at." },
  { title: "Value", body: "Buy assets you judge cheaper than they are worth and wait for the market to agree. Patience-heavy." },
  { title: "Dividend / Income", body: "Hold shares mainly for the regular dividend cash they pay. Lower-growth, steadier." },
];

const OPTIONS: Item[] = [
  { title: "Call option", body: "The right to BUY a stock at a set price (strike) by a set date. Bought when you expect a rise. Cheaper than shares but can expire worthless." },
  { title: "Put option", body: "The right to SELL at a set price by a set date. Used to bet on a drop, or as insurance on shares you own." },
  { title: "Covered call", body: "You own 100 shares and SELL a call against them to collect premium income. A common first options strategy. The trade-off: your upside is capped if the stock soars." },
  { title: "Cash-secured put", body: "You SELL a put and set aside the cash to buy the shares if assigned. You collect premium and effectively get paid to wait to buy a stock cheaper." },
  { title: "Vertical spread", body: "Buy one option and sell another at a different strike. Caps both your risk and reward, and costs less than a naked option. A safer way to express a directional view." },
  { title: "Why options are riskier", body: "They have an expiration date and built-in leverage, so you can lose 100% fast, or more if you sell them uncovered. Learn on paper first." },
];

const FUTURES: Item[] = [
  { title: "What they are", body: "Contracts to buy or sell something (a stock index, oil, gold) at a future date. One contract controls a large notional amount." },
  { title: "Leverage & multipliers", body: "Each contract has a point multiplier (for example, S&P 500 E-mini = 50 dollars per point), so small index moves become large dollar swings. A few percent against you can wipe out your margin." },
  { title: "When to use", body: "Hedging or expressing a macro view, by experienced traders. The highest-risk, most advanced product here. Paper-trade for a long while first." },
];

const RISK: Item[] = [
  { title: "The 1-2% rule", body: "Never risk more than 1-2% of your account on a single trade. On a 20,000 dollar account that is 200-400 dollars of risk per trade. This single habit is what keeps beginners in the game." },
  { title: "Risk = entry minus stop", body: "Your risk per share is the distance from your entry to your stop loss. Risk per share times shares times any multiplier = your dollar risk. Size your position so that number stays inside your 1-2%." },
  { title: "Reward-to-risk (R:R)", body: "Aim to make at least twice what you risk (1:2). With a 1:2 R:R you can be right less than half the time and still come out ahead. TradeGoons computes this for you on every trade." },
  { title: "Always set a stop first", body: "Decide where you are wrong BEFORE you enter, not after you are down. A plan made while calm beats a decision made while panicking." },
];

const FACTORS: Item[] = [
  { title: "Alpha vs beta", body: "Beta is return you earn just by taking on a known risk (the market going up). Alpha is return from genuine skill, above and beyond those known risks. The whole game in quant is finding real alpha." },
  { title: "The classic factors", body: "Decades of research found a few persistent drivers of return: the Market itself, Size (small vs large), Value (cheap vs expensive), and Momentum (recent winners). A strategy often just loads on these rather than adding skill." },
  { title: "Why it matters", body: "A strategy can look great until you regress its returns against these factors. If the leftover alpha is near zero, you were just buying factors everyone already knows. That is exactly what your Fama-French analysis showed for the momentum backtest: a 0.84 momentum loading and no real alpha." },
  { title: "The takeaway", body: "Before trusting any edge, ask: is this skill, or just factor exposure I could get more cheaply? Separating the two is the first test a real quant fund applies." },
];

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Long / Short", def: "Long = you profit if it rises. Short = you profit if it falls." },
  { term: "Stop loss", def: "A price where you exit to cap a loss." },
  { term: "Take profit / target", def: "A price where you exit to lock in a gain." },
  { term: "Volatility", def: "How much a price swings. Higher = bigger moves, more risk." },
  { term: "Implied volatility (IV)", def: "The volatility the options market is pricing in for the future." },
  { term: "Drawdown", def: "The drop from a peak to a trough. Max drawdown = worst-case pain." },
  { term: "Sharpe ratio", def: "Return earned per unit of risk. Above 1 is good, above 2 is excellent." },
  { term: "Leverage", def: "Using borrowed exposure to amplify gains and losses. A double-edged sword." },
  { term: "Cost basis", def: "What you paid on average for a position. Drives your profit/loss and taxes." },
];

export default function LearnPage() {
  const toc = [["styles", "Styles"], ["strategies", "Strategies"], ["options", "Options"], ["futures", "Futures"], ["risk", "Risk"], ["factors", "Factors & Alpha"], ["glossary", "Glossary"]];
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-bold gradient-text">Trading 101 — TradeGoons Mini-Course</h1>
        <p className="text-gray-400 text-sm mt-1">Plain-English foundations, from buy-and-hold to the alpha-vs-beta thinking real quants use.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {toc.map(([id, label]) => <a key={id} href={"#" + id} className="text-xs card px-3 py-1.5 text-gray-300 hover:text-emerald-400">{label}</a>)}
        </div>
      </header>

      <Section id="styles" title="Investing styles" items={STYLES} />
      <Section id="strategies" title="Common stock strategies" items={STRATS} />
      <Section id="options" title="Options" items={OPTIONS} />
      <Section id="futures" title="Futures" items={FUTURES} />
      <Section id="risk" title="Risk management — the part that matters most" items={RISK} />

      <section id="factors" className="scroll-mt-20">
        <h2 className="text-xl font-bold mb-4">Factors &amp; alpha vs beta</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {FACTORS.map((it) => (
            <div key={it.title} className="card p-4">
              <h3 className="font-semibold mb-1">{it.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="glossary" className="scroll-mt-20">
        <h2 className="text-xl font-bold mb-4">Glossary</h2>
        <div className="card divide-y divide-white/5">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="p-3 flex gap-4 text-sm">
              <span className="font-semibold text-gray-200 w-40 shrink-0">{g.term}</span>
              <span className="text-gray-400">{g.def}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="card p-6 text-center">
        <p className="text-sm text-gray-300">Ready to practice? Open a paper position on the <a href="/" className="text-emerald-400 hover:underline">Dashboard</a> and watch the risk blobfish, or ask the <a href="/coach" className="text-emerald-400 hover:underline">AI Coach</a> anything.</p>
      </div>
    </div>
  );
}

function Section({ id, title, items }: { id: string; title: string; items: Item[] }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((it) => (
          <div key={it.title} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{it.title}</h3>
              {it.tag && <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-white/10 text-gray-400">{it.tag}</span>}
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
