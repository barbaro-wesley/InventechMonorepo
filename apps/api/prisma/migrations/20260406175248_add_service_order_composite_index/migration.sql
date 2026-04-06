-- CreateIndex
CREATE INDEX "service_orders_company_id_client_id_status_idx" ON "service_orders"("company_id", "client_id", "status");
