import { randomUUID } from "node:crypto";
import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { finalize, type Observable } from "rxjs";
import { API_ERRORS, TransferApiError, type ApiErrorCode } from "./api-error";

interface Reply {
  status(code: number): Reply;
  header(name: string, value: string): Reply;
  send(body: unknown): void;
}

function sendError(error: unknown, requestId: string, reply: Reply): void {
  let code: ApiErrorCode = "INTERNAL_ERROR";
  if (error instanceof TransferApiError) code = error.code;
  else {
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : typeof error === "object" && error !== null && "statusCode" in error
          ? error.statusCode
          : undefined;
    if (status === 404) code = "NOT_FOUND";
    else if (status === 413) code = "PAYLOAD_TOO_LARGE";
    else if (status === 400 || status === 415) code = "VALIDATION_ERROR";
  }
  const [status, message] = API_ERRORS[code];
  if (status === 429 || status === 503) reply.header("Retry-After", "5");
  reply.header("Cache-Control", "no-store");
  reply.header("X-Request-Id", requestId);
  reply.status(status).send({ error: { code, message, requestId } });
}

@Catch()
class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    sendError(
      error,
      context.getRequest<{ id: string }>().id,
      context.getResponse<Reply>(),
    );
  }
}

/** Resource admission only; not a substitute for Slice 07's shared abuse limiter. */
class RequestAdmission implements NestInterceptor {
  private active = 0;

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (this.active >= 8) throw new TransferApiError("RATE_LIMITED");
    this.active++;
    return next.handle().pipe(
      finalize(() => {
        this.active--;
      }),
    );
  }
}

export function createApiAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    bodyLimit: 32 * 1024,
    requestTimeout: 10_000,
    connectionTimeout: 10_000,
    keepAliveTimeout: 5_000,
    trustProxy: false,
    logger: false,
    requestIdHeader: false,
    genReqId(request: {
      headers: Record<string, string | string[] | undefined>;
    }) {
      const id = request.headers["x-request-id"];
      return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id)
        ? id
        : randomUUID();
    },
  });
}

export function configureHttpBoundary(
  app: NestFastifyApplication,
  adapter: FastifyAdapter,
): void {
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestAdmission());
  const server = adapter.getInstance();
  server.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Request-Id", _request.id);
  });
  server.addHook("preValidation", async (request, reply) => {
    if (
      typeof request.query === "object" &&
      request.query !== null &&
      Object.keys(request.query).length > 0
    ) {
      sendError(new TransferApiError("VALIDATION_ERROR"), request.id, reply);
    }
  });
}
