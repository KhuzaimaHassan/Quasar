import { z } from "zod";

export const createAgentRunSchema = z.object({
  conversationId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  task: z.string().trim().min(1).max(2000),
  executionTarget: z.enum(["sandbox", "github"]).default("sandbox"),
  targetRepo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use owner/repository').max(200).optional(),
}).strict().refine((data) => {
  if (data.executionTarget === "github") {
    return !!data.targetRepo && data.targetRepo.length > 0;
  }
  return true;
}, {
  message: "targetRepo is required when executionTarget is github",
  path: ["targetRepo"]
});

export const resumeAgentRunSchema = z.object({
  approved: z.boolean()
}).strict();
