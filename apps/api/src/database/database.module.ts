import {
  DynamicModule,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  readDatabaseEnvironment,
  type DatabaseEnvironment,
} from "../config/database-environment";
import {
  createDatabaseConnection,
  type DatabaseConnection,
} from "./connection";

export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  onApplicationShutdown(): Promise<void> {
    return this.connection.close();
  }
}

@Module({})
export class DatabaseModule {
  static forEnvironment(environment: DatabaseEnvironment): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE_CONNECTION,
          useFactory: () => createDatabaseConnection(environment.databaseUrl),
        },
        DatabaseLifecycle,
      ],
      exports: [DATABASE_CONNECTION],
    };
  }

  static forEnvironmentSource(
    source: Readonly<Record<string, string | undefined>>,
  ): DynamicModule {
    return DatabaseModule.forEnvironment(readDatabaseEnvironment(source));
  }
}
