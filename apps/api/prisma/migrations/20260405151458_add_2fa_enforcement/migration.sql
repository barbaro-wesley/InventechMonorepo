-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "enforce_2fa_for_all" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "require_2fa" BOOLEAN NOT NULL DEFAULT false;
