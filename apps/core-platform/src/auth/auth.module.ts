import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy.js";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: "leetcad_dev_secret",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
