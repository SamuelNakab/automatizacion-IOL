-- CreateTable
CREATE TABLE "model_predictions" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "model_name" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "horizon_days" INTEGER NOT NULL,
    "target_date" DATE NOT NULL,
    "price_predicted" DECIMAL(65,30) NOT NULL,
    "ci_lower_80" DECIMAL(65,30),
    "ci_upper_80" DECIMAL(65,30),
    "ci_lower_95" DECIMAL(65,30),
    "ci_upper_95" DECIMAL(65,30),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_metrics" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "model_name" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "mae" DECIMAL(65,30),
    "rmse" DECIMAL(65,30),
    "mape" DECIMAL(65,30),
    "direction_accuracy" DECIMAL(65,30),
    "sharpe_signal" DECIMAL(65,30),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_analyses" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "model_name" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendation" TEXT,
    "confidence" DECIMAL(65,30),
    "horizon_30d" JSONB,
    "horizon_45d" JSONB,
    "horizon_60d" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_predictions_asset_id_model_name_run_date_idx" ON "model_predictions"("asset_id", "model_name", "run_date");

-- CreateIndex
CREATE UNIQUE INDEX "model_predictions_asset_id_model_name_run_date_target_date_key" ON "model_predictions"("asset_id", "model_name", "run_date", "target_date");

-- CreateIndex
CREATE INDEX "model_metrics_asset_id_model_name_idx" ON "model_metrics"("asset_id", "model_name");

-- CreateIndex
CREATE UNIQUE INDEX "model_metrics_asset_id_model_name_run_date_key" ON "model_metrics"("asset_id", "model_name", "run_date");

-- CreateIndex
CREATE INDEX "model_analyses_asset_id_model_name_idx" ON "model_analyses"("asset_id", "model_name");

-- CreateIndex
CREATE UNIQUE INDEX "model_analyses_asset_id_model_name_run_date_key" ON "model_analyses"("asset_id", "model_name", "run_date");

-- AddForeignKey
ALTER TABLE "model_predictions" ADD CONSTRAINT "model_predictions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_metrics" ADD CONSTRAINT "model_metrics_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_analyses" ADD CONSTRAINT "model_analyses_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
