#!/usr/bin/env node
/**
 * find-orphaned-storage.mjs
 * 
 * Lists objects in the Supabase "uploads" bucket that have no matching
 * Document row in the database. Reports only — does not delete anything.
 *
 * Usage:
 *   node scripts/find-orphaned-storage.mjs
 *
 * Required env vars (reads from .env.local via dotenv):
 *   DATABASE_URL          — Prisma-compatible PostgreSQL connection string
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// Load .env.local manually if it exists
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  // Ignore env loading errors, fallback to existing process.env
}

const BUCKET = "uploads";

async function listAllFiles(supabase, bucket, folder = "") {
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error) throw error;
  if (!items || items.length === 0) return [];

  let files = [];
  for (const item of items) {
    const fullPath = folder ? `${folder}/${item.name}` : item.name;
    // In Supabase storage, folders have id === null or metadata === null
    if (item.id === null || !item.metadata) {
      // It's a folder, recurse
      const subFiles = await listAllFiles(supabase, bucket, fullPath);
      files = files.concat(subFiles);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Connect to Supabase Storage
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Scanning "${BUCKET}" bucket for all objects...`);
  const storageFiles = await listAllFiles(supabase, BUCKET, "");

  if (storageFiles.length === 0) {
    console.log(`✅ No files found in the "${BUCKET}" bucket. Nothing to reconcile.`);
    process.exit(0);
  }

  console.log(`Found ${storageFiles.length} total file(s) in "${BUCKET}" bucket:\n`);

  // Categorize by prefix
  const docFiles = storageFiles.filter((p) => p.startsWith("documents/"));
  const chatFiles = storageFiles.filter((p) => p.startsWith("chat-attachments/"));
  const sandboxFiles = storageFiles.filter((p) => p.startsWith("agent-sandbox/"));
  const otherFiles = storageFiles.filter(
    (p) => !p.startsWith("documents/") && !p.startsWith("chat-attachments/") && !p.startsWith("agent-sandbox/")
  );

  console.log(`  - documents/ (RAG documents): ${docFiles.length} file(s)`);
  console.log(`  - chat-attachments/ (Message uploads): ${chatFiles.length} file(s)`);
  console.log(`  - agent-sandbox/ (Agent workspaces): ${sandboxFiles.length} file(s)`);
  if (otherFiles.length > 0) {
    console.log(`  - other prefixes: ${otherFiles.length} file(s)`);
  }
  console.log();

  // Connect to database via Prisma
  const prisma = new PrismaClient();

  try {
    // 1. Reconcile documents/ against Document table
    const documents = await prisma.document.findMany({
      select: { storagePath: true, filename: true },
    });
    const dbDocPaths = new Set(documents.map((d) => d.storagePath).filter(Boolean));
    const docOrphans = docFiles.filter((path) => !dbDocPaths.has(path));

    console.log("=== 1. DOCUMENT STORAGE RECONCILIATION ===");
    if (docOrphans.length === 0) {
      console.log(`✅ All ${docFiles.length} document storage file(s) match active Document rows in PostgreSQL.`);
    } else {
      console.log(`⚠️  Found ${docOrphans.length} orphaned document file(s):`);
      for (const path of docOrphans) console.log(`  - ${path}`);
    }

    // 2. Inspect chat-attachments/ against Message attachments metadata
    console.log("\n=== 2. CHAT ATTACHMENTS STORAGE AUDIT ===");
    const messages = await prisma.message.findMany({
      where: { metadata: { not: {} } },
      select: { id: true, metadata: true },
    });
    const activeAttachmentPaths = new Set();
    for (const msg of messages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = msg.metadata;
      if (meta && Array.isArray(meta.attachments)) {
        for (const att of meta.attachments) {
          if (att.storagePath) activeAttachmentPaths.add(att.storagePath);
          if (att.url && typeof att.url === "string") {
            const match = att.url.match(/chat-attachments\/[^\s?]+/);
            if (match) activeAttachmentPaths.add(match[0]);
          }
        }
      }
    }

    console.log(`Found ${chatFiles.length} chat-attachment object(s) across conversation threads.`);
    const unlinkedChatFiles = chatFiles.filter((p) => !activeAttachmentPaths.has(p));
    console.log(
      `  - ${activeAttachmentPaths.size} referenced in active Message metadata records`
    );
    if (unlinkedChatFiles.length > 0) {
      console.log(`  - ${unlinkedChatFiles.length} unlinked or from temporary uploads/drafts:`);
      for (const p of unlinkedChatFiles) console.log(`      * ${p}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
