import { TransferDomainError } from "./errors";
import { assertValidDate } from "./transfer-policy";

export const TRANSFER_STATUSES = [
  "CREATED",
  "UPLOADING",
  "VERIFYING",
  "READY",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<
  Record<TransferStatus, readonly TransferStatus[]>
> = {
  CREATED: ["UPLOADING", "EXPIRED", "CANCELLED", "FAILED"],
  UPLOADING: ["VERIFYING", "EXPIRED", "CANCELLED", "FAILED"],
  VERIFYING: ["READY", "EXPIRED", "CANCELLED", "FAILED"],
  READY: ["EXPIRED", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
  FAILED: [],
};

export interface TransferTransition {
  from: TransferStatus;
  to: TransferStatus;
  expiresAt: Date;
  now: Date;
}

export function assertTransferTransition(input: TransferTransition): void {
  assertValidDate(input.expiresAt, "Transfer expiry");
  assertValidDate(input.now, "Current time");
  assertStatusTransition(input.from, input.to);

  const expired = isExpired(input.expiresAt, input.now);
  if (expired && input.to !== "EXPIRED") {
    throw new TransferDomainError(
      "INVALID_TRANSITION",
      "An expired transfer may only transition to EXPIRED",
    );
  }
  if (!expired && input.to === "EXPIRED") {
    throw new TransferDomainError(
      "INVALID_TRANSITION",
      "A transfer cannot transition to EXPIRED before its expiry time",
    );
  }
}

export function assertStatusTransition(
  from: TransferStatus,
  to: TransferStatus,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new TransferDomainError(
      "INVALID_TRANSITION",
      `Transfer cannot transition from ${from} to ${to}`,
    );
  }
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  assertValidDate(expiresAt, "Transfer expiry");
  assertValidDate(now, "Current time");
  return now.getTime() >= expiresAt.getTime();
}

export function getEffectiveTransferStatus(
  status: TransferStatus,
  expiresAt: Date,
  now: Date,
): TransferStatus {
  if (
    status !== "EXPIRED" &&
    status !== "CANCELLED" &&
    status !== "FAILED" &&
    isExpired(expiresAt, now)
  ) {
    return "EXPIRED";
  }
  return status;
}
