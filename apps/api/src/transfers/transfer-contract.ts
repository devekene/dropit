import { normalizeFilename } from "../domain/transfers/filename";
import {
  calculateExpiresAt,
  DEFAULT_EXPIRY_HOURS,
  validateTransferFiles,
} from "../domain/transfers/transfer-policy";
import { TransferApiError } from "./api-error";

export interface CreateTransferRequest {
  files: { name: string; size: number; contentType: string }[];
  expiresInHours: number;
}

export interface CreatedTransferResponse {
  transferId: string;
  managementToken: string;
  shareUrl: string;
  expiresAt: string;
  files: {
    id: string;
    uploadUrl: string;
    uploadMethod: "PUT";
    uploadHeaders: Readonly<Record<string, string>>;
    uploadExpiresAt: string;
  }[];
}

export interface CompleteTransferResponse {
  status: "VERIFYING" | "READY";
}

export type PublicTransferResponse =
  | { passwordRequired: true }
  | {
      passwordRequired: false;
      expiresAt: string;
      files: { id: string; name: string; size: number }[];
    };

export function parseCreateTransfer(value: unknown): CreateTransferRequest {
  try {
    const body = object(value, ["files", "expiresInHours", "password"]);
    if (body.password !== undefined && body.password !== null) invalid();
    if (!Array.isArray(body.files)) return invalid();
    const files = body.files.map((item: unknown) => {
      const file = object(item, ["name", "size", "contentType"]);
      if (
        typeof file.name !== "string" ||
        [...file.name].length > 255 ||
        typeof file.size !== "number" ||
        typeof file.contentType !== "string" ||
        file.contentType.length > 255 ||
        !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(file.contentType)
      )
        return invalid();
      return {
        name: normalizeFilename(file.name),
        size: file.size,
        contentType: file.contentType.toLowerCase(),
      };
    });
    validateTransferFiles(
      files.map((file) => ({
        originalFilename: file.name,
        sizeBytes: file.size,
      })),
    );
    const expiresInHours = body.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
    if (typeof expiresInHours !== "number" || body.expiresInHours === null)
      return invalid();
    calculateExpiresAt(new Date(0), expiresInHours);
    return { files, expiresInHours };
  } catch {
    return invalid();
  }
}

export function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value))
    return invalid();
  return value;
}

export function parseTransferId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return invalid();
  return value.toLowerCase();
}

export function parseManagementToken(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^Bearer [A-Za-z0-9_.-]{32,128}$/.test(value)
  ) {
    throw new TransferApiError("UNAUTHORIZED");
  }
  return value.slice(7);
}

export function assertEmptyBody(value: unknown): void {
  if (value !== undefined) object(value, []);
}

function object(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return invalid();
  if (Object.keys(value).some((key) => !keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}

function invalid(): never {
  throw new TransferApiError("VALIDATION_ERROR");
}
