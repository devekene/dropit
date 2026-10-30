import { TransferDomainError } from "./errors";

export const MAX_FILENAME_BYTES = 255;

const CONTROL_OR_PATH_SEPARATOR = /[\/\\\u0000-\u001f\u007f]/u;
const BIDI_CONTROL = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

export function normalizeFilename(value: string): string {
  const normalized = value.normalize("NFC").trim();

  if (normalized.length === 0) {
    throw new TransferDomainError(
      "INVALID_FILENAME",
      "Filename must not be empty",
    );
  }
  if (normalized === "." || normalized === "..") {
    throw new TransferDomainError(
      "INVALID_FILENAME",
      "Filename must not be a relative path segment",
    );
  }
  if (CONTROL_OR_PATH_SEPARATOR.test(normalized)) {
    throw new TransferDomainError(
      "INVALID_FILENAME",
      "Filename must not contain path separators or control characters",
    );
  }
  if (BIDI_CONTROL.test(normalized)) {
    throw new TransferDomainError(
      "INVALID_FILENAME",
      "Filename must not contain bidirectional control characters",
    );
  }
  if (new TextEncoder().encode(normalized).byteLength > MAX_FILENAME_BYTES) {
    throw new TransferDomainError(
      "INVALID_FILENAME",
      `Filename must not exceed ${MAX_FILENAME_BYTES} UTF-8 bytes`,
    );
  }

  return normalized;
}
