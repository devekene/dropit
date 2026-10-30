import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { databaseSchema } from "./schema";

export interface DatabaseConnection {
  client: Sql;
  db: PostgresJsDatabase<typeof databaseSchema>;
  close: () => Promise<void>;
}

export function createDatabaseConnection(
  databaseUrl: string,
): DatabaseConnection {
  const client = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    prepare: true,
  });
  const db = drizzle(client, { schema: databaseSchema });

  return {
    client,
    db,
    close: async () => client.end({ timeout: 5 }),
  };
}
