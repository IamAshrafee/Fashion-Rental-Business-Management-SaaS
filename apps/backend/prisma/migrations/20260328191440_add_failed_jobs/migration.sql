-- CreateTable
CREATE TABLE "failed_jobs" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "failed_at" TIMESTAMP(3) NOT NULL,
    "retried_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failed_jobs_queue_idx" ON "failed_jobs"("queue");

-- CreateIndex
CREATE INDEX "failed_jobs_failed_at_idx" ON "failed_jobs"("failed_at");
