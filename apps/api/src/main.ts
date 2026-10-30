import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { readApiEnvironment } from "./config/environment";

async function bootstrap(): Promise<void> {
  const environment = readApiEnvironment(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 32 * 1024,
      requestTimeout: 10_000,
      connectionTimeout: 10_000,
      keepAliveTimeout: 5_000,
      trustProxy: false,
      logger: false,
    }),
    { logger: false },
  );

  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();
  await app.listen(environment.port, "127.0.0.1");
  console.info(`DropIt API listening on http://127.0.0.1:${environment.port}`);
}

bootstrap().catch(() => {
  console.error("DropIt API failed to start.");
  process.exitCode = 1;
});
