-- Additive cutover: existing Prisma-owned rows, decimals and ownership remain intact.
-- Run with the migration role, never the HTTP application role.
CREATE INDEX "Trade_owner_portfolio_idx" ON public."Trade" ("userId", mode, account, status);
