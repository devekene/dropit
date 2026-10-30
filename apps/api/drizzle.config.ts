import { defineConfig } from "drizzle-kit";
import { readDatabaseEnvironment } from "./src/config/database-environment";

const databaseUrl = process.env.DATABASE_URL;
const dbCredentials =
  databaseUrl === undefined
    ? {}
    : {
        dbCredentials: {
          url: readDatabaseEnvironment({ DATABASE_URL: databaseUrl })
            .databaseUrl,
        },
      };

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  ...dbCredentials,
});
