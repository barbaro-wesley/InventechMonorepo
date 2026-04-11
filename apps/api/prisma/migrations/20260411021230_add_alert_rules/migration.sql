-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('OS_CREATED_NO_TECHNICIAN', 'OS_TECHNICIAN_ASSIGNED', 'OS_TECHNICIAN_ASSUMED', 'OS_COMPLETED', 'OS_APPROVED', 'OS_REJECTED', 'OS_UNASSIGNED_ALERT', 'EQUIPMENT_CREATED', 'EQUIPMENT_MOVED', 'EQUIPMENT_WARRANTY_EXPIRING', 'PREVENTIVE_GENERATED', 'MAINTENANCE_OVERDUE', 'USER_CREATED', 'USER_DEACTIVATED', 'DAILY_SUMMARY');

-- DropForeignKey
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_equipment_id_fkey";

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trigger_event" "EventType" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "header_color" TEXT NOT NULL DEFAULT '#6366F1',
    "header_title" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "table_fields" JSONB NOT NULL DEFAULT '[]',
    "button_label" TEXT,
    "button_url_template" TEXT,
    "footer_note" TEXT,
    "recipient_roles" "UserRole"[],
    "recipient_group_ids" TEXT[],
    "recipient_user_ids" TEXT[],
    "channels" "NotificationChannel"[],
    "fire_count" INTEGER NOT NULL DEFAULT 0,
    "last_fired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rules_company_id_is_active_idx" ON "alert_rules"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "alert_rules_company_id_trigger_event_idx" ON "alert_rules"("company_id", "trigger_event");

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
