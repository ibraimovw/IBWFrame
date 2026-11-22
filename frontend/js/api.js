import { getTmdbLang } from './i18n.js';

const IMG_BASE = 'https://image.tmdb.org/t/p';
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export function getImageUrl(path, size = 'w500', fallback = '/assets/poster-fallback.svg') {
  if (!path) return fallback;
  return `${IMG_BASE}/${size}${path}`;
}

export async function fetchTmdb(endpoint, params = {}, options = {}) {
  const url = new URL(`/api/tmdb${endpoint}`, window.location.origin);
  const lang = params.language || getTmdbLang();
  url.searchParams.set('language', lang);

  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  });

  const cacheKey = url.toString();
  if (!options.noCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.time < CACHE_TTL) {
      return cached.data;
    }
  }

  const res = await fetch(url.toString(), { signal: options.signal });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error) message = errJson.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const data = await res.json();
  if (!options.noCache) {
    cache.set(cacheKey, { time: Date.now(), data });
  }
  return data;
}

// Запрос с автоматическим фолбэком на английский при пустом overview
export async function fetchTmdbWithFallback(endpoint, params = {}) {
  const primary = await fetchTmdb(endpoint, params);
  if (getTmdbLang() === 'ru-RU' && (!primary.overview && !primary.biography)) {
    const enData = await fetchTmdb(endpoint, { ...params, language: 'en-US' });
    return {
      ...primary,
      overview: primary.overview || enData.overview || '',
      biography: primary.biography || enData.biography || ''
    };
  }
  return primary;
}

let genreCache = {};
export async function getGenreMap(type = 'movie') {
  const lang = getTmdbLang();
  const key = `${type}_${lang}`;
  if (genreCache[key]) return genreCache[key];
  const data = await fetchTmdb(`/genre/${type}/list`, { language: lang });
  const map = {};
  (data.genres || []).forEach((g) => { map[g.id] = g.name; });
  genreCache[key] = map;
  return map;
}
