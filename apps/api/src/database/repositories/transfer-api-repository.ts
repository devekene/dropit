import { randomUUID } from "node:crypto";
import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import type {
  CreateOnceInput,
  TransferApiRepository,
} from "../../domain/transfers/transfer-api-repository";
import type { TransferWithFiles } from "../../domain/transfers/transfer-repository";
import { calculateExpiresAt } from "../../domain/transfers/transfer-policy";
import {
  databaseSchema,
  idempotencyRecords,
  transferFiles,
  transfers,
} from "../schema";
import { DrizzleTransferRepository } from "./transfer-repository";

export class DrizzleTransferApiRepository<TResult extends PgQueryResultHKT>
  extends DrizzleTransferRepository<TResult>
  implements TransferApiRepository
{
  constructor(
    private readonly database: PgDatabase<TResult, typeof databaseSchema>,
  ) {
    super(database);
  }

  async createOnce(input: CreateOnceInput): Promise<TransferWithFiles | null> {
    return this.database.transaction(async (transaction) => {
      const clock = await transaction
        .select({ now: sql<string>`CURRENT_TIMESTAMP::text` })
        .from(sql`(select 1) as clock`);
      const timestamp = clock[0]?.now;
      if (timestamp === undefined)
        throw new Error("Database clock unavailable");
      const expiresAt = calculateExpiresAt(
        new Date(timestamp),
        input.expiresInHours,
      );
      const claimed = await transaction
        .insert(idempotencyRecords)
        .values({
          id: randomUUID(),
          operation: "create-transfer",
          scopeDigest: input.scopeDigest,
          keyDigest: input.keyDigest,
          requestFingerprint: input.requestFingerprint,
          responseRef: { transferId: input.transfer.id },
          expiresAt: new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000),
        })
        .onConflictDoNothing({
          target: [
            idempotencyRecords.operation,
            idempotencyRecords.scopeDigest,
            idempotencyRecords.keyDigest,
          ],
        })
        .returning({ id: idempotencyRecords.id });
      if (claimed.length === 0) return null;
      const repository = new DrizzleTransferRepository(transaction);
      await repository.createWithFiles({ ...input.transfer, expiresAt });
      const uploading = await repository.transition({
        id: input.transfer.id,
        from: "CREATED",
        to: "UPLOADING",
        expectedVersion: 0,
      });
      if (uploading === null) throw new Error("Creation transition failed");
      return uploading;
    });
  }

  async findActiveById(id: string): Promise<TransferWithFiles | null> {
    return this.readActive(eq(transfers.id, id));
  }

  async findPublic(digest: Uint8Array): Promise<TransferWithFiles | null> {
    return this.readActive(
      sql`${transfers.publicTokenDigest} = ${digest} AND ${transfers.status} = 'READY'`,
    );
  }

  private async readActive(predicate: SQL): Promise<TransferWithFiles | null> {
    const records = await this.database
      .select({ transfer: transfers, file: transferFiles })
      .from(transfers)
      .innerJoin(transferFiles, eq(transferFiles.transferId, transfers.id))
      .where(and(predicate, gt(transfers.expiresAt, sql`clock_timestamp()`)))
      .orderBy(transferFiles.id)
      .limit(11);
    const first = records[0];
    if (first === undefined || records.length > 10) return null;
    return { ...first.transfer, files: records.map((row) => row.file) };
  }

  async claimVerification(
    record: TransferWithFiles,
  ): Promise<TransferWithFiles | null> {
    const claimed = await this.database
      .update(transfers)
      .set({
        status: "VERIFYING",
        version: sql`${transfers.version} + 1`,
        verificationClaimUntil: sql`clock_timestamp() + interval '60 seconds'`,
      })
      .where(
        and(
          eq(transfers.id, record.id),
          eq(transfers.version, record.version),
          gt(transfers.expiresAt, sql`clock_timestamp()`),
          or(
            eq(transfers.status, "UPLOADING"),
            and(
              eq(transfers.status, "VERIFYING"),
              or(
                isNull(transfers.verificationClaimUntil),
                lte(transfers.verificationClaimUntil, sql`clock_timestamp()`),
              ),
            ),
          ),
        ),
      )
      .returning({ id: transfers.id, version: transfers.version });
    const winner = claimed[0];
    if (winner === undefined) return null;
    const current = await this.findById(winner.id);
    return current?.version === winner.version ? current : null;
  }

  async releaseVerification(id: string, version: number): Promise<void> {
    await this.database
      .update(transfers)
      .set({ verificationClaimUntil: null })
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.version, version),
          eq(transfers.status, "VERIFYING"),
        ),
      );
  }

  async publishVerified(record: TransferWithFiles): Promise<boolean> {
    return this.database
      .transaction(async (transaction) => {
        // Hold only a short DB lock: all storage calls have already finished.
        const locked = await transaction
          .select({ id: transfers.id })
          .from(transfers)
          .where(
            and(
              eq(transfers.id, record.id),
              eq(transfers.status, "VERIFYING"),
              eq(transfers.version, record.version),
              gt(transfers.expiresAt, sql`clock_timestamp()`),
              gt(transfers.verificationClaimUntil, sql`clock_timestamp()`),
            ),
          )
          .for("update");
        if (locked.length === 0) return false;
        const files = await transaction
          .select({
            id: transferFiles.id,
            key: transferFiles.storageKey,
            size: transferFiles.sizeBytes,
          })
          .from(transferFiles)
          .where(eq(transferFiles.transferId, record.id))
          .limit(11);
        if (
          files.length < 1 ||
          files.length > 10 ||
          files.length !== record.files.length ||
          files.some(
            (file) =>
              !record.files.some(
                (expected) =>
                  expected.id === file.id &&
                  expected.storageKey === file.key &&
                  expected.sizeBytes === file.size,
              ),
          )
        ) {
          return false;
        }
        await transaction
          .update(transferFiles)
          .set({ status: "VERIFIED", verifiedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(transferFiles.transferId, record.id),
              inArray(
                transferFiles.id,
                files.map((file) => file.id),
              ),
            ),
          );
        // Use wall clock, not transaction-start time, for the final expiry guard.
        const ready = await transaction
          .update(transfers)
          .set({
            status: "READY",
            completedAt: sql`clock_timestamp()`,
            version: sql`${transfers.version} + 1`,
            verificationClaimUntil: null,
          })
          .where(
            and(
              eq(transfers.id, record.id),
              eq(transfers.version, record.version),
              eq(transfers.status, "VERIFYING"),
              gt(transfers.expiresAt, sql`clock_timestamp()`),
              gt(transfers.verificationClaimUntil, sql`clock_timestamp()`),
            ),
          )
          .returning({ id: transfers.id });
        // A lost expiry race must roll back the VERIFIED writes too.
        if (ready.length === 0) throw new PublicationExpiredError();
        return true;
      })
      .catch((error: unknown) => {
        if (error instanceof PublicationExpiredError) return false;
        throw error;
      });
  }
}

class PublicationExpiredError extends Error {}
