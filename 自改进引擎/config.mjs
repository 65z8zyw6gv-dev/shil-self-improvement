import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

export const config = {
  root: ROOT,
  baseUrl: (process.env.SHIL_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  apiKey: process.env.SHIL_API_KEY || '',
  model: process.env.SHIL_MODEL || 'deepseek-chat',
  passThreshold: Number(process.env.SHIL_PASS_THRESHOLD || 0.6),
  offline: process.env.SHIL_OFFLINE === '1',
  artifacts: ['prompt.md'],
};
