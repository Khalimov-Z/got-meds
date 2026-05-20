-- CreateTable
CREATE TABLE "search_logs" (
    "id" UUID NOT NULL,
    "search_term" TEXT NOT NULL,
    "city_id" UUID NOT NULL,
    "user_latitude" DOUBLE PRECISION,
    "user_longitude" DOUBLE PRECISION,
    "results_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_logs_city_id_created_at_idx" ON "search_logs"("city_id", "created_at");

-- CreateIndex
CREATE INDEX "search_logs_search_term_idx" ON "search_logs"("search_term");

-- AddForeignKey
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
