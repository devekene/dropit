import { defineConfig } from "drizzle-kit";
import { readDatabaseEnvironment } from "./src/config/database-environment";

const environment = readDatabaseEnvironment(process.env);

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials: { url: environment.databaseUrl },
});
