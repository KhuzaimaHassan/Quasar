import { execSync } from 'child_process'

const SECRET_PATTERNS = [
  {
    name: 'PostgreSQL / Database Connection String with Credentials',
    regex: /(postgres|postgresql|mysql|mongodb\+srv):\/\/[^\s:@'"]+:[^\s@'"]{4,}@[^\s/'"]+/i,
  },
  {
    name: 'OpenAI / Generic API Key (sk-...)',
    regex: /sk-[a-zA-Z0-9_\-]{20,}/,
  },
  {
    name: 'GitHub Personal Access / OAuth Token (ghp_, gho_, ghs_)',
    regex: /(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}/,
  },
  {
    name: 'Google API Key (AIza...)',
    regex: /AIza[0-9A-Za-z-_]{35}/,
  },
  {
    name: 'LangSmith Token (lsv2_...)',
    regex: /lsv2_[a-zA-Z0-9_\-]{25,}/,
  },
  {
    name: 'Clerk / Webhook Secret (sk_live_, whsec_)',
    regex: /(sk_live_|whsec_)[a-zA-Z0-9+/=_\-]{20,}/,
  },
  {
    name: 'JWT Token (Supabase / Auth Service Role Key)',
    regex: /eyJ[a-zA-Z0-9_\-]{15,}\.eyJ[a-zA-Z0-9_\-]{15,}\.[a-zA-Z0-9_\-]{15,}/,
  },
  {
    name: 'Hardcoded Secret / Password Assignment',
    regex: /(password|secret_key|api_key|service_role_key)\s*[:=]\s*["'][a-zA-Z0-9_\-+/=]{16,}["']/i,
  },
]

// Excluded files from scanning (documentation examples, lockfiles, etc.)
const EXCLUDED_FILES = [
  '.env.example',
  'package-lock.json',
  'scan-secrets.mjs',
]

function getStagedDiff() {
  try {
    const output = execSync('git diff --cached --unified=0', { encoding: 'utf8' })
    return output
  } catch {
    return ''
  }
}

function scanStagedChanges() {
  const diff = getStagedDiff()
  if (!diff.trim()) {
    process.exit(0)
  }

  const lines = diff.split('\n')
  let currentFile = ''
  const violations = []

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.replace('+++ b/', '').trim()
      continue
    }

    // Skip removed lines or non-addition lines
    if (!line.startsWith('+') || line.startsWith('+++')) {
      continue
    }

    if (EXCLUDED_FILES.some(f => currentFile.endsWith(f))) {
      continue
    }

    const addedContent = line.slice(1) // remove leading '+'

    // Allow placeholder text
    if (
      addedContent.includes('[REDACTED]') ||
      addedContent.includes('dummy_') ||
      addedContent.includes('your-secret-here') ||
      addedContent.includes('example') ||
      addedContent.includes('placeholder') ||
      addedContent.includes('...')
    ) {
      continue
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(addedContent)) {
        violations.push({
          file: currentFile,
          rule: pattern.name,
          snippet: addedContent.trim().slice(0, 80),
        })
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n' + '='.repeat(80))
    console.error('🚨 [PRE-COMMIT BLOCKED] POTENTIAL SECRET / CREDENTIAL LEAK DETECTED!')
    console.error('='.repeat(80))
    console.error(`Found ${violations.length} high-entropy secret pattern(s) in staged changes:\n`)

    for (const v of violations) {
      console.error(`  - File:    ${v.file}`)
      console.error(`    Type:    ${v.rule}`)
      console.error(`    Snippet: ${v.snippet}`)
      console.error('-'.repeat(80))
    }

    console.error('\nAction Required: Move secrets into .env.local or backend/.env.')
    console.error('Never hardcode database URLs or API tokens into source files or test scripts.')
    console.error('='.repeat(80) + '\n')
    process.exit(1)
  }

  console.log('✅ [Pre-Commit] Secret scanning passed — zero credential patterns detected in staged files.')
  process.exit(0)
}

scanStagedChanges()
