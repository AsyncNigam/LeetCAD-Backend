import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { ApiKeyGuard } from "./api-key.guard.js";

@Injectable()
export class HybridAuthGuard implements CanActivate {
  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Header-based routing: 
    // If it starts with Bearer lc_live_, delegate to the API key guard
    if (authHeader && authHeader.includes("lc_live_")) {
      return this.apiKeyGuard.canActivate(context) as Promise<boolean>;
    }

    // Otherwise, assume it's a JWT from the browser
    return this.jwtAuthGuard.canActivate(context) as Promise<boolean>;
  }
}
