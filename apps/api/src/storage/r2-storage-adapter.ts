import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { R2Environment } from "../config/r2-environment";
import type {
  CreateDownloadCapabilityInput,
  CreateUploadCapabilityInput,
  DownloadCapability,
  ObjectStorage,
  ObjectVerificationResult,
  StorageObjectReference,
  UploadCapability,
  VerifyObjectInput,
} from "../domain/storage/object-storage";
import { normalizeFilename } from "../domain/transfers/filename";
import { MAX_FILE_SIZE_BYTES } from "../domain/transfers/transfer-policy";
import { assertStorageKeyOwnership } from "./storage-key";

export const MAX_UPLOAD_URL_TTL_SECONDS = 5 * 60;
export const MAX_DOWNLOAD_URL_TTL_SECONDS = 60;

const CONTENT_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

export class ObjectStorageUnavailableError extends Error {
  constructor() {
    super("Object storage operation failed");
    this.name = "ObjectStorageUnavailableError";
  }
}

export class R2StorageAdapter implements ObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async createUploadCapability(
    input: CreateUploadCapabilityInput,
  ): Promise<UploadCapability> {
    assertStorageKeyOwnership(input);
    assertExpectedSize(input.expectedSizeBytes);
    const contentType = validateContentType(input.contentType);
    const contentMd5 = validateContentMd5(input.contentMd5);
    const expiresInSeconds = validateTtl(
      input.expiresInSeconds ?? MAX_UPLOAD_URL_TTL_SECONDS,
      MAX_UPLOAD_URL_TTL_SECONDS,
      "upload",
    );

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.storageKey,
      ContentLength: input.expectedSizeBytes,
      ContentType: contentType,
      ...(contentMd5 === undefined ? {} : { ContentMD5: contentMd5 }),
    });
    const signableHeaders = new Set(["content-length", "content-type"]);
    if (contentMd5 !== undefined) signableHeaders.add("content-md5");

    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
      signableHeaders,
    });
    return {
      method: "PUT",
      url,
      requiredHeaders: {
        "content-type": contentType,
        ...(contentMd5 === undefined ? {} : { "content-md5": contentMd5 }),
      },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async createDownloadCapability(
    input: CreateDownloadCapabilityInput,
  ): Promise<DownloadCapability> {
    assertStorageKeyOwnership(input);
    const filename = normalizeFilename(input.filename);
    const expiresInSeconds = validateTtl(
      input.expiresInSeconds ?? MAX_DOWNLOAD_URL_TTL_SECONDS,
      MAX_DOWNLOAD_URL_TTL_SECONDS,
      "download",
    );
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.storageKey,
      ResponseContentDisposition: buildAttachmentDisposition(filename),
      ResponseContentType: "application/octet-stream",
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
    return {
      method: "GET",
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async verifyObject(
    input: VerifyObjectInput,
  ): Promise<ObjectVerificationResult> {
    assertStorageKeyOwnership(input);
    assertExpectedSize(input.expectedSizeBytes);
    const contentMd5 = validateContentMd5(input.contentMd5);

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: input.storageKey,
        }),
      );
      if (response.ContentLength === undefined) {
        return { ok: false, reason: "METADATA_MISSING" };
      }
      if (response.ContentLength !== input.expectedSizeBytes) {
        return { ok: false, reason: "SIZE_MISMATCH" };
      }
      if (
        contentMd5 !== undefined &&
        normalizeEtag(response.ETag) !== md5Base64ToHex(contentMd5)
      ) {
        return { ok: false, reason: "CHECKSUM_MISMATCH" };
      }
      return {
        ok: true,
        contentLength: response.ContentLength,
        contentType: response.ContentType ?? null,
        etag: normalizeEtag(response.ETag),
      };
    } catch (error: unknown) {
      if (isNotFound(error)) return { ok: false, reason: "MISSING" };
      throw new ObjectStorageUnavailableError();
    }
  }

  async deleteObject(reference: StorageObjectReference): Promise<void> {
    assertStorageKeyOwnership(reference);
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: reference.storageKey,
        }),
      );
    } catch {
      throw new ObjectStorageUnavailableError();
    }
  }

  close(): void {
    this.client.destroy();
  }
}

export function createR2StorageAdapter(
  environment: R2Environment,
): R2StorageAdapter {
  const client = new S3Client({
    region: environment.region,
    endpoint: environment.endpoint,
    credentials: {
      accessKeyId: environment.accessKeyId,
      secretAccessKey: environment.secretAccessKey,
    },
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return new R2StorageAdapter(client, environment.bucket);
}

function validateContentType(value: string): string {
  if (value.length > 255 || !CONTENT_TYPE_PATTERN.test(value)) {
    throw new Error("Invalid object content type");
  }
  return value.toLowerCase();
}

function validateContentMd5(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength !== 16 || bytes.toString("base64") !== value) {
    throw new Error("Invalid object Content-MD5");
  }
  return value;
}

function assertExpectedSize(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_FILE_SIZE_BYTES
  ) {
    throw new Error("Invalid expected object size");
  }
}

function validateTtl(value: number, maximum: number, kind: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`Invalid ${kind} capability TTL`);
  }
  return value;
}

function buildAttachmentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="download"; filename*=UTF-8''${encoded}`;
}

function normalizeEtag(value: string | undefined): string | null {
  if (value === undefined) return null;
  return value.replace(/^"|"$/g, "").toLowerCase();
}

function md5Base64ToHex(value: string): string {
  return Buffer.from(value, "base64").toString("hex");
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
