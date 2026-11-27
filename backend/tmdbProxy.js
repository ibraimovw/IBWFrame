// Серверный прокси к TMDB API с кешем и защитой от частых запросов
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const CACHE_MAX_ENTRIES = 350;
const CACHE_TTL_MS = 1000 * 60 * 10;
const responseCache = new Map();

function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data, ttlMs = CACHE_TTL_MS) {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 140;
const rateBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    if (rateBuckets.size > 2000) {
      rateBuckets.clear();
    }
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (bucket.count >= RATE_MAX_REQUESTS) {
    return true;
  }

  bucket.count += 1;
  return false;
}

const POSITIVE_INT_RE = /^\d{1,9}$/;
const ALLOWED_LANGUAGES = new Set(['en-US', 'ru-RU']);
const ALLOWED_SORT_BY = new Set([
  'popularity.desc',
  'popularity.asc',
  'vote_average.desc',
  'vote_average.asc',
  'primary_release_date.desc',
  'primary_release_date.asc',
  'first_air_date.desc',
  'first_air_date.asc',
  'revenue.desc',
]);

function sanitizeLanguage(raw) {
  if (typeof raw === 'string' && ALLOWED_LANGUAGES.has(raw)) {
    return raw;
  }
  if (raw === 'ru') return 'ru-RU';
  return 'en-US';
}

function sanitizePage(raw) {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1) return 1;
  return Math.min(num, 500);
}

export function getTmdbKey() {
  return (process.env.TMDB_API_KEY || '').trim();
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function fetchFromTmdb(tmdbPath, params) {
  const apiKey = getTmdbKey();
  if (!apiKey || apiKey === 'MY_TMDB_API_KEY') {
    const err = new Error('TMDB_NOT_CONFIGURED');
    err.status = 503;
    err.code = 'TMDB_NOT_CONFIGURED';
    throw err;
  }

  const url = new URL(`${TMDB_BASE_URL}${tmdbPath}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const isV4Token = apiKey.length > 45 || apiKey.includes('.');
  const headers = { Accept: 'application/json' };
  if (isV4Token) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set('api_key', apiKey);
  }

  const cacheKey = `${tmdbPath}?${url.searchParams.toString()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (response.status === 429) {
      const err = new Error('RATE_LIMIT');
      err.status = 429;
      err.code = 'RATE_LIMIT';
      throw err;
    }

    if (response.status === 401) {
      const err = new Error('TMDB_UNAUTHORIZED');
      err.status = 503;
      err.code = 'TMDB_NOT_CONFIGURED';
      throw err;
    }

    if (response.status === 404) {
      const err = new Error('NOT_FOUND');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!response.ok) {
      const err = new Error('TMDB_ERROR');
      err.status = 502;
      err.code = 'TMDB_ERROR';
      throw err;
    }

    const data = await response.json();
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const err = new Error('TMDB_TIMEOUT');
      err.status = 504;
      err.code = 'TMDB_ERROR';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sendTmdbError(res, error) {
  const status = error?.status || 502;
  const code = error?.code || 'TMDB_ERROR';
  sendJson(res, status, {
    error: code,
    message: error?.message || 'Unable to fetch data from TMDB.',
  });
}

function buildDiscoverParams(query) {
  const params = {
    language: sanitizeLanguage(query.language),
    page: sanitizePage(query.page),
    include_adult: 'false',
    sort_by: ALLOWED_SORT_BY.has(query.sort_by) ? query.sort_by : 'popularity.desc',
  };

  if (typeof query.with_genres === 'string' && /^[\d,|]{1,50}$/.test(query.with_genres)) {
    params.with_genres = query.with_genres;
  }
  if (typeof query.with_origin_country === 'string' && /^[A-Z]{2}$/.test(query.with_origin_country)) {
    params.with_origin_country = query.with_origin_country;
  }
  if (typeof query.primary_release_year === 'string' && /^(19|20)\d{2}$/.test(query.primary_release_year)) {
    params.primary_release_year = query.primary_release_year;
  }
  if (typeof query.first_air_date_year === 'string' && /^(19|20)\d{2}$/.test(query.first_air_date_year)) {
    params.first_air_date_year = query.first_air_date_year;
  }
  if (typeof query['primary_release_date.gte'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query['primary_release_date.gte'])) {
    params['primary_release_date.gte'] = query['primary_release_date.gte'];
  }
  if (typeof query['primary_release_date.lte'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query['primary_release_date.lte'])) {
    params['primary_release_date.lte'] = query['primary_release_date.lte'];
  }
  if (typeof query['first_air_date.gte'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query['first_air_date.gte'])) {
    params['first_air_date.gte'] = query['first_air_date.gte'];
  }
  if (typeof query['first_air_date.lte'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query['first_air_date.lte'])) {
    params['first_air_date.lte'] = query['first_air_date.lte'];
  }

  const minRating = Number(query['vote_average.gte']);
  if (!Number.isNaN(minRating) && minRating >= 0 && minRating <= 10) {
    params['vote_average.gte'] = minRating;
  }
  const minVotes = Number(query['vote_count.gte']);
  if (!Number.isNaN(minVotes) && minVotes >= 0 && minVotes <= 50000) {
    params['vote_count.gte'] = minVotes;
  }
  const minRuntime = Number(query['with_runtime.gte']);
  if (!Number.isNaN(minRuntime) && minRuntime >= 0 && minRuntime <= 500) {
    params['with_runtime.gte'] = minRuntime;
  }
  const maxRuntime = Number(query['with_runtime.lte']);
  if (!Number.isNaN(maxRuntime) && maxRuntime >= 0 && maxRuntime <= 500) {
    params['with_runtime.lte'] = maxRuntime;
  }

  return params;
}

function isTrailerOrTeaser(v) {
  return v?.site === 'YouTube' && Boolean(v?.key) && (v.type === 'Trailer' || v.type === 'Teaser');
}

function parseDurationSeconds(text) {
  if (!text || typeof text !== 'string') return null;
  const parts = text.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function pickBestYoutubeFromHtml(html, title, originalTitle) {
  const startMarker = 'var ytInitialData = ';
  const idx = html.indexOf(startMarker);
  if (idx !== -1) {
    const jsonStart = idx + startMarker.length;
    const endIdx = html.indexOf(';</script>', jsonStart);
    if (endIdx !== -1) {
      try {
        const data = JSON.parse(html.slice(jsonStart, endIdx));
        const sections =
          data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ||
          [];
        const candidates = [];
        for (const sec of sections) {
          const items = sec?.itemSectionRenderer?.contents || [];
          for (const entry of items) {
            const vr = entry?.videoRenderer;
            if (!vr?.videoId) continue;
            const navUrl = vr?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || '';
            if (navUrl.startsWith('/shorts')) continue;
            const vTitle = vr?.title?.runs?.map((r) => r.text).join('') || '';
            const secs = parseDurationSeconds(vr?.lengthText?.simpleText);
            if (secs !== null && (secs < 25 || secs > 420)) continue;
            candidates.push({ id: vr.videoId, title: vTitle });
          }
        }

        if (candidates.length > 0) {
          const tLower = (title || '').toLowerCase();
          const oLower = (originalTitle || '').toLowerCase();
          const ranked = candidates
            .map((c, pos) => {
              const lc = c.title.toLowerCase();
              let score = 10 - pos * 0.5;
              if (lc.includes('трейлер') || lc.includes('trailer') || lc.includes('teaser') || lc.includes('тизер')) {
                score += 12;
              }
              if (lc.includes('official') || lc.includes('официальный') || lc.includes('дублированный')) {
                score += 6;
              }
              if (tLower && lc.includes(tLower.slice(0, Math.min(8, tLower.length)))) {
                score += 6;
              } else if (oLower && lc.includes(oLower.slice(0, Math.min(8, oLower.length)))) {
                score += 5;
              }
              if (lc.includes('реакция') || lc.includes('разбор') || lc.includes('обзор') || lc.includes('reaction') || lc.includes('review')) {
                score -= 15;
              }
              return { ...c, score };
            })
            .sort((a, b) => b.score - a.score);
          if (ranked[0]?.id) return ranked[0].id;
        }
      } catch {
        // Если JSON не разобрался — переходим к запасному поиску по regex
      }
    }
  }
  const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
  return match?.[1] || null;
}

async function queryYoutubeTrailerId(title, originalTitle, year, isRu) {
  const searchTitle = isRu ? title || originalTitle : originalTitle || title;
  if (!searchTitle) return null;
  const suffix = isRu ? 'официальный трейлер' : 'official trailer';
  const q = `${searchTitle} ${year || ''} ${suffix}`.trim();
  const cacheKey = `yt_fallback:${q}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': isRu ? 'ru-RU,ru;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
        Cookie: 'CONSENT=YES+cb; SOCS=CAI',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const videoId = pickBestYoutubeFromHtml(html, title, originalTitle);
    if (!videoId) return null;

    const fallbackVideo = {
      id: `yt-fallback-${videoId}`,
      key: videoId,
      site: 'YouTube',
      type: 'Trailer',
      official: false,
      iso_639_1: isRu ? 'ru' : 'en',
      name: `${searchTitle} — ${isRu ? 'Трейлер' : 'Trailer'}`,
    };
    setCached(cacheKey, fallbackVideo, 1000 * 60 * 60);
    return fallbackVideo;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findYoutubeTrailerFallback(title, originalTitle, year, language) {
  const isRu = language === 'ru-RU';
  const primary = await queryYoutubeTrailerId(title, originalTitle, year, isRu);
  if (primary) return primary;
  if (isRu) {
    return queryYoutubeTrailerId(title, originalTitle, year, false);
  }
  return null;
}

async function enrichVideos(mediaType, id, data, language) {
  let existing = Array.isArray(data.videos?.results) ? data.videos.results : [];

  if (!existing.some(isTrailerOrTeaser)) {
    try {
      const allVideos = await fetchFromTmdb(`/${mediaType}/${id}/videos`, {});
      if (Array.isArray(allVideos?.results) && allVideos.results.length > 0) {
        const seenKeys = new Set(existing.map((v) => v.key));
        existing = [
          ...existing,
          ...allVideos.results.filter((v) => v.key && !seenKeys.has(v.key)),
        ];
      }
    } catch {
      // Ошибка дополнительного поиска видео не критична
    }
  }

  if (!existing.some(isTrailerOrTeaser)) {
    const title = data.title || data.name || '';
    const originalTitle = data.original_title || data.original_name || title;
    const year = (data.release_date || data.first_air_date || '').slice(0, 4);
    const ytFallback = await findYoutubeTrailerFallback(title, originalTitle, year, language);
    if (ytFallback) {
      existing = [ytFallback, ...existing];
    }
  }

  data.videos = { results: existing };
}

async function fetchPopularDirectors(language, page = 1) {
  const safePage = Math.max(1, Math.min(page, 10));
  const cacheKey = `directors:${language}:p${safePage}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [popMovies, topMovies] = await Promise.all([
    fetchFromTmdb('/movie/popular', { language, page: safePage }),
    fetchFromTmdb('/movie/top_rated', { language, page: safePage }),
  ]);

  const movieMap = new Map();
  for (const m of [
    ...(topMovies.results || []).slice(0, 10),
    ...(popMovies.results || []).slice(0, 10),
  ]) {
    if (m?.id && !movieMap.has(m.id)) {
      movieMap.set(m.id, { ...m, media_type: 'movie' });
    }
  }

  const sampleMovies = Array.from(movieMap.values()).slice(0, 18);
  const creditsResults = await Promise.allSettled(
    sampleMovies.map((m) => fetchFromTmdb(`/movie/${m.id}/credits`, { language }))
  );

  const directorsMap = new Map();
  creditsResults.forEach((result, idx) => {
    if (result.status !== 'fulfilled') return;
    const movie = sampleMovies[idx];
    const crew = result.value?.crew || [];
    for (const member of crew) {
      if (member.job !== 'Director' || !member.id) continue;
      if (!directorsMap.has(member.id)) {
        directorsMap.set(member.id, {
          id: member.id,
          name: member.name,
          profile_path: member.profile_path || null,
          known_for_department: 'Directing',
          popularity: member.popularity || 0,
          known_for: movie ? [movie] : [],
        });
      } else {
        const existing = directorsMap.get(member.id);
        if (movie && !existing.known_for.some((k) => k.id === movie.id)) {
          existing.known_for.push(movie);
        }
      }
    }
  });

  for (const director of directorsMap.values()) {
    director.known_for.sort(
      (a, b) => (b.vote_average || 0) - (a.vote_average || 0) || (b.popularity || 0) - (a.popularity || 0)
    );
    director.known_for = director.known_for.slice(0, 3);
  }

  const directors = Array.from(directorsMap.values()).sort(
    (a, b) => (b.popularity || 0) - (a.popularity || 0)
  );
  const payload = {
    page: safePage,
    results: directors,
    total_pages: 10,
    total_results: directors.length * 10,
  };
  setCached(cacheKey, payload);
  return payload;
}

// Главный обработчик всех маршрутов /api/* (локальный сервер и Vercel)
export async function handleApiRequest(req, res, parsedUrl) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are allowed.' });
    return;
  }

  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  // Проверка состояния сервера и наличия ключа TMDB
  if (pathname === '/api/health') {
    const key = getTmdbKey();
    sendJson(res, 200, {
      ok: true,
      tmdbConfigured: Boolean(key && key !== 'MY_TMDB_API_KEY'),
    });
    return;
  }

  if (!pathname.startsWith('/api/tmdb/')) {
    sendJson(res, 404, { error: 'API_ROUTE_NOT_FOUND', message: 'Endpoint not allowed.' });
    return;
  }

  if (isRateLimited(req)) {
    sendJson(res, 429, {
      error: 'RATE_LIMIT',
      message: 'Too many requests. Please wait a moment and try again.',
    });
    return;
  }

  const segments = pathname.replace(/^\/api\/tmdb\//, '').split('/').filter(Boolean);

  try {
    // Тренды за день или неделю
    if (segments[0] === 'trending' && segments.length === 3) {
      const [, mediaType, timeWindow] = segments;
      if (!['movie', 'tv', 'all'].includes(mediaType) || !['day', 'week'].includes(timeWindow)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid trending parameters.' });
        return;
      }
      const data = await fetchFromTmdb(`/trending/${mediaType}/${timeWindow}`, {
        language: sanitizeLanguage(query.language),
        page: sanitizePage(query.page),
      });
      sendJson(res, 200, data);
      return;
    }

    // Подборки фильмов по категориям
    if (segments[0] === 'movies' && segments.length === 2) {
      const category = segments[1];
      if (!['popular', 'top_rated', 'upcoming', 'now_playing'].includes(category)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid movie category.' });
        return;
      }
      const data = await fetchFromTmdb(`/movie/${category}`, {
        language: sanitizeLanguage(query.language),
        page: sanitizePage(query.page),
      });
      sendJson(res, 200, data);
      return;
    }

    // Подборки сериалов по категориям
    if (segments[0] === 'series' && segments.length === 2) {
      const category = segments[1];
      if (!['popular', 'top_rated', 'airing_today', 'on_the_air'].includes(category)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid series category.' });
        return;
      }
      const data = await fetchFromTmdb(`/tv/${category}`, {
        language: sanitizeLanguage(query.language),
        page: sanitizePage(query.page),
      });
      sendJson(res, 200, data);
      return;
    }

    // Расширенный фильтр (Discover)
    if (segments[0] === 'discover' && segments.length === 2) {
      const mediaType = segments[1];
      if (!['movie', 'tv'].includes(mediaType)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid media type.' });
        return;
      }
      const data = await fetchFromTmdb(`/discover/${mediaType}`, buildDiscoverParams(query));
      sendJson(res, 200, data);
      return;
    }

    // Поиск по фильмам, сериалам и персонам
    if (segments[0] === 'search' && segments.length === 2) {
      const type = segments[1];
      if (!['multi', 'movie', 'tv', 'person'].includes(type)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid search type.' });
        return;
      }
      const rawQuery = typeof query.query === 'string' ? query.query.trim() : '';
      if (!rawQuery || rawQuery.length > 120) {
        sendJson(res, 400, {
          error: 'INVALID_PARAMS',
          message: 'Query must be between 1 and 120 characters.',
        });
        return;
      }
      const data = await fetchFromTmdb(`/search/${type}`, {
        query: rawQuery,
        language: sanitizeLanguage(query.language),
        page: sanitizePage(query.page),
        include_adult: 'false',
      });
      sendJson(res, 200, data);
      return;
    }

    // Карточка конкретного фильма
    if (segments[0] === 'movie' && segments.length === 2) {
      const id = segments[1];
      if (!POSITIVE_INT_RE.test(id)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid movie ID.' });
        return;
      }
      const language = sanitizeLanguage(query.language);
      const data = await fetchFromTmdb(`/movie/${id}`, {
        language,
        append_to_response: 'credits,videos,watch/providers,recommendations,similar,release_dates',
        include_video_language: `${language.slice(0, 2)},en,null`,
      });

      if (language === 'ru-RU' && (!data.overview || String(data.overview).trim() === '')) {
        try {
          const enData = await fetchFromTmdb(`/movie/${id}`, { language: 'en-US' });
          if (enData.overview) {
            data.overview = enData.overview;
            data._overviewFallbackEn = true;
          }
        } catch {
          // Пропускаем ошибку запасного перевода
        }
      }
      await enrichVideos('movie', id, data, language);
      sendJson(res, 200, data);
      return;
    }

    // Карточка конкретного сериала
    if (segments[0] === 'tv' && segments.length === 2) {
      const id = segments[1];
      if (!POSITIVE_INT_RE.test(id)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid series ID.' });
        return;
      }
      const language = sanitizeLanguage(query.language);
      const data = await fetchFromTmdb(`/tv/${id}`, {
        language,
        append_to_response: 'credits,videos,watch/providers,recommendations,similar,content_ratings',
        include_video_language: `${language.slice(0, 2)},en,null`,
      });

      if (language === 'ru-RU' && (!data.overview || String(data.overview).trim() === '')) {
        try {
          const enData = await fetchFromTmdb(`/tv/${id}`, { language: 'en-US' });
          if (enData.overview) {
            data.overview = enData.overview;
            data._overviewFallbackEn = true;
          }
        } catch {
          // Пропускаем ошибку запасного перевода
        }
      }
      await enrichVideos('tv', id, data, language);
      sendJson(res, 200, data);
      return;
    }

    // Популярные актёры
    if (segments[0] === 'person' && segments[1] === 'popular' && segments.length === 2) {
      const data = await fetchFromTmdb('/person/popular', {
        language: sanitizeLanguage(query.language),
        page: sanitizePage(query.page),
      });
      sendJson(res, 200, data);
      return;
    }

    // Популярные режиссёры
    if (segments[0] === 'person' && segments[1] === 'directors' && segments.length === 2) {
      const data = await fetchPopularDirectors(
        sanitizeLanguage(query.language),
        sanitizePage(query.page)
      );
      sendJson(res, 200, data);
      return;
    }

    // Подробная информация о персоне
    if (segments[0] === 'person' && segments.length === 2) {
      const id = segments[1];
      if (!POSITIVE_INT_RE.test(id)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid person ID.' });
        return;
      }
      const language = sanitizeLanguage(query.language);
      const data = await fetchFromTmdb(`/person/${id}`, {
        language,
        append_to_response: 'combined_credits',
      });

      if (language === 'ru-RU' && (!data.biography || String(data.biography).trim() === '')) {
        try {
          const enData = await fetchFromTmdb(`/person/${id}`, { language: 'en-US' });
          if (enData.biography) {
            data.biography = enData.biography;
            data._bioFallbackEn = true;
          }
        } catch {
          // Пропускаем ошибку запасного перевода
        }
      }
      sendJson(res, 200, data);
      return;
    }

    // Список жанров
    if (segments[0] === 'genres' && segments.length === 2) {
      const mediaType = segments[1];
      if (!['movie', 'tv'].includes(mediaType)) {
        sendJson(res, 400, { error: 'INVALID_PARAMS', message: 'Invalid media type.' });
        return;
      }
      const data = await fetchFromTmdb(`/genre/${mediaType}/list`, {
        language: sanitizeLanguage(query.language),
      });
      sendJson(res, 200, data);
      return;
    }

    // Список стран
    if (segments[0] === 'countries' && segments.length === 1) {
      const data = await fetchFromTmdb('/configuration/countries', {});
      sendJson(res, 200, data);
      return;
    }

    sendJson(res, 404, { error: 'API_ROUTE_NOT_FOUND', message: 'Endpoint not allowed.' });
  } catch (error) {
    sendTmdbError(res, error);
  }
}
