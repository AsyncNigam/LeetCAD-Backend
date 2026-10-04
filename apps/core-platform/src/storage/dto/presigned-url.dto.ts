import { z } from "zod";

export const PresignedUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  problemId: z.string().min(36).max(36),
});

export type PresignedUrlDto = z.infer<typeof PresignedUrlSchema>;
