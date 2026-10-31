import { Module, type DynamicModule } from "@nestjs/common";
import { TransferController } from "./transfer-controller";
import { TransferService } from "./transfer-service";

/** Intentionally absent from AppModule. No environment flag enables live routes. */
@Module({})
export class TransferApiModule {
  static forTesting(service: TransferService): DynamicModule {
    if (process.env.NODE_ENV !== "test")
      throw new Error("Transfer API is test-only until Slice 07");
    return {
      module: TransferApiModule,
      controllers: [TransferController],
      providers: [{ provide: TransferService, useValue: service }],
    };
  }
}
