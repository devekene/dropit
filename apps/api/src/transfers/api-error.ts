export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "STORAGE_UNAVAILABLE";

export const API_ERRORS = {
  VALIDATION_ERROR: [400, "Invalid request"],
  UNAUTHORIZED: [401, "Management authorization required"],
  NOT_FOUND: [404, "Transfer not found"],
  CONFLICT: [409, "Transfer operation conflicts with current state"],
  PAYLOAD_TOO_LARGE: [413, "Request body too large"],
  RATE_LIMITED: [429, "Request capacity exceeded"],
  INTERNAL_ERROR: [500, "Request failed"],
  STORAGE_UNAVAILABLE: [503, "Storage temporarily unavailable"],
} as const;

export class TransferApiError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(API_ERRORS[code][1]);
  }
}
