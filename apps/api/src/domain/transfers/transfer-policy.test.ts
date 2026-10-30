import { describe, expect, it } from "vitest";
import { TransferDomainError } from "./errors";
import { MAX_FILENAME_BYTES, normalizeFilename } from "./filename";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_TRANSFER_SIZE_BYTES,
  calculateExpiresAt,
  validateTransferFiles,
} from "./transfer-policy";

describe("transfer policy", () => {
  it.each([
    { name: "one file", sizes: [1] },
    { name: "ten files", sizes: Array.from({ length: 10 }, () => 1) },
    { name: "maximum file", sizes: [MAX_FILE_SIZE_BYTES] },
    {
      name: "maximum aggregate",
      sizes: Array.from({ length: 5 }, () => MAX_FILE_SIZE_BYTES),
    },
  ])("accepts the $name boundary", ({ sizes }) => {
    const result = validateTransferFiles(
      sizes.map((sizeBytes, index) => ({
        originalFilename: `file-${index}.bin`,
        sizeBytes,
      })),
    );

    expect(result.totalBytes).toBe(
      sizes.reduce((total, sizeBytes) => total + sizeBytes, 0),
    );
  });

  it.each([
    { name: "zero files", sizes: [] },
    { name: "eleven files", sizes: Array.from({ length: 11 }, () => 1) },
    { name: "zero-byte file", sizes: [0] },
    { name: "negative file", sizes: [-1] },
    { name: "fractional file", sizes: [1.5] },
    { name: "unsafe integer", sizes: [Number.MAX_SAFE_INTEGER + 1] },
    { name: "decimal limit plus one", sizes: [MAX_FILE_SIZE_BYTES + 1] },
    { name: "binary 100 MiB", sizes: [100 * 1024 * 1024] },
    {
      name: "aggregate limit plus one",
      sizes: [
        MAX_FILE_SIZE_BYTES,
        MAX_FILE_SIZE_BYTES,
        MAX_FILE_SIZE_BYTES,
        MAX_FILE_SIZE_BYTES,
        MAX_FILE_SIZE_BYTES,
        1,
      ],
    },
  ])("rejects $name", ({ sizes }) => {
    expect(() =>
      validateTransferFiles(
        sizes.map((sizeBytes, index) => ({
          originalFilename: `file-${index}.bin`,
          sizeBytes,
        })),
      ),
    ).toThrow(TransferDomainError);
  });

  it("uses explicit decimal byte limits", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(100_000_000);
    expect(MAX_TRANSFER_SIZE_BYTES).toBe(500_000_000);
  });

  it.each([
    { hours: 1, expectedHours: 1 },
    { hours: 24, expectedHours: 24 },
    { hours: 168, expectedHours: 168 },
    { hours: undefined, expectedHours: 24 },
  ])("calculates $expectedHours-hour expiry", ({ hours, expectedHours }) => {
    const createdAt = new Date("2026-10-30T00:00:00.000Z");
    const expiresAt = calculateExpiresAt(createdAt, hours);
    expect(expiresAt.getTime() - createdAt.getTime()).toBe(
      expectedHours * 60 * 60 * 1000,
    );
  });

  it.each([0, 169, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid expiry hours %s",
    (hours) => {
      expect(() => calculateExpiresAt(new Date(), hours)).toThrow(
        TransferDomainError,
      );
    },
  );

  it("rejects an invalid creation date", () => {
    expect(() => calculateExpiresAt(new Date(Number.NaN), 24)).toThrow(
      TransferDomainError,
    );
  });
});

describe("safe filenames", () => {
  it("trims and normalizes Unicode to NFC", () => {
    expect(normalizeFilename("  re\u0301sume\u0301.pdf  ")).toBe("résumé.pdf");
  });

  it("accepts the exact UTF-8 byte limit", () => {
    const value = `${"a".repeat(MAX_FILENAME_BYTES - 4)}.txt`;
    expect(new TextEncoder().encode(value)).toHaveLength(MAX_FILENAME_BYTES);
    expect(normalizeFilename(value)).toBe(value);
  });

  it.each([
    { name: "empty", value: "" },
    { name: "whitespace", value: "   " },
    { name: "current path segment", value: "." },
    { name: "parent path segment", value: ".." },
    { name: "forward slash", value: "../secret.txt" },
    { name: "backslash", value: "..\\secret.txt" },
    { name: "newline", value: "report\n.txt" },
    { name: "NUL", value: "report\u0000.txt" },
    { name: "bidi override", value: "safe\u202Ecod.exe" },
    { name: "more than 255 bytes", value: `${"a".repeat(252)}.txt` },
  ])("rejects $name", ({ value }) => {
    expect(() => normalizeFilename(value)).toThrow(TransferDomainError);
  });

  it("keeps display metacharacters as data for later output encoding", () => {
    expect(normalizeFilename("<report & notes>.txt")).toBe(
      "<report & notes>.txt",
    );
  });
});
