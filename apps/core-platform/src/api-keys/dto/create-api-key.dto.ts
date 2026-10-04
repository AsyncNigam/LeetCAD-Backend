/**
 * DTO for creating a new Developer API key.
 *
 * Validated manually in the controller to avoid pulling
 * in class-validator / class-transformer as new dependencies.
 */
export interface CreateApiKeyDto {
  /** Human-readable label to help the user identify the key (e.g. "ThinkPad Terminal") */
  name: string;
}
