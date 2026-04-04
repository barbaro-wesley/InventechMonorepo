-- AddCompanyAddress
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "street"       TEXT,
  ADD COLUMN IF NOT EXISTS "number"       TEXT,
  ADD COLUMN IF NOT EXISTS "complement"   TEXT,
  ADD COLUMN IF NOT EXISTS "neighborhood" TEXT,
  ADD COLUMN IF NOT EXISTS "city"         TEXT,
  ADD COLUMN IF NOT EXISTS "state"        TEXT,
  ADD COLUMN IF NOT EXISTS "zip_code"     TEXT;
