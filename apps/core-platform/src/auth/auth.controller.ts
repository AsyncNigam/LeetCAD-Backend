import { Controller, Post, Body, UsePipes } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { GoogleLoginSchema } from "./dto/google-login.dto.js";
import type { GoogleLoginDto } from "./dto/google-login.dto.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("google")
  @UsePipes(new ZodValidationPipe(GoogleLoginSchema))
  async googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.token);
  }
}
