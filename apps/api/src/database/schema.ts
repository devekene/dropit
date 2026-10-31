import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { TRANSFER_FILE_STATUSES } from "../domain/transfers/transfer-repository";
import { MAX_FILE_SIZE_BYTES } from "../domain/transfers/transfer-policy";
import { TRANSFER_STATUSES } from "../domain/transfers/transfer-state";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

export const transferStatus = pgEnum("transfer_status", TRANSFER_STATUSES);

export const transferFileStatus = pgEnum(
  "transfer_file_status",
  TRANSFER_FILE_STATUSES,
);

export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey(),
    publicTokenDigest: bytea("public_token_digest").notNull(),
    managementTokenDigest: bytea("management_token_digest").notNull(),
    status: transferStatus("status").notNull().default("CREATED"),
    passwordHash: text("password_hash"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    version: integer("version").notNull().default(0),
    cleanupClaimUntil: timestamp("cleanup_claim_until", {
      withTimezone: true,
      mode: "date",
    }),
    verificationClaimUntil: timestamp("verification_claim_until", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("transfers_public_token_digest_uidx").on(
      table.publicTokenDigest,
    ),
    uniqueIndex("transfers_management_token_digest_uidx").on(
      table.managementTokenDigest,
    ),
    index("transfers_status_expires_at_idx").on(table.status, table.expiresAt),
    check("transfers_version_nonnegative", sql`${table.version} >= 0`),
    check(
      "transfers_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "transfers_public_token_digest_length",
      sql`octet_length(${table.publicTokenDigest}) = 32`,
    ),
    check(
      "transfers_management_token_digest_length",
      sql`octet_length(${table.managementTokenDigest}) = 32`,
    ),
  ],
);

export const transferFiles = pgTable(
  "transfer_files",
  {
    id: uuid("id").primaryKey(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => transfers.id, { onDelete: "cascade" }),
    originalFilename: text("original_filename").notNull(),
    storageKey: text("storage_key").notNull(),
    contentTypeClaimed: text("content_type_claimed").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    status: transferFileStatus("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    checksum: text("checksum"),
  },
  (table) => [
    uniqueIndex("transfer_files_storage_key_uidx").on(table.storageKey),
    index("transfer_files_transfer_id_idx").on(table.transferId),
    check(
      "transfer_files_size_bytes_range",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= ${sql.raw(String(MAX_FILE_SIZE_BYTES))}`,
    ),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").primaryKey(),
    operation: text("operation").notNull(),
    scopeDigest: bytea("scope_digest").notNull(),
    keyDigest: bytea("key_digest").notNull(),
    requestFingerprint: bytea("request_fingerprint").notNull(),
    responseRef: jsonb("response_ref")
      .$type<Record<string, unknown>>()
      .notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_records_operation_scope_key_uidx").on(
      table.operation,
      table.scopeDigest,
      table.keyDigest,
    ),
    index("idempotency_records_expires_at_idx").on(table.expiresAt),
    check(
      "idempotency_records_operation_nonempty",
      sql`length(${table.operation}) > 0`,
    ),
    check(
      "idempotency_records_scope_digest_length",
      sql`octet_length(${table.scopeDigest}) = 32`,
    ),
    check(
      "idempotency_records_key_digest_length",
      sql`octet_length(${table.keyDigest}) = 32`,
    ),
    check(
      "idempotency_records_request_fingerprint_length",
      sql`octet_length(${table.requestFingerprint}) = 32`,
    ),
  ],
);

export const databaseSchema = {
  idempotencyRecords,
  transferFiles,
  transfers,
};
