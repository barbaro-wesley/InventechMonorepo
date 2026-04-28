-- DropIndex
DROP INDEX "scan_metadata_numero_atendimento_trgm_idx";

-- DropIndex
DROP INDEX "scan_metadata_paciente_trgm_idx";

-- DropIndex
DROP INDEX "scan_metadata_prontuario_trgm_idx";

-- AlterTable
ALTER TABLE "alert_rules" ADD COLUMN     "recipient_contextual" "ContextualRecipient"[],
ADD COLUMN     "recipient_custom_role_ids" TEXT[];

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
