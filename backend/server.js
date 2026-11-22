const http = require('http');
const fs = require('fs');
const path = require('path');
const { proxyTmdbRequest } = require('./routes/tmdb');

// Запасной парсер .env, если сервер запущен без флага --env-file
function loadEnvFallback(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnvFallback(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Простой in-memory rate limiter по IP (120 запросов в минуту)
const rateMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60_000;
  }
  entry.count += 1;
  rateMap.set(ip, entry);
  return entry.count <= 120;
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const clientIp = req.socket.remoteAddress || 'unknown';

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // API Proxy маршруты
  if (reqUrl.pathname.startsWith('/api/tmdb/')) {
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Too Many Requests' }));
      return;
    }
    if (!TMDB_API_KEY || TMDB_API_KEY === 'your_tmdb_api_key_here') {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: 'TMDB_API_KEY is not configured in backend/.env'
      }));
      return;
    }
    proxyTmdbRequest(reqUrl, TMDB_API_KEY, res);
    return;
  }

  // Статические файлы или SPA Fallback (History API)
  const safePath = path.normalize(reqUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
  const candidatePath = path.join(FRONTEND_DIR, safePath);

  if (candidatePath.startsWith(FRONTEND_DIR) && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    serveFile(candidatePath, res);
    return;
  }

  // Если запрашивался конкретный ассет с расширением, но его нет — 404
  if (path.extname(safePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Asset Not Found');
    return;
  }

  // Любой SPA-маршрут (/movies, /movie/550, /collections и т.д.) отдаёт index.html
  serveFile(path.join(FRONTEND_DIR, 'index.html'), res);
});

server.listen(PORT, () => {
  console.log(`IBWFrame server running at http://localhost:${PORT}`);
});
