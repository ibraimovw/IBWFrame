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

export function toLibraryItem(item, explicitType) {
  const type = explicitType || getMediaType(item);
  return {
    id: item.id,
    mediaType: type,
    title: item.title || item.name || item.original_title || item.original_name || 'Untitled',
    poster_path: item.poster_path ?? null,
    release_date: item.release_date || item.first_air_date || '',
    vote_average: typeof item.vote_average === 'number' ? item.vote_average : 0,
    genre_ids: Array.isArray(item.genre_ids)
      ? item.genre_ids
      : Array.isArray(item.genres)
        ? item.genres.map((g) => g.id)
        : [],
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

  getPersonDetail(id, lang, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/person/${id}?${qs}`, signal);
  },

  getGenres(mediaType, lang, signal) {
    const qs = buildQuery({ language: toTmdbLang(lang) });
    return requestJson(`/api/tmdb/genres/${mediaType}?${qs}`, signal);
  },
};

export function pickOfficialTrailer(videos) {
  if (!videos || videos.length === 0) return null;
  const yt = videos.filter((v) => v.site === 'YouTube' && Boolean(v.key));
  if (yt.length === 0) return null;

  return (
    yt.find((v) => v.type === 'Trailer' && v.official) ||
    yt.find((v) => v.type === 'Trailer') ||
    yt.find((v) => v.type === 'Teaser') ||
    yt[0]
  );
}
