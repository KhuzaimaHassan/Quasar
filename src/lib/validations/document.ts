import { z } from "zod";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const createDocumentUploadSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.enum(
    [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    {
      invalid_type_error: "Only PDF and DOCX files are supported",
    }
  ),
  sizeBytes: z
    .number()
    .max(MAX_FILE_SIZE, "File size must be 25MB or less")
    .positive("File size must be greater than 0"),
}).strict();

export type CreateDocumentUploadInput = z.infer<typeof createDocumentUploadSchema>;
