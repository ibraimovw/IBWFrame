const https = require('https');

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Строгий белый список разрешённых маршрутов TMDB (защита от открытого прокси)
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

function proxyTmdbRequest(reqUrl, apiKey, res) {
  const endpoint = reqUrl.pathname.replace(/^\/api\/tmdb/, '');

  if (!isAllowedEndpoint(endpoint)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
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
      res.writeHead(tmdbRes.statusCode || 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      });
      res.end(rawData);
    });
  }).on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Failed to reach TMDB API', details: err.message }));
  });
}

module.exports = { proxyTmdbRequest };
