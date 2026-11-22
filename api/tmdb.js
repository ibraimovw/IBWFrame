const https = require('https');

const TMDB_BASE = 'https://api.themoviedb.org/3';

const ALLOWED_PATTERNS = [
  /^\/trending\/(movie|tv|all)\/(day|week)$/,
  /^\/movie\/(popular|top_rated|upcoming|now_playing)$/,
  /^\/tv\/(popular|top_rated|on_the_air|airing_today)$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/(credits|videos|similar|recommendations|watch\/providers)$/,
  /^\/tv\/\d+$/,
  /^\/tv\/\d+\/(credits|videos|similar|recommendations|watch\/providers)$/,
  /^\/person\/(popular|\d+|\d+\/combined_credits)$/,
  /^\/search\/(multi|movie|tv|person)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/genre\/(movie|tv)\/list$/
];

const ALLOWED_PARAMS = new Set([
  'language', 'page', 'query', 'include_adult', 'with_genres',
  'primary_release_year', 'first_air_date_year', 'with_origin_country',
  'vote_average.gte', 'vote_count.gte', 'with_runtime.gte', 'with_runtime.lte',
  'sort_by', 'primary_release_date.gte', 'primary_release_date.lte',
  'region', 'watch_region', 'with_watch_providers'
]);

function isAllowedEndpoint(endpoint) {
  return ALLOWED_PATTERNS.some((regex) => regex.test(endpoint));
}

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const apiKey = process.env.TMDB_API_KEY || '';
  if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'TMDB_API_KEY is not configured in Vercel Environment Variables' }));
    return;
  }

  const reqUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const endpoint = reqUrl.pathname.replace(/^\/api\/tmdb/, '');

  if (!isAllowedEndpoint(endpoint)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Endpoint not allowed by proxy policy' }));
    return;
  }

  const targetUrl = new URL(TMDB_BASE + endpoint);
  targetUrl.searchParams.set('api_key', apiKey);

  for (const [key, value] of reqUrl.searchParams.entries()) {
    if (ALLOWED_PARAMS.has(key) && value !== '') {
      targetUrl.searchParams.set(key, value);
    }
  }

  https.get(targetUrl, (tmdbRes) => {
    let rawData = '';
    tmdbRes.on('data', (chunk) => { rawData += chunk; });
    tmdbRes.on('end', () => {
      res.statusCode = tmdbRes.statusCode || 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.end(rawData);
    });
  }).on('error', (err) => {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Failed to reach TMDB API', details: err.message }));
  });
};
