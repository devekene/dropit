CREATE TYPE "public"."transfer_file_status" AS ENUM('PENDING', 'UPLOADED', 'VERIFIED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('CREATED', 'UPLOADING', 'VERIFYING', 'READY', 'EXPIRED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"scope_digest" "bytea" NOT NULL,
	"key_digest" "bytea" NOT NULL,
	"request_fingerprint" "bytea" NOT NULL,
	"response_ref" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_records_operation_nonempty" CHECK (length("idempotency_records"."operation") > 0),
	CONSTRAINT "idempotency_records_scope_digest_length" CHECK (octet_length("idempotency_records"."scope_digest") = 32),
	CONSTRAINT "idempotency_records_key_digest_length" CHECK (octet_length("idempotency_records"."key_digest") = 32),
	CONSTRAINT "idempotency_records_request_fingerprint_length" CHECK (octet_length("idempotency_records"."request_fingerprint") = 32)
);
--> statement-breakpoint
CREATE TABLE "transfer_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transfer_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type_claimed" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"status" "transfer_file_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"checksum" text,
	CONSTRAINT "transfer_files_size_bytes_range" CHECK ("transfer_files"."size_bytes" > 0 AND "transfer_files"."size_bytes" <= 100000000)
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_token_digest" "bytea" NOT NULL,
	"management_token_digest" "bytea" NOT NULL,
	"status" "transfer_status" DEFAULT 'CREATED' NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"cleanup_claim_until" timestamp with time zone,
	CONSTRAINT "transfers_version_nonnegative" CHECK ("transfers"."version" >= 0),
	CONSTRAINT "transfers_expiry_after_creation" CHECK ("transfers"."expires_at" > "transfers"."created_at"),
	CONSTRAINT "transfers_public_token_digest_length" CHECK (octet_length("transfers"."public_token_digest") = 32),
	CONSTRAINT "transfers_management_token_digest_length" CHECK (octet_length("transfers"."management_token_digest") = 32)
);
--> statement-breakpoint
ALTER TABLE "transfer_files" ADD CONSTRAINT "transfer_files_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_operation_scope_key_uidx" ON "idempotency_records" USING btree ("operation","scope_digest","key_digest");--> statement-breakpoint
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_files_storage_key_uidx" ON "transfer_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "transfer_files_transfer_id_idx" ON "transfer_files" USING btree ("transfer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_public_token_digest_uidx" ON "transfers" USING btree ("public_token_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_management_token_digest_uidx" ON "transfers" USING btree ("management_token_digest");--> statement-breakpoint
CREATE INDEX "transfers_status_expires_at_idx" ON "transfers" USING btree ("status","expires_at");