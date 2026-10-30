import { describe, expect, it } from "vitest";
import { TransferDomainError } from "./errors";
import {
  TRANSFER_STATUSES,
  assertTransferTransition,
  getEffectiveTransferStatus,
  type TransferStatus,
} from "./transfer-state";

const expiry = new Date("2026-10-31T00:00:00.000Z");
const beforeExpiry = new Date(expiry.getTime() - 1);

const allowed: ReadonlyArray<readonly [TransferStatus, TransferStatus]> = [
  ["CREATED", "UPLOADING"],
  ["CREATED", "CANCELLED"],
  ["CREATED", "FAILED"],
  ["UPLOADING", "VERIFYING"],
  ["UPLOADING", "CANCELLED"],
  ["UPLOADING", "FAILED"],
  ["VERIFYING", "READY"],
  ["VERIFYING", "CANCELLED"],
  ["VERIFYING", "FAILED"],
  ["READY", "CANCELLED"],
];

describe("transfer state machine", () => {
  it.each(allowed)("allows %s → %s before expiry", (from, to) => {
    expect(() =>
      assertTransferTransition({
        from,
        to,
        expiresAt: expiry,
        now: beforeExpiry,
      }),
    ).not.toThrow();
  });

  it.each(["CREATED", "UPLOADING", "VERIFYING", "READY"] as const)(
    "allows %s → EXPIRED at the exact expiry instant",
    (from) => {
      expect(() =>
        assertTransferTransition({
          from,
          to: "EXPIRED",
          expiresAt: expiry,
          now: expiry,
        }),
      ).not.toThrow();
    },
  );

  it.each(
    TRANSFER_STATUSES.flatMap((from) =>
      TRANSFER_STATUSES.map((to) => [from, to] as const),
    ).filter(
      ([from, to]) =>
        to !== "EXPIRED" &&
        !allowed.some(
          ([allowedFrom, allowedTo]) =>
            allowedFrom === from && allowedTo === to,
        ),
    ),
  )("rejects illegal transition %s → %s", (from, to) => {
    expect(() =>
      assertTransferTransition({
        from,
        to,
        expiresAt: expiry,
        now: beforeExpiry,
      }),
    ).toThrow(TransferDomainError);
  });

  it("rejects early expiration", () => {
    expect(() =>
      assertTransferTransition({
        from: "READY",
        to: "EXPIRED",
        expiresAt: expiry,
        now: beforeExpiry,
      }),
    ).toThrow(TransferDomainError);
  });

  it.each(["EXPIRED", "CANCELLED", "FAILED"] as const)(
    "rejects terminal transition %s → EXPIRED",
    (from) => {
      expect(() =>
        assertTransferTransition({
          from,
          to: "EXPIRED",
          expiresAt: expiry,
          now: expiry,
        }),
      ).toThrow(TransferDomainError);
    },
  );

  it.each(["UPLOADING", "VERIFYING", "READY", "CANCELLED"] as const)(
    "rejects %s as the target once the stored transfer is expired",
    (to) => {
      expect(() =>
        assertTransferTransition({
          from: "CREATED",
          to,
          expiresAt: expiry,
          now: expiry,
        }),
      ).toThrow(TransferDomainError);
    },
  );

  it.each(["CREATED", "UPLOADING", "VERIFYING", "READY"] as const)(
    "treats expired %s as effectively EXPIRED without a cleanup write",
    (status) => {
      expect(getEffectiveTransferStatus(status, expiry, expiry)).toBe(
        "EXPIRED",
      );
    },
  );

  it.each(["EXPIRED", "CANCELLED", "FAILED"] as const)(
    "preserves terminal status %s after the expiry timestamp",
    (status) => {
      expect(getEffectiveTransferStatus(status, expiry, expiry)).toBe(status);
    },
  );
});
