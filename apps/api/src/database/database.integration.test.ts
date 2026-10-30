import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleIdempotencyRepository,
  type NewIdempotencyRecord,
} from "./repositories/idempotency-repository";
import {
  DrizzleTransferRepository,
  type NewTransferRecord,
  RepositoryInvariantError,
} from "./repositories/transfer-repository";
import { databaseSchema, transferFiles } from "./schema";

const migrationsFolder = resolve(__dirname, "../../drizzle");
const migrationConfig = {
  migrationsFolder,
  migrationsSchema: "public",
  migrationsTable: "__drizzle_migrations",
};

describe("database foundation", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof databaseSchema>;
  let transfers: DrizzleTransferRepository<
    import("drizzle-orm/pglite").PgliteQueryResultHKT
  >;
  let idempotency: DrizzleIdempotencyRepository<
    import("drizzle-orm/pglite").PgliteQueryResultHKT
  >;

  beforeEach(async () => {
    client = new PGlite();
    db = drizzle(client, { schema: databaseSchema });
    await migrate(db, migrationConfig);
    transfers = new DrizzleTransferRepository(db);
    idempotency = new DrizzleIdempotencyRepository(db);
  });

  afterEach(async () => {
    await client.close();
  });

  it("applies twice and creates required tables, indexes, checks, and cascade FK", async () => {
    await migrate(db, migrationConfig);

    const tableResult = await client.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    expect(tableResult.rows.map((row) => row.table_name)).toEqual([
      "__drizzle_migrations",
      "idempotency_records",
      "transfer_files",
      "transfers",
    ]);

    const indexResult = await client.query<{ indexname: string }>(
      `select indexname from pg_indexes
       where schemaname = 'public' order by indexname`,
    );
    expect(indexResult.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "idempotency_records_expires_at_idx",
        "idempotency_records_operation_scope_key_uidx",
        "transfer_files_storage_key_uidx",
        "transfer_files_transfer_id_idx",
        "transfers_management_token_digest_uidx",
        "transfers_public_token_digest_uidx",
        "transfers_status_expires_at_idx",
      ]),
    );

    const constraintResult = await client.query<{
      confdeltype: string;
      conname: string;
      contype: string;
    }>(
      `select conname, contype, confdeltype
       from pg_constraint
       where connamespace = 'public'::regnamespace`,
    );
    expect(constraintResult.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "transfer_files_transfer_id_transfers_id_fk",
          contype: "f",
          confdeltype: "c",
        }),
        expect.objectContaining({
          conname: "transfer_files_size_bytes_range",
          contype: "c",
        }),
        expect.objectContaining({
          conname: "transfers_expiry_after_creation",
          contype: "c",
        }),
      ]),
    );

    const fileColumns = await client.query<{
      column_name: string;
      data_type: string;
    }>(
      `select column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'transfer_files'`,
    );
    expect(
      fileColumns.rows.some((column) => column.data_type === "bytea"),
    ).toBe(false);
  });

  it("supports destructive disposable rebuild followed by migration replay", async () => {
    await client.exec("drop schema public cascade; create schema public;");
    await migrate(db, migrationConfig);
    const result = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = 'transfers'`,
    );
    expect(result.rows).toEqual([{ table_name: "transfers" }]);
  });

  it("creates, reads, and cascade-deletes transfer metadata atomically", async () => {
    const input = makeTransfer({ fileSizes: [25, 50] });
    const created = await transfers.createWithFiles(input);
    expect(created).toMatchObject({
      id: input.id,
      status: "CREATED",
      version: 0,
    });
    expect(created.files).toHaveLength(2);
    expect(created.files.map((file) => file.sizeBytes)).toEqual(
      expect.arrayContaining([25, 50]),
    );
    expect(await transfers.findById(input.id)).toEqual(created);

    expect(await transfers.deleteById(input.id)).toBe(true);
    expect(await transfers.deleteById(input.id)).toBe(false);
    const remaining = await client.query<{ count: number }>(
      "select count(*)::int as count from transfer_files where transfer_id = $1",
      [input.id],
    );
    expect(remaining.rows).toEqual([{ count: 0 }]);
  });

  it.each([
    { name: "empty batch", fileSizes: [] },
    { name: "eleven files", fileSizes: Array.from({ length: 11 }, () => 1) },
    { name: "zero-byte file", fileSizes: [0] },
    { name: "oversized file", fileSizes: [100_000_001] },
    {
      name: "oversized aggregate",
      fileSizes: [
        90_000_000, 90_000_000, 90_000_000, 90_000_000, 90_000_000, 90_000_000,
      ],
    },
  ])("rejects $name without partial rows", async ({ fileSizes }) => {
    const input = makeTransfer({ fileSizes });
    await expect(transfers.createWithFiles(input)).rejects.toBeInstanceOf(
      RepositoryInvariantError,
    );
    expect(await transfers.findById(input.id)).toBeNull();
  });

  it("rolls back the transfer when a file uniqueness constraint fails", async () => {
    const first = makeTransfer({ storageKeyPrefix: "collision" });
    await transfers.createWithFiles(first);
    const duplicate = makeTransfer({ storageKeyPrefix: "collision" });

    await expect(transfers.createWithFiles(duplicate)).rejects.toThrow();
    expect(await transfers.findById(duplicate.id)).toBeNull();
  });

  it.each(["public", "management"] as const)(
    "rejects a duplicate %s token digest without partial rows",
    async (digestKind) => {
      const first = makeTransfer();
      await transfers.createWithFiles(first);
      const duplicate = makeTransfer();
      if (digestKind === "public") {
        duplicate.publicTokenDigest = first.publicTokenDigest;
      } else {
        duplicate.managementTokenDigest = first.managementTokenDigest;
      }

      await expect(transfers.createWithFiles(duplicate)).rejects.toThrow();
      expect(await transfers.findById(duplicate.id)).toBeNull();
    },
  );

  it("enforces database file size and foreign-key constraints outside the repository", async () => {
    const input = makeTransfer({ fileSizes: [1] });
    await transfers.createWithFiles(input);

    await expect(
      db.insert(transferFiles).values({
        id: randomUUID(),
        transferId: input.id,
        originalFilename: "too-large.bin",
        storageKey: `too-large/${randomUUID()}`,
        contentTypeClaimed: "application/octet-stream",
        sizeBytes: 100_000_001,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(transferFiles).values({
        id: randomUUID(),
        transferId: randomUUID(),
        originalFilename: "orphan.bin",
        storageKey: `orphan/${randomUUID()}`,
        contentTypeClaimed: "application/octet-stream",
        sizeBytes: 1,
      }),
    ).rejects.toThrow();
  });

  it("stores and uniquely identifies idempotency metadata", async () => {
    const input = makeIdempotencyRecord();
    const created = await idempotency.create(input);
    expect(created.id).toBe(input.id);
    expect(
      await idempotency.find(
        input.operation,
        input.scopeDigest,
        input.keyDigest,
      ),
    ).toEqual(created);

    const duplicate = {
      ...makeIdempotencyRecord(),
      operation: input.operation,
      scopeDigest: input.scopeDigest,
      keyDigest: input.keyDigest,
    };
    await expect(idempotency.create(duplicate)).rejects.toThrow();
  });
});

let sequence = 1;

function digest(): Uint8Array {
  const value = new Uint8Array(32);
  value.fill(sequence % 256);
  sequence += 1;
  return value;
}

function makeTransfer(
  options: {
    fileSizes?: number[];
    storageKeyPrefix?: string;
  } = {},
): NewTransferRecord {
  const id = randomUUID();
  const fileSizes = options.fileSizes ?? [1];
  const storageKeyPrefix = options.storageKeyPrefix ?? id;
  return {
    id,
    publicTokenDigest: digest(),
    managementTokenDigest: digest(),
    passwordHash: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    files: fileSizes.map((sizeBytes, index) => ({
      id: randomUUID(),
      originalFilename: `file-${index}.bin`,
      storageKey: `${storageKeyPrefix}/${index}`,
      contentTypeClaimed: "application/octet-stream",
      sizeBytes,
    })),
  };
}

function makeIdempotencyRecord(): NewIdempotencyRecord {
  return {
    id: randomUUID(),
    operation: "create-transfer",
    scopeDigest: digest(),
    keyDigest: digest(),
    requestFingerprint: digest(),
    responseRef: { transferId: randomUUID() },
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };
}
