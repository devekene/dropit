import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { TransferService } from "./transfer-service";
import {
  assertEmptyBody,
  parseCreateTransfer,
  parseIdempotencyKey,
  parseManagementToken,
  parseTransferId,
} from "./transfer-contract";

@Controller()
export class TransferController {
  constructor(
    @Inject(TransferService) private readonly service: TransferService,
  ) {}

  @Post("transfers")
  @HttpCode(201)
  create(@Body() body: unknown, @Headers("idempotency-key") key: unknown) {
    return this.service.create(
      parseCreateTransfer(body),
      parseIdempotencyKey(key),
    );
  }

  @Post("transfers/:id/complete")
  @HttpCode(200)
  complete(
    @Param("id") id: string,
    @Headers("authorization") authorization: unknown,
    @Body() body: unknown,
  ) {
    const token = parseManagementToken(authorization);
    assertEmptyBody(body);
    return this.service.complete(parseTransferId(id), token);
  }

  @Delete("transfers/:id")
  @HttpCode(204)
  cancel(
    @Param("id") id: string,
    @Headers("authorization") authorization: unknown,
    @Body() body: unknown,
  ) {
    const token = parseManagementToken(authorization);
    assertEmptyBody(body);
    return this.service.cancel(parseTransferId(id), token);
  }

  @Get("public/transfers/:token")
  metadata(@Param("token") token: string) {
    return this.service.metadata(token);
  }
}
