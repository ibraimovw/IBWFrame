import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './tmdbProxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const STATIC_DIR =
  process.env.NODE_ENV === 'production' && fs.existsSync(path.join(ROOT_DIR, 'dist'))
    ? path.join(ROOT_DIR, 'dist')
    : path.join(ROOT_DIR, 'frontend');

// Читаем локальный .env файл, если переменные ещё не заданы
function loadLocalEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eqIndex = line.indexOf('=');
      if (eqIndex <= 0) continue;

      const key = line.slice(0, eqIndex).trim();
      let val = line.slice(eqIndex + 1).trim();

      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // Пропускаем, если файл .env недоступен для чтения
  }
}

loadLocalEnv();

const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

// Отдаём статический файл с нужным MIME-типом
function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
  });

  fs.createReadStream(filePath).pipe(res);
}

// Основной HTTP-сервер (API-прокси + статика)
const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, parsedUrl);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    // Проверяем безопасный путь внутри папки со статикой
    const safeRel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const candidate = path.resolve(STATIC_DIR, safeRel);

    if (
      candidate.startsWith(STATIC_DIR + path.sep) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      sendFile(res, candidate);
      return;
    }

    // Если не найден конкретный файл-ресурс — возвращаем 404
    if (path.extname(pathname)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    // Для всех маршрутов SPA отдаём index.html
    const indexHtml = path.join(STATIC_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      sendFile(res, indexHtml);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('index.html not found');
  } catch (err) {
    console.error('Server error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Internal server error' }));
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`IBWFrame server running at http://localhost:${PORT} (Vanilla JS + Node.js)`);
});
