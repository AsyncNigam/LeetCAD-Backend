import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Decorator that marks a route handler or controller with required roles.
 * Used in conjunction with RolesGuard to enforce RBAC.
 *
 * @example
 * @Roles('ADMIN', 'OWNER')
 * @Get('dashboard')
 * getDashboard() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
