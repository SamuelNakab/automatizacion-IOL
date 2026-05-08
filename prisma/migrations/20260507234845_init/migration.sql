-- CreateTable
CREATE TABLE "assets" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "open" DECIMAL(65,30),
    "high" DECIMAL(65,30),
    "low" DECIMAL(65,30),
    "volume" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "signal" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "price_at_decision" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "decision_id" INTEGER,
    "asset_id" INTEGER NOT NULL,
    "iol_order_id" TEXT,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "iol_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "avg_cost" DECIMAL(65,30) NOT NULL,
    "current_price" DECIMAL(65,30) NOT NULL,
    "unrealized_pnl" DECIMAL(65,30) NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_state" (
    "id" SERIAL NOT NULL,
    "capital_total" DECIMAL(65,30) NOT NULL,
    "capital_available" DECIMAL(65,30) NOT NULL,
    "realized_pnl" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unrealized_pnl" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "max_drawdown" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "peak_capital" DECIMAL(65,30) NOT NULL,
    "total_operations" INTEGER NOT NULL DEFAULT 0,
    "winning_operations" INTEGER NOT NULL DEFAULT 0,
    "last_cycle_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_symbol_market_key" ON "assets"("symbol", "market");

-- CreateIndex
CREATE UNIQUE INDEX "positions_asset_id_key" ON "positions"("asset_id");

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
