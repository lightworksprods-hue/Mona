CREATE TABLE "hardware_commands" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "hardware_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hardware_commands_status_requestedAt_idx" ON "hardware_commands"("status", "requestedAt");
