import { z } from "zod/v4";

const MAX_UPLOAD_SIZE = 200 * 1024 * 1024;

const ALLOWED_CONTENT_TYPE_REGEX =
  /^(image\/(png|jpe?g|gif|webp|svg\+xml|avif)|video\/(mp4|webm|quicktime|x-matroska)|application\/(pdf|json|zip))$/i;

export const RequestUploadUrlBody = z.object({
  name: z.string().min(1).max(512),
  size: z.number().int().positive().max(MAX_UPLOAD_SIZE),
  contentType: z
    .string()
    .min(1)
    .max(128)
    .refine((v) => ALLOWED_CONTENT_TYPE_REGEX.test(v), {
      message: "Unsupported contentType",
    }),
});

export const RequestUploadUrlResponse = z.object({
  uploadURL: z.string(),
  objectPath: z.string(),
  metadata: z.object({
    name: z.string(),
    size: z.number(),
    contentType: z.string(),
  }),
});
