CREATE TABLE "LoginAttempt" (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "LoginAttempt_expiresAt_idx" ON "LoginAttempt"("expiresAt");
ALTER TABLE "Trade" ADD CONSTRAINT option_type_required CHECK (type <> 'OPTION' OR "optionType" IS NOT NULL);
