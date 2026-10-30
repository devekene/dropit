import {
  and,
  eq,
  exists,
  gt,
  isNull,
  lte,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import type {
  NewTransferRecord,
  TransferRepository,
  TransferWithFiles,
  TransitionTransferInput,
} from "../../domain/transfers/transfer-repository";
import { TransferDomainError } from "../../domain/transfers/errors";
import { normalizeFilename } from "../../domain/transfers/filename";
import {
  MAX_FILES_PER_TRANSFER,
  validateTransferFiles,
} from "../../domain/transfers/transfer-policy";
import { assertStatusTransition } from "../../domain/transfers/transfer-state";
import { databaseSchema, transferFiles, transfers } from "../schema";

export type {
  NewTransferFileRecord,
  NewTransferRecord,
  TransferFileRecord,
  TransferRecord,
  TransferRepository,
  TransferWithFiles,
  TransitionTransferInput,
} from "../../domain/transfers/transfer-repository";

export type TransferRow = typeof transfers.$inferSelect;
export type TransferFileRow = typeof transferFiles.$inferSelect;

export class RepositoryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryInvariantError";
  }
}

export class DrizzleTransferRepository<
  TResult extends PgQueryResultHKT,
> implements TransferRepository {
  constructor(
    private readonly db: PgDatabase<TResult, typeof databaseSchema>,
  ) {}

  async createWithFiles(input: NewTransferRecord): Promise<TransferWithFiles> {
    validateNewTransfer(input);

    return this.db.transaction(async (transaction) => {
      await transaction.insert(transfers).values({
        id: input.id,
        publicTokenDigest: input.publicTokenDigest,
        managementTokenDigest: input.managementTokenDigest,
        passwordHash: input.passwordHash,
        expiresAt: input.expiresAt,
      });

      await transaction.insert(transferFiles).values(
        input.files.map((file) => ({
          id: file.id,
          transferId: input.id,
          originalFilename: normalizeFilename(file.originalFilename),
          storageKey: file.storageKey,
          contentTypeClaimed: file.contentTypeClaimed,
          sizeBytes: file.sizeBytes,
        })),
      );

      const created = await this.findByIdUsing(transaction, input.id);
      if (created === null) {
        throw new Error("Transfer creation did not return a persisted record");
      }
      return created;
    });
  }

  findById(id: string): Promise<TransferWithFiles | null> {
    return this.findByIdUsing(this.db, id);
  }

  async transition(
    input: TransitionTransferInput,
  ): Promise<TransferWithFiles | null> {
    assertStatusTransition(input.from, input.to);
    if (
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0
    ) {
      throw new RepositoryInvariantError(
        "Expected version must be a nonnegative safe integer",
      );
    }
    const expiryGuard =
      input.to === "EXPIRED"
        ? lte(transfers.expiresAt, sql`CURRENT_TIMESTAMP`)
        : gt(transfers.expiresAt, sql`CURRENT_TIMESTAMP`);
    const readinessGuard =
      input.to === "READY"
        ? and(
            exists(
              this.db
                .select({ id: transferFiles.id })
                .from(transferFiles)
                .where(eq(transferFiles.transferId, transfers.id)),
            ),
            notExists(
              this.db
                .select({ id: transferFiles.id })
                .from(transferFiles)
                .where(
                  and(
                    eq(transferFiles.transferId, transfers.id),
                    or(
                      ne(transferFiles.status, "VERIFIED"),
                      isNull(transferFiles.verifiedAt),
                      gt(transferFiles.verifiedAt, sql`CURRENT_TIMESTAMP`),
                    ),
                  ),
                ),
            ),
          )
        : sql`true`;
    const updated = await this.db
      .update(transfers)
      .set({
        status: input.to,
        version: sql`${transfers.version} + 1`,
        ...(input.to === "READY"
          ? { completedAt: sql`CURRENT_TIMESTAMP` }
          : {}),
      })
      .where(
        and(
          eq(transfers.id, input.id),
          eq(transfers.status, input.from),
          eq(transfers.version, input.expectedVersion),
          expiryGuard,
          readinessGuard,
        ),
      )
      .returning({ id: transfers.id });

    if (updated.length === 0) return null;
    return this.findById(input.id);
  }

  async deleteById(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(transfers)
      .where(eq(transfers.id, id))
      .returning({ id: transfers.id });
    return deleted.length === 1;
  }

  private async findByIdUsing(
    database: PgDatabase<TResult, typeof databaseSchema>,
    id: string,
  ): Promise<TransferWithFiles | null> {
    const rows = await database
      .select({ transfer: transfers, file: transferFiles })
      .from(transfers)
      .leftJoin(transferFiles, eq(transferFiles.transferId, transfers.id))
      .where(eq(transfers.id, id))
      .orderBy(transferFiles.createdAt, transferFiles.id)
      .limit(MAX_FILES_PER_TRANSFER);

    const first = rows[0];
    if (first === undefined) return null;

    return {
      ...first.transfer,
      files: rows.flatMap((row) => (row.file === null ? [] : [row.file])),
    };
  }
}

function validateNewTransfer(input: NewTransferRecord): void {
  if (input.publicTokenDigest.byteLength !== 32) {
    throw new RepositoryInvariantError("Public token digest must be 32 bytes");
  }
  if (input.managementTokenDigest.byteLength !== 32) {
    throw new RepositoryInvariantError(
      "Management token digest must be 32 bytes",
    );
  }
  try {
    validateTransferFiles(input.files);
  } catch (error: unknown) {
    if (error instanceof TransferDomainError) {
      throw new RepositoryInvariantError(error.message);
    }
    throw error;
  }
}
