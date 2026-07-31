import { z } from "zod";

export const createAgentRunSchema = z.object({
  conversationId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  task: z.string().min(1).max(2000)
}).strict();

export const resumeAgentRunSchema = z.object({
  approved: z.boolean()
}).strict();
