import type { TransferStatus } from "./transfer-state";

export const TRANSFER_FILE_STATUSES = [
  "PENDING",
  "UPLOADED",
  "VERIFIED",
  "FAILED",
] as const;

export type TransferFileStatus = (typeof TRANSFER_FILE_STATUSES)[number];

export interface NewTransferFileRecord {
  id: string;
  originalFilename: string;
  storageKey: string;
  contentTypeClaimed: string;
  sizeBytes: number;
}

export interface NewTransferRecord {
  id: string;
  publicTokenDigest: Uint8Array;
  managementTokenDigest: Uint8Array;
  passwordHash: string | null;
  expiresAt: Date;
  files: readonly NewTransferFileRecord[];
}

export interface TransferFileRecord extends NewTransferFileRecord {
  transferId: string;
  status: TransferFileStatus;
  createdAt: Date;
  verifiedAt: Date | null;
  checksum: string | null;
}

export interface TransferRecord {
  id: string;
  publicTokenDigest: Uint8Array;
  managementTokenDigest: Uint8Array;
  status: TransferStatus;
  passwordHash: string | null;
  expiresAt: Date;
  createdAt: Date;
  completedAt: Date | null;
  version: number;
  cleanupClaimUntil: Date | null;
}

export interface TransferWithFiles extends TransferRecord {
  files: TransferFileRecord[];
}

export interface TransitionTransferInput {
  id: string;
  from: TransferStatus;
  to: TransferStatus;
  expectedVersion: number;
}

export interface TransferRepository {
  createWithFiles(input: NewTransferRecord): Promise<TransferWithFiles>;
  findById(id: string): Promise<TransferWithFiles | null>;
  transition(input: TransitionTransferInput): Promise<TransferWithFiles | null>;
  deleteById(id: string): Promise<boolean>;
}
