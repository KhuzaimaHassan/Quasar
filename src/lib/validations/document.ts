import { z } from "zod";
import { filenameSchema } from "./filename";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const createDocumentUploadSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  filename: filenameSchema,
  mimeType: z.enum(
    [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    "Only PDF and DOCX files are supported"
  ),
  sizeBytes: z
    .number()
    .int("File size must be an integer")
    .max(MAX_FILE_SIZE, "File size must be 25MB or less")
    .positive("File size must be greater than 0"),
}).strict();

export type CreateDocumentUploadInput = z.infer<typeof createDocumentUploadSchema>;
