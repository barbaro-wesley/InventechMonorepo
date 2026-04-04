-- AlterTable: allow global permissions (companyId = null)
ALTER TABLE "resource_permissions" ALTER COLUMN "company_id" DROP NOT NULL;

-- Recreate unique index with NULLS NOT DISTINCT so that
-- (NULL, resource, action) is treated as a single unique entry.
DROP INDEX IF EXISTS "resource_permissions_company_id_resource_action_key";
CREATE UNIQUE INDEX "resource_permissions_company_id_resource_action_key"
  ON "resource_permissions" ("company_id", "resource", "action")
  NULLS NOT DISTINCT;
