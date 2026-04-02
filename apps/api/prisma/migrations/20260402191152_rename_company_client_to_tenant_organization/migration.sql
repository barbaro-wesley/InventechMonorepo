/*
  Warnings:

  - You are about to drop the column `client_id` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `cost_centers` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `cost_centers` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `custom_roles` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `equipment_movements` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `equipment_movements` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `equipment_subtypes` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `equipment_types` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `equipments` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `equipments` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `maintenance_groups` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `maintenance_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `maintenance_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `maintenances` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `maintenances` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `report_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `resource_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `service_orders` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `service_orders` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `companies` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organization_id,code]` on the table `cost_centers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,name]` on the table `custom_roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,name]` on the table `maintenance_groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,report_type]` on the table `report_permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,resource,action]` on the table `resource_permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,number]` on the table `service_orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenant_id` to the `attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `cost_centers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `cost_centers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `custom_roles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `equipment_movements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `equipment_movements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `equipment_subtypes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `equipment_types` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `equipments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `equipments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `locations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `locations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `maintenance_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `maintenance_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `maintenance_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `maintenances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `maintenances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `report_permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `resource_permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `service_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `service_orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_company_id_fkey";

-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_platform_id_fkey";

-- DropForeignKey
ALTER TABLE "cost_centers" DROP CONSTRAINT "cost_centers_client_id_fkey";

-- DropForeignKey
ALTER TABLE "custom_roles" DROP CONSTRAINT "custom_roles_company_id_fkey";

-- DropForeignKey
ALTER TABLE "equipments" DROP CONSTRAINT "equipments_client_id_fkey";

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_client_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_groups" DROP CONSTRAINT "maintenance_groups_company_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_schedules" DROP CONSTRAINT "maintenance_schedules_client_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenances" DROP CONSTRAINT "maintenances_client_id_fkey";

-- DropForeignKey
ALTER TABLE "report_permissions" DROP CONSTRAINT "report_permissions_company_id_fkey";

-- DropForeignKey
ALTER TABLE "resource_permissions" DROP CONSTRAINT "resource_permissions_company_id_fkey";

-- DropForeignKey
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_client_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_client_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_company_id_fkey";

-- DropIndex
DROP INDEX "attachments_company_id_entity_idx";

-- DropIndex
DROP INDEX "cost_centers_client_id_code_key";

-- DropIndex
DROP INDEX "cost_centers_company_id_client_id_idx";

-- DropIndex
DROP INDEX "custom_roles_company_id_idx";

-- DropIndex
DROP INDEX "custom_roles_company_id_name_key";

-- DropIndex
DROP INDEX "equipment_movements_company_id_client_id_idx";

-- DropIndex
DROP INDEX "equipment_subtypes_company_id_idx";

-- DropIndex
DROP INDEX "equipment_types_company_id_idx";

-- DropIndex
DROP INDEX "equipments_client_id_status_idx";

-- DropIndex
DROP INDEX "equipments_client_id_type_id_idx";

-- DropIndex
DROP INDEX "equipments_company_id_client_id_idx";

-- DropIndex
DROP INDEX "locations_client_id_cost_center_id_idx";

-- DropIndex
DROP INDEX "locations_client_id_parent_id_idx";

-- DropIndex
DROP INDEX "locations_company_id_client_id_idx";

-- DropIndex
DROP INDEX "maintenance_groups_company_id_is_active_idx";

-- DropIndex
DROP INDEX "maintenance_groups_company_id_name_key";

-- DropIndex
DROP INDEX "maintenance_schedules_company_id_client_id_idx";

-- DropIndex
DROP INDEX "maintenances_company_id_client_id_idx";

-- DropIndex
DROP INDEX "notifications_company_id_created_at_idx";

-- DropIndex
DROP INDEX "report_permissions_company_id_idx";

-- DropIndex
DROP INDEX "report_permissions_company_id_report_type_key";

-- DropIndex
DROP INDEX "resource_permissions_company_id_idx";

-- DropIndex
DROP INDEX "resource_permissions_company_id_resource_action_key";

-- DropIndex
DROP INDEX "service_orders_client_id_status_idx";

-- DropIndex
DROP INDEX "service_orders_company_id_client_id_idx";

-- DropIndex
DROP INDEX "service_orders_company_id_number_key";

-- DropIndex
DROP INDEX "users_client_id_idx";

-- DropIndex
DROP INDEX "users_company_id_client_id_idx";

-- DropIndex
DROP INDEX "users_company_id_idx";

-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "cost_centers" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "custom_roles" DROP COLUMN "company_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "equipment_movements" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "equipment_subtypes" DROP COLUMN "company_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "equipment_types" DROP COLUMN "company_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "equipments" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "locations" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "maintenance_groups" DROP COLUMN "company_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "maintenance_schedules" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "service_contract_id" TEXT,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "maintenances" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "company_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "report_permissions" DROP COLUMN "company_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "resource_permissions" DROP COLUMN "company_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "service_orders" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "serviceContractId" TEXT,
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "client_id",
DROP COLUMN "company_id",
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "tenant_id" TEXT;

-- DropTable
DROP TABLE "clients";

-- DropTable
DROP TABLE "companies";

-- DropEnum
DROP TYPE "ClientStatus";

-- DropEnum
DROP TYPE "CompanyStatus";

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logo_url" TEXT,
    "report_primary_color" TEXT DEFAULT '#1E40AF',
    "report_secondary_color" TEXT DEFAULT '#DBEAFE',
    "report_header_title" TEXT,
    "report_footer_text" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "trial_ends_at" TIMESTAMP(3),
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "licenseExpiresAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "suspendedBy" TEXT,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "logo_url" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "report_name" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_document_key" ON "tenants"("document");

-- CreateIndex
CREATE INDEX "tenants_platform_id_idx" ON "tenants"("platform_id");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "organizations_tenant_id_idx" ON "organizations"("tenant_id");

-- CreateIndex
CREATE INDEX "organizations_tenant_id_status_idx" ON "organizations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_contracts_tenant_id_provider_id_client_id_key" ON "service_contracts"("tenant_id", "provider_id", "client_id");

-- CreateIndex
CREATE INDEX "attachments_tenant_id_entity_idx" ON "attachments"("tenant_id", "entity");

-- CreateIndex
CREATE INDEX "cost_centers_tenant_id_organization_id_idx" ON "cost_centers"("tenant_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_organization_id_code_key" ON "cost_centers"("organization_id", "code");

-- CreateIndex
CREATE INDEX "custom_roles_tenant_id_idx" ON "custom_roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_tenant_id_name_key" ON "custom_roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "equipment_movements_tenant_id_organization_id_idx" ON "equipment_movements"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX "equipment_subtypes_tenant_id_idx" ON "equipment_subtypes"("tenant_id");

-- CreateIndex
CREATE INDEX "equipment_types_tenant_id_idx" ON "equipment_types"("tenant_id");

-- CreateIndex
CREATE INDEX "equipments_tenant_id_organization_id_idx" ON "equipments"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX "equipments_organization_id_status_idx" ON "equipments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "equipments_organization_id_type_id_idx" ON "equipments"("organization_id", "type_id");

-- CreateIndex
CREATE INDEX "locations_tenant_id_organization_id_idx" ON "locations"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX "locations_organization_id_parent_id_idx" ON "locations"("organization_id", "parent_id");

-- CreateIndex
CREATE INDEX "locations_organization_id_cost_center_id_idx" ON "locations"("organization_id", "cost_center_id");

-- CreateIndex
CREATE INDEX "maintenance_groups_tenant_id_is_active_idx" ON "maintenance_groups"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_groups_tenant_id_name_key" ON "maintenance_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "maintenance_schedules_tenant_id_organization_id_idx" ON "maintenance_schedules"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX "maintenances_tenant_id_organization_id_idx" ON "maintenances"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_created_at_idx" ON "notifications"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "report_permissions_tenant_id_idx" ON "report_permissions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_permissions_tenant_id_report_type_key" ON "report_permissions"("tenant_id", "report_type");

-- CreateIndex
CREATE INDEX "resource_permissions_tenant_id_idx" ON "resource_permissions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_permissions_tenant_id_resource_action_key" ON "resource_permissions"("tenant_id", "resource", "action");

-- CreateIndex
CREATE INDEX "service_orders_tenant_id_organization_id_idx" ON "service_orders"("tenant_id", "organization_id");

-- CreateIndex
CREATE INDEX "service_orders_organization_id_status_idx" ON "service_orders"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_tenant_id_number_key" ON "service_orders"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_organization_id_idx" ON "users"("tenant_id", "organization_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_groups" ADD CONSTRAINT "maintenance_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_service_contract_id_fkey" FOREIGN KEY ("service_contract_id") REFERENCES "service_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_serviceContractId_fkey" FOREIGN KEY ("serviceContractId") REFERENCES "service_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_permissions" ADD CONSTRAINT "report_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
