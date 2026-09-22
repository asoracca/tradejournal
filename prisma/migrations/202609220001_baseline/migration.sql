-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeDate" TIMESTAMP(3),
    "ticker" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "mode" TEXT NOT NULL DEFAULT 'PAPER',
    "account" TEXT NOT NULL DEFAULT 'Individual',
    "optionType" TEXT,
    "strike" DOUBLE PRECISION,
    "expiration" TEXT,
    "strategy" TEXT,
    "notes" TEXT,
    "emotion" TEXT,
    "rulesFollowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiComment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,

    CONSTRAINT "AiComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CongressTrade" (
    "id" TEXT NOT NULL,
    "representative" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "transactionDate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountLow" DOUBLE PRECISION,
    "amountHigh" DOUBLE PRECISION,

    CONSTRAINT "CongressTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiComment_tradeId_key" ON "AiComment"("tradeId");

-- AddForeignKey
ALTER TABLE "AiComment" ADD CONSTRAINT "AiComment_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
