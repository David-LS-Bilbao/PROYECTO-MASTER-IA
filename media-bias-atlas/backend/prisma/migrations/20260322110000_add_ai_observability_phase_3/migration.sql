CREATE TYPE "AiRunStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED'
);

CREATE TABLE "ai_prompt_versions" (
  "id" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "prompt_key" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "template_hash" TEXT NOT NULL,
  "source_file" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_model_pricing" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "input_cost_micros_per_1m" BIGINT NOT NULL,
  "output_cost_micros_per_1m" BIGINT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_to" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_model_pricing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_operation_runs" (
  "id" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "operation_key" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
  "prompt_version_id" TEXT,
  "request_id" TEXT NOT NULL,
  "correlation_id" TEXT NOT NULL,
  "endpoint" TEXT,
  "user_id" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "total_tokens" INTEGER,
  "estimated_cost_micros_eur" BIGINT,
  "latency_ms" INTEGER,
  "error_code" TEXT,
  "error_message" TEXT,
  "metadata_json" JSONB,
  "debug_payload_json" JSONB,
  "debug_payload_expires_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_operation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_prompt_versions_module_prompt_key_version_key"
ON "ai_prompt_versions"("module", "prompt_key", "version");

CREATE UNIQUE INDEX "ai_prompt_versions_template_hash_key"
ON "ai_prompt_versions"("template_hash");

CREATE INDEX "idx_ai_prompt_versions_module_key_active"
ON "ai_prompt_versions"("module", "prompt_key", "is_active");

CREATE INDEX "idx_ai_model_pricing_provider_model_active"
ON "ai_model_pricing"("provider", "model", "is_active");

CREATE INDEX "idx_ai_model_pricing_valid_from"
ON "ai_model_pricing"("valid_from");

CREATE INDEX "idx_ai_operation_runs_created_at"
ON "ai_operation_runs"("created_at");

CREATE INDEX "idx_ai_operation_runs_module_operation_created"
ON "ai_operation_runs"("module", "operation_key", "created_at");

CREATE INDEX "idx_ai_operation_runs_provider_model_created"
ON "ai_operation_runs"("provider", "model", "created_at");

CREATE INDEX "idx_ai_operation_runs_status_created"
ON "ai_operation_runs"("status", "created_at");

CREATE INDEX "idx_ai_operation_runs_request_id"
ON "ai_operation_runs"("request_id");

CREATE INDEX "idx_ai_operation_runs_entity_created"
ON "ai_operation_runs"("entity_type", "entity_id", "created_at");

CREATE INDEX "idx_ai_operation_runs_correlation_id"
ON "ai_operation_runs"("correlation_id");

ALTER TABLE "ai_operation_runs"
ADD CONSTRAINT "ai_operation_runs_prompt_version_id_fkey"
FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
