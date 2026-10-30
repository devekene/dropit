import { describe, expect, it } from "vitest";
import { TransferDomainError } from "./errors";
import type {
  TransferFileRecord,
  TransferWithFiles,
} from "./transfer-repository";
import { assertTransferInvariants } from "./transfer-invariants";

describe("transfer aggregate invariants", () => {
  it("accepts a ready aggregate with bounded, verified files", () => {
    expect(() => assertTransferInvariants(makeTransfer())).not.toThrow();
  });

  it.each([
    {
      name: "negative version",
      mutate: (transfer: TransferWithFiles) => {
        transfer.version = -1;
      },
    },
    {
      name: "wrong capability digest length",
      mutate: (transfer: TransferWithFiles) => {
        transfer.publicTokenDigest = new Uint8Array(31);
      },
    },
    {
      name: "expiry below one hour",
      mutate: (transfer: TransferWithFiles) => {
        transfer.expiresAt = new Date(transfer.createdAt.getTime() + 3_599_999);
      },
    },
    {
      name: "expiry above 168 hours",
      mutate: (transfer: TransferWithFiles) => {
        transfer.expiresAt = new Date(
          transfer.createdAt.getTime() + 168 * 60 * 60 * 1000 + 1,
        );
      },
    },
    {
      name: "file owned by another transfer",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files[0] = { ...firstFile(transfer), transferId: "other" };
      },
    },
    {
      name: "duplicate file ID",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files.push({ ...firstFile(transfer) });
      },
    },
    {
      name: "duplicate storage key",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files.push({
          ...firstFile(transfer),
          id: "file-2",
        });
      },
    },
    {
      name: "unnormalized stored filename",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files[0] = {
          ...firstFile(transfer),
          originalFilename: " report.pdf ",
        };
      },
    },
    {
      name: "verified file without verification time",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files[0] = { ...firstFile(transfer), verifiedAt: null };
      },
    },
    {
      name: "verification outside the transfer lifetime",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files[0] = {
          ...firstFile(transfer),
          verifiedAt: transfer.expiresAt,
        };
      },
    },
    {
      name: "unverified file with verification time",
      mutate: (transfer: TransferWithFiles) => {
        transfer.status = "VERIFYING";
        transfer.completedAt = null;
        transfer.files[0] = { ...firstFile(transfer), status: "UPLOADED" };
      },
    },
    {
      name: "ready transfer without completion time",
      mutate: (transfer: TransferWithFiles) => {
        transfer.completedAt = null;
      },
    },
    {
      name: "ready transfer with an unverified file",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files[0] = {
          ...firstFile(transfer),
          status: "UPLOADED",
          verifiedAt: null,
        };
      },
    },
    {
      name: "completion before file verification",
      mutate: (transfer: TransferWithFiles) => {
        transfer.files[0] = {
          ...firstFile(transfer),
          verifiedAt: new Date("2026-10-30T02:00:00.000Z"),
        };
      },
    },
    {
      name: "completion at expiry",
      mutate: (transfer: TransferWithFiles) => {
        transfer.completedAt = transfer.expiresAt;
      },
    },
  ])("rejects $name", ({ mutate }) => {
    const transfer = makeTransfer();
    mutate(transfer);
    expect(() => assertTransferInvariants(transfer)).toThrow(
      TransferDomainError,
    );
  });
});

function makeTransfer(): TransferWithFiles {
  const createdAt = new Date("2026-10-30T00:00:00.000Z");
  const verifiedAt = new Date("2026-10-30T01:00:00.000Z");
  const file: TransferFileRecord = {
    id: "file-1",
    transferId: "transfer-1",
    originalFilename: "report.pdf",
    storageKey: "transfer-1/file-1",
    contentTypeClaimed: "application/pdf",
    sizeBytes: 100,
    status: "VERIFIED",
    createdAt,
    verifiedAt,
    checksum: null,
  };
  return {
    id: "transfer-1",
    publicTokenDigest: new Uint8Array(32),
    managementTokenDigest: new Uint8Array(32),
    status: "READY",
    passwordHash: null,
    expiresAt: new Date("2026-10-31T00:00:00.000Z"),
    createdAt,
    completedAt: verifiedAt,
    version: 3,
    cleanupClaimUntil: null,
    files: [file],
  };
}

function firstFile(transfer: TransferWithFiles): TransferFileRecord {
  const file = transfer.files[0];
  if (file === undefined) throw new Error("Test fixture requires a file");
  return file;
}
