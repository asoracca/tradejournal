-- Preserve every original row and float bit pattern. Never expose unowned data.
CREATE SCHEMA legacy_unowned;
REVOKE ALL ON SCHEMA legacy_unowned FROM PUBLIC;
ALTER TABLE "AiComment" SET SCHEMA legacy_unowned;
ALTER TABLE "Trade" SET SCHEMA legacy_unowned;
ALTER TABLE "Asset" SET SCHEMA legacy_unowned;
ALTER TABLE "CongressTrade" SET SCHEMA legacy_unowned;
-- CreateTable
CREATE TABLE "Trade" (
    "userId" TEXT NOT NULL,
    "importKey" TEXT,
    "closedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeDate" TIMESTAMP(3),
    "ticker" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "entryPrice" DECIMAL(20,6) NOT NULL,
    "exitPrice" DECIMAL(20,6),
    "stopLoss" DECIMAL(20,6),
    "target" DECIMAL(20,6),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "mode" TEXT NOT NULL DEFAULT 'PAPER',
    "account" TEXT NOT NULL DEFAULT 'Individual',
    "optionType" TEXT,
    "strike" DECIMAL(20,6),
    "expiration" TEXT,
    "strategy" TEXT,
    "notes" TEXT,
    "emotion" TEXT,
    "rulesFollowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiComment" (
    "userId" TEXT NOT NULL,
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
    "amountLow" DECIMAL(20,6),
    "amountHigh" DECIMAL(20,6),

    CONSTRAINT "CongressTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trade_userId_status_createdAt_idx" ON "Trade"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_id_userId_key" ON "Trade"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_userId_importKey_key" ON "Trade"("userId", "importKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiComment_tradeId_key" ON "AiComment"("tradeId");

-- CreateIndex
CREATE INDEX "AiComment_userId_idx" ON "AiComment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiComment_tradeId_userId_key" ON "AiComment"("tradeId", "userId");

-- CreateIndex
CREATE INDEX "Asset_userId_createdAt_idx" ON "Asset"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_id_userId_key" ON "Asset"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiComment" ADD CONSTRAINT "AiComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiComment" ADD CONSTRAINT "AiComment_tradeId_userId_fkey" FOREIGN KEY ("tradeId", "userId") REFERENCES "Trade"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Trade" ADD CONSTRAINT trade_values CHECK (
 quantity > 0 AND quantity <= 999999999 AND "entryPrice" > 0 AND "entryPrice" <= 999999999
 AND ("exitPrice" IS NULL OR ("exitPrice" >= 0 AND "exitPrice" <= 999999999))
 AND ("stopLoss" IS NULL OR ("stopLoss" >= 0 AND "stopLoss" <= 999999999))
 AND (target IS NULL OR (target >= 0 AND target <= 999999999))
 AND (strike IS NULL OR (strike >= 0 AND strike <= 999999999))
 AND type IN ('STOCK', 'OPTION') AND side IN ('BUY','SELL') AND mode IN ('PAPER','REAL')
 AND ((status = 'OPEN' AND "exitPrice" IS NULL AND "closedAt" IS NULL) OR (status = 'CLOSED' AND "exitPrice" IS NOT NULL AND "closedAt" IS NOT NULL))
 AND (type <> 'OPTION' OR ("optionType" IN ('CALL','PUT') AND strike IS NOT NULL AND expiration IS NOT NULL AND quantity = trunc(quantity)))
);
ALTER TABLE "Asset" ADD CONSTRAINT asset_value CHECK (value >= 0 AND value <= 999999999);
