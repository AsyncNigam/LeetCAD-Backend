import { z } from "zod";

export const PresignedUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export type PresignedUrlDto = z.infer<typeof PresignedUrlSchema>;
