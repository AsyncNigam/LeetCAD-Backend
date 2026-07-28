import { Controller, Post, Body, UsePipes } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { GoogleLoginSchema } from "./dto/google-login.dto.js";
import type { GoogleLoginDto } from "./dto/google-login.dto.js";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
