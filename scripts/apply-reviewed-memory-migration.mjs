// Temporary, exact-branch rollout step. Remove after the approved migration
// succeeds; do not turn this into an automatic production migration hook.
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const migration = '20261116090000_protect_user_managed_memories';
const reviewedHash = '2a38ae1cf22e86cb98fff917a45e93f143a87163e24473fb3dbbc87ca0973cc5';
let database;
let stage = 'branch-guard';

async function fingerprint() {
  const [row] = await database.$queryRaw`
    SELECT count(*)::int AS count,
      md5(COALESCE(string_agg("id" || ':' || "value" || ':' || "confidence"::text, '|' ORDER BY "id"), '')) AS digest
    FROM "Memory"
  `;
  return row;
}

async function inspect() {
  const history = await database.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  const applied = new Set(history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
  const files = await readdir(path.resolve('prisma/migrations'), { withFileTypes: true });
  const pending = files.filter(file => file.isDirectory() && !applied.has(file.name)).map(file => file.name);
  const columns = await database.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Memory' AND column_name = 'isUserManaged'
  `;
  return { pending, recorded: applied.has(migration), columnExists: columns.length > 0, failed: history.some(row => !row.finished_at && !row.rolled_back_at) };
}

async function main() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'fix/protect-manual-memory') {
    throw new Error('Refusing migration outside the approved preview branch');
  }
  stage = 'checksum';
  const sql = await readFile(path.resolve('prisma/migrations', migration, 'migration.sql'), 'utf8');
  if (createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex') !== reviewedHash) {
    throw new Error('Reviewed migration checksum changed');
  }
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  if (!databaseUrl || !directUrl) throw new Error('Missing approved database settings');
  stage = 'migration-history';
  database = new PrismaClient({ datasourceUrl: directUrl, log: [] });
  const beforeState = await inspect();
  if (beforeState.failed) throw new Error('An unfinished migration needs review');
  if (beforeState.recorded && beforeState.columnExists && beforeState.pending.length === 0) {
    console.log('MEMORY_MIGRATION_VERIFIED', JSON.stringify({ migration, state: 'already-applied', historyRecorded: true }));
    return;
  }
  stage = 'pending-review';
  if (beforeState.columnExists || beforeState.pending.length !== 1 || beforeState.pending[0] !== migration) {
    throw new Error('Only the reviewed migration may be pending');
  }
  const before = await fingerprint();
  stage = 'apply';
  const child = spawn(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: process.cwd(),
    // Do not pass unrelated application secrets to the migration subprocess.
    env: { PATH: process.env.PATH, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl, CI: 'true', PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  child.stdout.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-32768); });
  child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-32768); });
  const deadline = setTimeout(() => child.kill(), 120000);
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  clearTimeout(deadline);
  if (code !== 0) {
    const error = new Error('Reviewed migration command failed');
    error.safeCode = diagnostics.match(/\bP\d{4}\b/)?.[0];
    throw error;
  }
  stage = 'verify';
  const afterState = await inspect();
  const after = await fingerprint();
  const [protectedRows] = await database.$queryRaw`SELECT count(*)::int AS count FROM "Memory" WHERE "isUserManaged" = true`;
  const preserved = before.count === after.count && before.digest === after.digest;
  if (!preserved || !afterState.recorded || !afterState.columnExists || protectedRows.count !== before.count) {
    throw new Error('Post-migration verification needs review');
  }
  // Only booleans and the public migration name enter build logs. No connection
  // strings, user identifiers, memory values, counts or fingerprints are logged.
  console.log('MEMORY_MIGRATION_VERIFIED', JSON.stringify({ migration, state: 'applied', historyRecorded: true, valuesAndConfidencePreserved: true, existingRowsProtected: true }));
}

try {
  await main();
} catch (error) {
  console.error('MEMORY_MIGRATION_STOPPED', JSON.stringify({ stage, type: error.name, code: error.safeCode ?? error.code ?? null }));
  process.exitCode = 1;
} finally {
  if (database) await database.$disconnect().catch(() => {});
}
