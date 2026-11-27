// Клиентские функции для запросов к нашему API-прокси
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/';

export class ApiError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function getImageUrl(path, size = 'w500') {
  if (!path) return null;
  return `${TMDB_IMG_BASE}${size}${path}`;
}

export function getMediaTitle(item) {
  return item?.title || item?.name || item?.original_title || item?.original_name || 'Untitled';
}

export function getMediaYear(item) {
  const dateStr = item?.release_date || item?.first_air_date;
  if (!dateStr || typeof dateStr !== 'string') return '';
  return dateStr.slice(0, 4);
}

export function getMediaType(item, fallback = 'movie') {
  if (item?.mediaType === 'tv' || item?.media_type === 'tv') return 'tv';
  if (item?.mediaType === 'movie' || item?.media_type === 'movie') return 'movie';
  if (item?.first_air_date && !item?.release_date && item?.name && !item?.title) return 'tv';
  return fallback;
}

// Приводим объект фильма или сериала к единому виду для сохранения в браузере
export function toLibraryItem(item, explicitType) {
  const type = explicitType || getMediaType(item);
  let genreIds = [];

  if (Array.isArray(item.genre_ids)) {
    genreIds = item.genre_ids;
  } else if (Array.isArray(item.genres)) {
    genreIds = item.genres.map((g) => g.id);
  }

  return {
    id: item.id,
    mediaType: type,
    title: getMediaTitle(item),
    poster_path: item.poster_path ?? null,
    release_date: item.release_date || item.first_air_date || '',
    vote_average: typeof item.vote_average === 'number' ? item.vote_average : 0,
    genre_ids: genreIds,
  };
}

function toTmdbLang(lang) {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

async function requestJson(url, signal) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('OFFLINE', 'No internet connection.', 0);
  }

  let response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError('BACKEND_ERROR', 'Unable to reach server.', 0);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code = payload?.error || 'TMDB_ERROR';
    const message = payload?.message || `HTTP ${response.status}`;
    if (code === 'TMDB_NOT_CONFIGURED') {
      throw new ApiError('TMDB_NOT_CONFIGURED', message, response.status);
    }
    if (code === 'RATE_LIMIT' || response.status === 429) {
      throw new ApiError('RATE_LIMIT', message, 429);
    }
    if (code === 'NOT_FOUND' || response.status === 404) {
      throw new ApiError('NOT_FOUND', message, 404);
    }
    throw new ApiError('BACKEND_ERROR', message, response.status);
  }

  return payload;
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      search.set(key, String(val));
    }
  }
  return search.toString();
}

export const tmdbApi = {
  getTrending(mediaType, timeWindow, lang, page = 1, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang), page });
    return requestJson(`/api/tmdb/trending/${mediaType}/${timeWindow}?${qs}`, signal);
  },

  getMoviesCategory(category, lang, page = 1, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang), page });
    return requestJson(`/api/tmdb/movies/${category}?${qs}`, signal);
  },

  getSeriesCategory(category, lang, page = 1, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang), page });
    return requestJson(`/api/tmdb/series/${category}?${qs}`, signal);
  },

  discover(mediaType, params, lang, signal) {
    const qs = buildQuery({ ...params, language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/discover/${mediaType}?${qs}`, signal);
  },

  search(type, query, lang, page = 1, signal) {
    const qs = buildQuery({ query, language: toTmdbLang(lang), page });
    return requestJson(`/api/tmdb/search/${type}?${qs}`, signal);
  },

  getMovieDetail(id, lang, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/movie/${id}?${qs}`, signal);
  },

  getSeriesDetail(id, lang, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/tv/${id}?${qs}`, signal);
  },

  getPopularPeople(lang, page = 1, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang), page });
    return requestJson(`/api/tmdb/person/popular?${qs}`, signal);
  },

  getDirectors(lang, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/person/directors?${qs}`, signal);
  },

  getPersonDetail(id, lang, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/person/${id}?${qs}`, signal);
  },

  getGenres(mediaType, lang, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/genres/${mediaType}?${qs}`, signal);
  },
};

export function getYoutubeSearchUrl(title, year = '', lang = 'en') {
  const suffix = lang === 'ru' ? 'официальный трейлер' : 'official trailer';
  const q = `${title || ''} ${year || ''} ${suffix}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function pickByType(list) {
  if (!list || list.length === 0) return null;
  return (
    list.find((v) => v.type === 'Trailer' && v.official) ||
    list.find((v) => v.type === 'Trailer') ||
    list.find((v) => v.type === 'Teaser' && v.official) ||
    list.find((v) => v.type === 'Teaser') ||
    null
  );
}

export function pickOfficialTrailer(videos, lang = 'en') {
  if (!videos || videos.length === 0) return null;
  const trailers = videos.filter(
    (v) =>
      v.site === 'YouTube' &&
      Boolean(v.key) &&
      (v.type === 'Trailer' || v.type === 'Teaser')
  );
  if (trailers.length === 0) return null;

  const targetLang = lang === 'ru' ? 'ru' : 'en';
  const langTrailers = trailers.filter(
    (v) => (v.iso_639_1 || '').toLowerCase() === targetLang && v.type === 'Trailer'
  );
  if (langTrailers.length > 0) return pickByType(langTrailers);

  const enTrailers = trailers.filter(
    (v) => (v.iso_639_1 || '').toLowerCase() === 'en' && v.type === 'Trailer'
  );
  if (enTrailers.length > 0) return pickByType(enTrailers);

  const anyTrailers = trailers.filter((v) => v.type === 'Trailer');
  if (anyTrailers.length > 0) return pickByType(anyTrailers);

  const langTeasers = trailers.filter(
    (v) => (v.iso_639_1 || '').toLowerCase() === targetLang
  );
  if (langTeasers.length > 0) return pickByType(langTeasers);

  const enTeasers = trailers.filter((v) => (v.iso_639_1 || '').toLowerCase() === 'en');
  if (enTeasers.length > 0) return pickByType(enTeasers);

  return pickByType(trailers);
}
