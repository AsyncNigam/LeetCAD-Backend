import { Controller, Post, Body, UsePipes, ForbiddenException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { GoogleLoginSchema } from "./dto/google-login.dto.js";
import type { GoogleLoginDto } from "./dto/google-login.dto.js";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post("google")
  @ApiOperation({ summary: "Stateless Google OAuth Login" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["token"],
      properties: {
        token: { type: "string", description: "Google OAuth2 ID token" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "JWT access token returned" })
  @ApiResponse({ status: 401, description: "Invalid Google token" })
  @UsePipes(new ZodValidationPipe(GoogleLoginSchema))
  async googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.token);
  }

  @Post("dev-login")
  @ApiOperation({ summary: "Dev-only login bypass for local testing" })
  @ApiResponse({ status: 201, description: "JWT access token + dev user returned" })
  @ApiResponse({ status: 403, description: "Dev login disabled in production" })
  async devLogin() {
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    const allowDevAuth = this.configService.get<string>("ALLOW_DEV_AUTH", "false");

    if (nodeEnv === "production" && allowDevAuth !== "true") {
      throw new ForbiddenException("Dev login is disabled in production");
    }

    return this.authService.devLogin();
  }
}
