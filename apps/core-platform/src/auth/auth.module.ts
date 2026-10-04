import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtStrategy } from "./jwt.strategy.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { User } from "../entities/User.js";
import { ApiKeysModule } from "../api-keys/api-keys.module.js";
import { ApiKeyGuard } from "./api-key.guard.js";

@Module({
  imports: [
    PassportModule,
    ApiKeysModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") || "dev_fallback_secret",
        signOptions: { expiresIn: "24h" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, ApiKeyGuard],
  exports: [JwtModule, ApiKeyGuard],
})
export class AuthModule {}
