export interface StorageObjectReference {
  transferId: string;
  fileId: string;
  storageKey: string;
  signal?: AbortSignal;
}

export interface CreateUploadCapabilityInput extends StorageObjectReference {
  contentType: string;
  expectedSizeBytes: number;
  contentMd5?: string;
  expiresInSeconds?: number;
}

export interface UploadCapability {
  method: "PUT";
  url: string;
  requiredHeaders: Readonly<Record<string, string>>;
  expiresAt: Date;
}

export interface CreateDownloadCapabilityInput extends StorageObjectReference {
  filename: string;
  expiresInSeconds?: number;
}

export interface DownloadCapability {
  method: "GET";
  url: string;
  expiresAt: Date;
}

export interface VerifyObjectInput extends StorageObjectReference {
  expectedSizeBytes: number;
  contentMd5?: string;
}

export type ObjectVerificationResult =
  | {
      ok: true;
      contentLength: number;
      contentType: string | null;
      etag: string | null;
    }
  | {
      ok: false;
      reason:
        "MISSING" | "SIZE_MISMATCH" | "CHECKSUM_MISMATCH" | "METADATA_MISSING";
    };

export interface ObjectStorage {
  createUploadCapability(
    input: CreateUploadCapabilityInput,
  ): Promise<UploadCapability>;
  createDownloadCapability(
    input: CreateDownloadCapabilityInput,
  ): Promise<DownloadCapability>;
  verifyObject(input: VerifyObjectInput): Promise<ObjectVerificationResult>;
  deleteObject(reference: StorageObjectReference): Promise<void>;
}
