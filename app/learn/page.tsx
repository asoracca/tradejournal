type Item = { title: string; body: string; tag?: string };

const STYLES: Item[] = [
  { title: "Buy & Hold", tag: "Beginner", body: "Buy quality assets and hold for years, ignoring daily noise while compounding works. Lowest stress and time commitment — this is what you do now, and it's a perfectly solid approach." },
  { title: "Swing Trading", tag: "Intermediate", body: "Hold for days to weeks to capture one price 'swing.' Needs some chart-reading and more attention than buy & hold." },
  { title: "Day Trading", tag: "Advanced", body: "Open and close within the same day, nothing held overnight. Fast and stressful; most beginners lose money — approach with real caution." },
  { title: "Scalping", tag: "Advanced", body: "Many tiny trades for small gains each. Requires fast execution and iron discipline." },
];

const STRATS: Item[] = [
  { title: "Momentum", body: "Buy assets already moving up strongly on heavy volume, betting the trend continues. 'The trend is your friend.'" },
  { title: "Breakout", body: "Enter the moment price breaks above a ceiling (resistance) or below a floor (support), expecting a larger move to follow." },
  { title: "Mean Reversion", body: "Bet that a price stretched far from its average snaps back. The opposite mindset to momentum." },
  { title: "Value", body: "Buy assets you believe are cheaper than they're worth, then wait for the market to catch up." },
  { title: "Dividend / Income", body: "Hold shares mainly for the regular dividend cash they pay out." },
];

const OPTIONS: Item[] = [
  { title: "Call option", body: "The right to BUY a stock at a set price by a set date. Bought when you expect the price to rise. Cheaper than shares, but can expire worthless." },
  { title: "Put option", body: "The right to SELL a stock at a set price by a set date. Used to bet on a drop, or to insure shares you already own." },
  { title: "Covered call", body: "You own 100 shares and sell a call against them to collect income. A common 'first options' strategy." },
  { title: "Why riskier", body: "Options expire and use leverage — you can lose 100% quickly, or more if you sell them uncovered. Always practice on paper first." },
];

const FUTURES: Item[] = [
  { title: "What they are", body: "Contracts to buy/sell something (a stock index, oil, gold) at a future date. One contract controls a large amount, so small price moves create big dollar swings." },
  { title: "Leverage warning", body: "Futures are highly leveraged — a few percent against you can wipe out your margin. The most advanced, highest-risk product here. Paper-trade for a long while first." },
];

export default function LearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-bold gradient-text">Trading 101</h1>
        <p className="text-gray-500 text-sm mt-1">Plain-English explanations. You already buy & hold — a great base. Here's what the other terms mean.</p>
      </header>
      <Section title="Investing styles" items={STYLES} />
      <Section title="Common stock strategies" items={STRATS} />
      <Section title="Options basics" items={OPTIONS} />
      <Section title="Futures basics" items={FUTURES} />
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-3">The one rule that matters most</h2>
        <p className="text-gray-300 text-sm leading-relaxed">Protect your money first. Risk only <span className="text-emerald-400">1–2%</span> of your account on any single trade, always set a stop loss, and aim to make at least twice what you risk (a 1:2 reward-to-risk). The dashboard calculates all of this for you each time you log a trade.</p>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((it) => (
          <div key={it.title} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{it.title}</h3>
              {it.tag && <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{it.tag}</span>}
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
