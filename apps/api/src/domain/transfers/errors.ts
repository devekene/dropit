export type TransferDomainErrorCode =
  | "INVALID_EXPIRY"
  | "INVALID_FILENAME"
  | "INVALID_FILE_SET"
  | "INVALID_INVARIANT"
  | "INVALID_TRANSITION";

export class TransferDomainError extends Error {
  constructor(
    readonly code: TransferDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TransferDomainError";
  }
}
