import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.cpSync(FRONTEND_DIR, DIST_DIR, { recursive: true, force: true });

console.log('IBWFrame static assets copied to dist/ successfully.');
