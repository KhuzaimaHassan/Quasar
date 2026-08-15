import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const envFiles = [path.join(rootDir, '.env.local'), path.join(rootDir, '.env')];

for (const file of envFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const k = key.trim();
        const v = rest.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}
