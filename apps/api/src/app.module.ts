import { Module } from "@nestjs/common";
import { ConsentController } from "./consent.controller.ts";
import { HealthController } from "./health.controller.ts";

@Module({ controllers: [HealthController, ConsentController] })
export class AppModule {}
