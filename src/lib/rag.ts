import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  filename: string;
  chunkIndex: number;
  documentId: string;
  metadata: any;
}

export async function retrieveContext(workspaceId: string, query: string): Promise<RetrievedChunk[]> {
  try {
    // 1. Cheaply check if the workspace has any ready documents
    const readyDoc = await db.document.findFirst({
      where: {
        workspaceId,
        status: "ready"
      },
      select: { id: true }
    });

    if (!readyDoc) {
      return [];
    }

    // 2. Call FastAPI
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    const fastApiUrl = process.env.FASTAPI_SERVICE_URL || "http://127.0.0.1:8000";

    if (!internalSecret) {
      console.warn("INTERNAL_SERVICE_SECRET is not set, skipping retrieval.");
      return [];
    }

    // Add a ~6 second timeout using AbortController.
    // Deliberate tradeoff: Render's free tier sleeps after 15 minutes, causing a 30-60s cold start.
    // We don't want to stall the user's active chat for a minute while waiting for the RAG service to wake up.
    // If it times out, we catch it, log it explicitly, and gracefully degrade so the chat proceeds without RAG context.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${fastApiUrl}/retrieve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": internalSecret
      },
      body: JSON.stringify({ workspace_id: workspaceId, query, top_k: 5 }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("FastAPI /retrieve failed:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return data.chunks || [];
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn("FastAPI /retrieve timed out (likely a cold start). Gracefully degrading RAG context for this message.");
    } else {
      console.error("Error during retrieveContext:", error);
    }
    return [];
  }
}

export function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const basePrompt = "You are Quasar, an AI developer workspace assistant. Be concise and specific.";
  
  if (!chunks || chunks.length === 0) {
    return basePrompt;
  }

  let prompt = basePrompt + "\n\n<context>\n";
  for (const chunk of chunks) {
    prompt += `Source: ${chunk.filename}\n${chunk.content}\n\n`;
  }
  prompt += "</context>\n\nWhen answering, always mention which file your information came from based on the context above.";

  return prompt;
}

export interface Citation {
  documentId: string;
  filename: string;
  url: string;
  similarity: number;
}

export async function resolveCitations(chunks: RetrievedChunk[]): Promise<Citation[]> {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Deduplicate chunks by documentId, keeping the highest similarity for each document
  const topChunkPerDoc = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const existing = topChunkPerDoc.get(chunk.documentId);
    if (!existing || chunk.similarity > existing.similarity) {
      topChunkPerDoc.set(chunk.documentId, chunk);
    }
  }

  const documentIds = Array.from(topChunkPerDoc.keys());

  // Batch query to get storage paths
  const documents = await db.document.findMany({
    where: {
      id: { in: documentIds }
    },
    select: {
      id: true,
      storagePath: true,
      filename: true
    }
  });

  const citations: Citation[] = [];

  for (const doc of documents) {
    // Generate signed URL (same pattern as AttachmentChip uses / upload-url relies on)
    const { data, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(doc.storagePath, 3600); // 1 hour

    if (error || !data) {
      console.error(`Failed to create signed URL for document ${doc.id}:`, error);
      continue;
    }

    const chunk = topChunkPerDoc.get(doc.id);
    if (chunk) {
      citations.push({
        documentId: doc.id,
        filename: doc.filename,
        url: data.signedUrl,
        similarity: chunk.similarity
      });
    }
  }

  // Sort by similarity descending
  return citations.sort((a, b) => b.similarity - a.similarity);
}
