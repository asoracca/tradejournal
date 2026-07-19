# TradeGoons

A deployed paper-trading journal and educational trade coach for stocks, options, and futures.

[Live demo](https://tradejournal-three-liard.vercel.app)

## What it does

- Records, edits, closes, and reviews paper trades
- Tracks entries, exits, stops, targets, emotions, and rule adherence
- Supports stock, option, and futures trade records
- Retrieves quotes, price history, news, and option chains
- Produces educational AI commentary and portfolio reviews when Gemini is configured
- Includes a risk-focused learning section and installable web-app manifest
- Stores application data in PostgreSQL through Prisma

The AI features are educational. They do not provide buy/sell recommendations or price predictions. Market data comes from unofficial public endpoints and is suitable for a portfolio demo, not production trading.

## Stack

- Next.js 14 and React 18
- TypeScript and Tailwind CSS
- Prisma with PostgreSQL/Supabase
- Google Gemini for optional coaching features
- Vercel for deployment

## Local setup

```bash
git clone https://github.com/asoracca/tradejournal.git
cd tradejournal
npm install
cp .env.example .env
```

Add PostgreSQL connection strings to `.env`:

```env
DATABASE_URL=""
DIRECT_URL=""
GEMINI_API_KEY=""
```

`GEMINI_API_KEY` is optional; the journal should still work without AI coaching.

Initialize the database and run the app:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`.

## Useful commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:studio
```

## Architecture

```text
Next.js pages
    |
    +-- API routes -- Prisma -- PostgreSQL
    |
    +-- market-data adapters -- public market endpoints
    |
    +-- optional AI routes -- Gemini
```

## Current limitations

- This is a paper-trading and education application, not a brokerage.
- It does not submit live orders or guarantee real-time market data.
- Authentication and multi-user data isolation are not implemented yet.
- External market-data endpoints may change without notice.

## Sensible next steps

1. Add authentication and user-owned records.
2. Add API-route and portfolio-calculation tests.
3. Replace unofficial market-data calls with a documented provider.
4. Add CSV import/export and a reproducible demo account.
