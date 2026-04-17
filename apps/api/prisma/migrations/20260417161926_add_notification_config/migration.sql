-- CreateEnum
CREATE TYPE "ContextualRecipient" AS ENUM ('OS_REQUESTER', 'OS_ASSIGNED_TECHNICIANS', 'OS_GROUP_TECHNICIANS', 'OS_CLIENT_ADMINS', 'OS_ASSIGNED_TECHNICIAN');

-- CreateTable
CREATE TABLE "notification_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "recipient_roles" "UserRole"[],
    "recipient_contextual" "ContextualRecipient"[],
    "recipient_group_ids" TEXT[],
    "recipient_user_ids" TEXT[],
    "channels" "NotificationChannel"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_configs_company_id_idx" ON "notification_configs"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_configs_company_id_event_type_key" ON "notification_configs"("company_id", "event_type");

-- AddForeignKey
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
