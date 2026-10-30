import { and, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { databaseSchema, idempotencyRecords } from "../schema";

export interface NewIdempotencyRecord {
  id: string;
  operation: string;
  scopeDigest: Uint8Array;
  keyDigest: Uint8Array;
  requestFingerprint: Uint8Array;
  responseRef: Record<string, unknown>;
  expiresAt: Date;
}

export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;

export interface IdempotencyRepository {
  create(input: NewIdempotencyRecord): Promise<IdempotencyRecord>;
  find(
    operation: string,
    scopeDigest: Uint8Array,
    keyDigest: Uint8Array,
  ): Promise<IdempotencyRecord | null>;
}

export class DrizzleIdempotencyRepository<
  TResult extends PgQueryResultHKT,
> implements IdempotencyRepository {
  constructor(
    private readonly db: PgDatabase<TResult, typeof databaseSchema>,
  ) {}

  async create(input: NewIdempotencyRecord): Promise<IdempotencyRecord> {
    validateDigest(input.scopeDigest, "Scope");
    validateDigest(input.keyDigest, "Key");
    validateDigest(input.requestFingerprint, "Request fingerprint");
    if (input.operation.length === 0) {
      throw new Error("Idempotency operation must not be empty");
    }

    const inserted = await this.db
      .insert(idempotencyRecords)
      .values(input)
      .returning();
    const record = inserted[0];
    if (record === undefined) {
      throw new Error("Idempotency record was not persisted");
    }
    return record;
  }

  async find(
    operation: string,
    scopeDigest: Uint8Array,
    keyDigest: Uint8Array,
  ): Promise<IdempotencyRecord | null> {
    const rows = await this.db
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.operation, operation),
          eq(idempotencyRecords.scopeDigest, scopeDigest),
          eq(idempotencyRecords.keyDigest, keyDigest),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}

function validateDigest(value: Uint8Array, label: string): void {
  if (value.byteLength !== 32) {
    throw new Error(`${label} digest must be 32 bytes`);
  }
}
