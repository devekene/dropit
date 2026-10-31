import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { S3Client } from "@aws-sdk/client-s3";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { ObjectStorage } from "../../domain/storage/object-storage";
import { databaseSchema } from "../../database/schema";
import { DrizzleTransferApiRepository } from "../../database/repositories/transfer-api-repository";
import { R2StorageAdapter } from "../../storage/r2-storage-adapter";
import { Capabilities } from "../capabilities";
import { configureHttpBoundary, createApiAdapter } from "../http-boundary";
import { TransferApiModule } from "../transfer-api.module";
import { TransferService } from "../transfer-service";

/** Metadata-only S3 transport double; real adapter signs and deserializes HEAD. */
export class StorageTransport {
  readonly objects = new Map<string, number>();
  active = 0;
  maxActive = 0;
  heads = 0;
  failHead = false;
  failDelete = false;
  beforeHead: (() => Promise<void>) | undefined;

  async handle(
    request: { method: string; path: string },
    options?: { abortSignal?: AbortSignal },
  ) {
    const key = decodeURIComponent(request.path).replace(
      /^\/test-bucket\//,
      "",
    );
    if (request.method === "HEAD") {
      this.heads++;
      this.active++;
      this.maxActive = Math.max(this.maxActive, this.active);
      try {
        if (options?.abortSignal?.aborted) throw new Error("aborted");
        await this.beforeHead?.();
        await delay(2);
        if (this.failHead) throw new Error("private-provider-sentinel");
        const length = this.objects.get(key);
        return {
          response: {
            statusCode: length === undefined ? 404 : 200,
            headers:
              length === undefined
                ? {}
                : {
                    "content-length": String(length),
                    "content-type": "application/octet-stream",
                    etag: '"fake-etag"',
                  },
            body: new Uint8Array(),
          },
        };
      } finally {
        this.active--;
      }
    }
    if (request.method === "DELETE") {
      if (this.failDelete) throw new Error("private-provider-sentinel");
      this.objects.delete(key);
      return {
        response: { statusCode: 204, headers: {}, body: new Uint8Array() },
      };
    }
    throw new Error("Unexpected S3 operation");
  }

  adapter(): R2StorageAdapter {
    return new R2StorageAdapter(
      new S3Client({
        region: "auto",
        endpoint: "https://storage.example.invalid",
        forcePathStyle: true,
        credentials: {
          accessKeyId: "test-access",
          secretAccessKey: "test-only-private-signing-sentinel",
        },
        maxAttempts: 1,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        requestHandler: this,
      }),
      "test-bucket",
    );
  }
}

export async function createHarness(
  storage: ObjectStorage,
  origin = "https://dropit.example",
) {
  const client = new PGlite();
  const db = drizzle(client, { schema: databaseSchema });
  let app: NestFastifyApplication | undefined;
  try {
    await migrate(db, {
      migrationsFolder: resolve(__dirname, "../../../drizzle"),
      migrationsSchema: "public",
      migrationsTable: "__drizzle_migrations",
    });
    const repository = new DrizzleTransferApiRepository(db);
    const capabilities = new Capabilities(
      "v1",
      { v1: randomBytes(32) },
      randomBytes(32),
    );
    const service = new TransferService(
      repository,
      storage,
      capabilities,
      origin,
    );
    const adapter = createApiAdapter();
    app = await NestFactory.create<NestFastifyApplication>(
      TransferApiModule.forTesting(service),
      adapter,
      { logger: false, abortOnError: false },
    );
    configureHttpBoundary(app, adapter);
    await app.init();
    await adapter.getInstance().ready();
    return {
      app,
      client,
      db,
      repository,
      capabilities,
      service,
      async close() {
        await app?.close();
        await client.close();
      },
    };
  } catch (error: unknown) {
    await app?.close();
    await client.close();
    throw error;
  }
}
