import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv, { type AnySchema } from "ajv";
import { parse } from "yaml";

interface Operation {
  responses: Record<
    string,
    { $ref?: string; content?: Record<string, { schema: AnySchema }> }
  >;
}
interface OpenApi {
  openapi: string;
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, AnySchema>;
    responses: Record<
      string,
      { content: Record<string, { schema: AnySchema }> }
    >;
  };
}

// Trusted checked-in document, parsed only in tests. AJV compiles every schema.
export const contract = parse(
  readFileSync(
    resolve(__dirname, "../../../../../contracts/openapi.yaml"),
    "utf8",
  ),
) as OpenApi;
const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addFormat(
  "uuid",
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);
ajv.addFormat(
  "date-time",
  (value: string) =>
    /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)),
);
ajv.addFormat("uri", (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
});
ajv.addFormat("int64", { type: "number", validate: Number.isSafeInteger });
ajv.addSchema({
  $id: "dropit",
  definitions: rewriteRefs(contract.components.schemas),
});

export function validateResponse(
  path: string,
  method: string,
  status: number,
  body: unknown,
): void {
  const response = contract.paths[path]?.[method]?.responses[String(status)];
  if (response === undefined)
    throw new Error(`Undocumented response: ${method} ${path} ${status}`);
  if (status === 204) {
    if (body !== "") throw new Error("204 response must be empty");
    return;
  }
  const refName = response.$ref?.split("/").at(-1);
  const schema = (
    refName === undefined ? response : contract.components.responses[refName]
  )?.content?.["application/json"]?.schema;
  if (schema === undefined) throw new Error("Missing response schema");
  // Each response is rooted in the OpenAPI document so local refs remain valid.
  const validator = ajv.compile(rewriteRefs(schema));
  if (!validator(body))
    throw new Error(
      `Response contract mismatch: ${ajv.errorsText(validator.errors)}`,
    );
}

function rewriteRefs<T>(schema: T): T {
  return JSON.parse(
    JSON.stringify(schema).replaceAll(
      "#/components/schemas/",
      "dropit#/definitions/",
    ),
  ) as T;
}

export function validateCreateRequest(body: unknown): boolean {
  return ajv.validate({ $ref: "dropit#/definitions/CreateTransfer" }, body);
}

export function compileContractSchemas(): void {
  for (const name of Object.keys(contract.components.schemas))
    ajv.compile({ $ref: `dropit#/definitions/${name}` });
}
