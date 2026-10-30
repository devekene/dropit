export interface R2Environment {
  endpoint: string;
  region: "auto";
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  appOrigin: string;
}

const BUCKET_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function readR2Environment(
  source: Readonly<Record<string, string | undefined>>,
): R2Environment {
  const endpoint = requireSetting(source, "S3_ENDPOINT");
  const region = requireSetting(source, "S3_REGION");
  const bucket = requireSetting(source, "S3_BUCKET");
  const accessKeyId = requireSetting(source, "S3_ACCESS_KEY_ID");
  const secretAccessKey = requireSetting(source, "S3_SECRET_ACCESS_KEY");
  const appOrigin = requireSetting(source, "APP_ORIGIN");

  const endpointUrl = parseUrl(endpoint, "S3_ENDPOINT");
  if (
    endpointUrl.protocol !== "https:" ||
    !endpointUrl.hostname.endsWith(".r2.cloudflarestorage.com") ||
    endpointUrl.pathname !== "/" ||
    endpointUrl.search.length > 0 ||
    endpointUrl.hash.length > 0 ||
    endpointUrl.username.length > 0 ||
    endpointUrl.password.length > 0
  ) {
    invalid("S3_ENDPOINT");
  }
  if (region !== "auto") invalid("S3_REGION");
  if (!BUCKET_PATTERN.test(bucket)) invalid("S3_BUCKET");

  const originUrl = parseUrl(appOrigin, "APP_ORIGIN");
  if (
    (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") ||
    originUrl.origin !== appOrigin ||
    originUrl.username.length > 0 ||
    originUrl.password.length > 0
  ) {
    invalid("APP_ORIGIN");
  }

  return {
    endpoint: endpointUrl.origin,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    appOrigin: originUrl.origin,
  };
}

function requireSetting(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = source[key];
  if (value === undefined || value.length === 0) invalid(key);
  return value;
}

function parseUrl(value: string, key: string): URL {
  try {
    return new URL(value);
  } catch {
    invalid(key);
  }
}

function invalid(key: string): never {
  throw new Error(`Invalid configuration: ${key}`);
}
