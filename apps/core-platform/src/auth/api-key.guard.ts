import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { ApiKeysService } from "../api-keys/api-keys.service.js";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }

    // We specifically look for the lc_live_ prefix to route to API Key auth
    if (!authHeader.startsWith("Bearer lc_live_")) {
      throw new UnauthorizedException("Invalid API key format");
    }

    // Extract the token after 'Bearer ' (7 characters)
    const rawToken = authHeader.substring(7).trim();

    if (!rawToken) {
      throw new UnauthorizedException("Malformed API key");
    }

    const keyEntity = await this.apiKeysService.validateKey(rawToken);

    if (!keyEntity) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }

    // Hydrate the request object so downstream controllers can access the user seamlessly
    // We use `userId` to perfectly mirror the JWT strategy output.
    (request as any).user = {
      userId: keyEntity.userId,
      isCli: true,
    };

    return true;
  }
}
