-- CreateTable
CREATE TABLE "stock_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stock_point_id" TEXT NOT NULL,
    "category_id" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "brand" TEXT,
    "minimum_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "current_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stock_point_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_order_id" TEXT,
    "destination_point_id" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "quantity_before" DECIMAL(15,3) NOT NULL,
    "quantity_after" DECIMAL(15,3) NOT NULL,
    "unit_cost" DECIMAL(15,2),
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_points" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_point_clients" (
    "stock_point_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_point_clients_pkey" PRIMARY KEY ("stock_point_id","client_id")
);

-- CreateIndex
CREATE INDEX "stock_categories_company_id_idx" ON "stock_categories"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_categories_company_id_name_key" ON "stock_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "stock_items_company_id_idx" ON "stock_items"("company_id");

-- CreateIndex
CREATE INDEX "stock_items_stock_point_id_idx" ON "stock_items"("stock_point_id");

-- CreateIndex
CREATE INDEX "stock_items_category_id_idx" ON "stock_items"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_stock_point_id_code_key" ON "stock_items"("stock_point_id", "code");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_created_at_idx" ON "stock_movements"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_stock_point_id_idx" ON "stock_movements"("stock_point_id");

-- CreateIndex
CREATE INDEX "stock_movements_item_id_idx" ON "stock_movements"("item_id");

-- CreateIndex
CREATE INDEX "stock_points_company_id_idx" ON "stock_points"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_points_company_id_name_key" ON "stock_points"("company_id", "name");

-- AddForeignKey
ALTER TABLE "stock_categories" ADD CONSTRAINT "stock_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "stock_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stock_point_id_fkey" FOREIGN KEY ("stock_point_id") REFERENCES "stock_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_destination_point_id_fkey" FOREIGN KEY ("destination_point_id") REFERENCES "stock_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_point_id_fkey" FOREIGN KEY ("stock_point_id") REFERENCES "stock_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_points" ADD CONSTRAINT "stock_points_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_point_clients" ADD CONSTRAINT "stock_point_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_point_clients" ADD CONSTRAINT "stock_point_clients_stock_point_id_fkey" FOREIGN KEY ("stock_point_id") REFERENCES "stock_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
