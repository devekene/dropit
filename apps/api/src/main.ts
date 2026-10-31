import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { readApiEnvironment } from "./config/environment";
import {
  configureHttpBoundary,
  createApiAdapter,
} from "./transfers/http-boundary";

async function bootstrap(): Promise<void> {
  const environment = readApiEnvironment(process.env);
  const adapter = createApiAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: false },
  );

  configureHttpBoundary(app, adapter);
  app.enableShutdownHooks();
  await app.listen(environment.port, "127.0.0.1");
  console.info(`DropIt API listening on http://127.0.0.1:${environment.port}`);
}

bootstrap().catch(() => {
  console.error("DropIt API failed to start.");
  process.exitCode = 1;
});
