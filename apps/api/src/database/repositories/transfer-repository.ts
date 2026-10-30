import { eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import {
  databaseSchema,
  MAX_FILES_PER_TRANSFER,
  MAX_FILE_SIZE_BYTES,
  MAX_TRANSFER_SIZE_BYTES,
  transferFiles,
  transfers,
} from "../schema";

export interface NewTransferFileRecord {
  id: string;
  originalFilename: string;
  storageKey: string;
  contentTypeClaimed: string;
  sizeBytes: number;
}

export interface NewTransferRecord {
  id: string;
  publicTokenDigest: Uint8Array;
  managementTokenDigest: Uint8Array;
  passwordHash: string | null;
  expiresAt: Date;
  files: readonly NewTransferFileRecord[];
}

export type TransferRow = typeof transfers.$inferSelect;
export type TransferFileRow = typeof transferFiles.$inferSelect;
export type TransferWithFiles = TransferRow & {
  files: TransferFileRow[];
};

export interface TransferRepository {
  createWithFiles(input: NewTransferRecord): Promise<TransferWithFiles>;
  findById(id: string): Promise<TransferWithFiles | null>;
  deleteById(id: string): Promise<boolean>;
}

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
          originalFilename: file.originalFilename,
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
  if (input.files.length < 1 || input.files.length > MAX_FILES_PER_TRANSFER) {
    throw new RepositoryInvariantError(
      `A transfer must contain 1–${MAX_FILES_PER_TRANSFER} files`,
    );
  }

  let totalBytes = 0;
  for (const file of input.files) {
    if (
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes < 1 ||
      file.sizeBytes > MAX_FILE_SIZE_BYTES
    ) {
      throw new RepositoryInvariantError(
        `Each file must contain 1–${MAX_FILE_SIZE_BYTES} bytes`,
      );
    }
    totalBytes += file.sizeBytes;
  }

  if (totalBytes > MAX_TRANSFER_SIZE_BYTES) {
    throw new RepositoryInvariantError(
      `Transfer size must not exceed ${MAX_TRANSFER_SIZE_BYTES} bytes`,
    );
  }
}
