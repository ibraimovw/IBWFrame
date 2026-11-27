// Работа с localStorage и sessionStorage браузера
const STORAGE_KEYS = {
  profile: 'ibwframe_profile_v1',
  lang: 'ibwframe_lang_v1',
  theme: 'ibwframe_theme_v1',
  watchlist: 'ibwframe_watchlist_v1',
  watched: 'ibwframe_watched_v1',
  favorites: 'ibwframe_favorites_v1',
  ratings: 'ibwframe_ratings_v1',
  collections: 'ibwframe_collections_v1',
  watchRegion: 'ibwframe_watch_region_v1',
  lastSearch: 'ibwframe_last_search_v1',
  catalogFiltersPrefix: 'ibwframe_filters_',
  spotlightHistory: 'ibwframe_spotlight_history_v1',
};

function safeReadJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Игнорируем ошибку, если память браузера заполнена или отключена
  }
}

export function detectDefaultWatchRegion() {
  try {
    const lang = (navigator.language || 'en-US').trim();
    const parts = lang.split(/[-_]/);
    if (parts.length > 1 && /^[A-Za-z]{2}$/.test(parts[1])) {
      return parts[1].toUpperCase();
    }
    if (lang.toLowerCase().startsWith('ru')) return 'RU';
    return 'US';
  } catch {
    return 'US';
  }
}

function isValidMediaItem(x) {
  return (
    x &&
    typeof x === 'object' &&
    typeof x.id === 'number' &&
    (x.mediaType === 'movie' || x.mediaType === 'tv') &&
    typeof x.title === 'string'
  );
}

function loadMediaList(key) {
  const raw = safeReadJson(window.localStorage, key, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidMediaItem);
}

export function loadProfile() {
  const raw = safeReadJson(window.localStorage, STORAGE_KEYS.profile, null);
  if (!raw || typeof raw !== 'object') {
    return { name: '', onboarded: false };
  }
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 48) : '',
    onboarded: Boolean(raw.onboarded),
  };
}

export function saveProfile(profile) {
  safeWriteJson(window.localStorage, STORAGE_KEYS.profile, profile);
}

export function loadStoredLang() {
  try {
    const val = window.localStorage.getItem(STORAGE_KEYS.lang);
    if (val === 'en' || val === 'ru') return val;
    return null;
  } catch {
    return null;
  }
}

export function saveLang(lang) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.lang, lang);
  } catch {
    // Игнорируем ошибку записи
  }
}

export function loadStoredTheme() {
  try {
    const val = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (val === 'dark' || val === 'light') return val;
    return null;
  } catch {
    return null;
  }
}

export function saveTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {
    // Игнорируем ошибку записи
  }
}

export function loadWatchRegion() {
  try {
    const val = window.localStorage.getItem(STORAGE_KEYS.watchRegion);
    if (val && /^[A-Z]{2}$/.test(val)) return val;
    return detectDefaultWatchRegion();
  } catch {
    return detectDefaultWatchRegion();
  }
}

export function saveWatchRegion(region) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.watchRegion, region);
  } catch {
    // Игнорируем ошибку записи
  }
}

export function loadWatchlist() {
  return loadMediaList(STORAGE_KEYS.watchlist);
}

export function saveWatchlist(items) {
  safeWriteJson(window.localStorage, STORAGE_KEYS.watchlist, items);
}

export function loadWatched() {
  return loadMediaList(STORAGE_KEYS.watched);
}

export function saveWatched(items) {
  safeWriteJson(window.localStorage, STORAGE_KEYS.watched, items);
}

export function loadFavorites() {
  return loadMediaList(STORAGE_KEYS.favorites);
}

export function saveFavorites(items) {
  safeWriteJson(window.localStorage, STORAGE_KEYS.favorites, items);
}

export function loadRatings() {
  const raw = safeReadJson(window.localStorage, STORAGE_KEYS.ratings, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cleaned = {};
  for (const [k, v] of Object.entries(raw)) {
    if (
      v &&
      typeof v === 'object' &&
      typeof v.score === 'number' &&
      v.score >= 1 &&
      v.score <= 10 &&
      isValidMediaItem(v.item)
    ) {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

export function saveRatings(ratings) {
  safeWriteJson(window.localStorage, STORAGE_KEYS.ratings, ratings);
}

export function loadCollections() {
  const raw = safeReadJson(window.localStorage, STORAGE_KEYS.collections, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: typeof c.description === 'string' ? c.description : '',
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
      items: Array.isArray(c.items) ? c.items.filter(isValidMediaItem) : [],
    }));
}

export function saveCollections(collections) {
  safeWriteJson(window.localStorage, STORAGE_KEYS.collections, collections);
}

export function loadLastSearch() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.lastSearch) || '';
  } catch {
    return '';
  }
}

export function saveLastSearch(query) {
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.lastSearch, query);
  } catch {
    // Игнорируем ошибку записи
  }
}

export function loadCatalogState(mediaType, fallback) {
  const raw = safeReadJson(
    window.sessionStorage,
    `${STORAGE_KEYS.catalogFiltersPrefix}${mediaType}`,
    null
  );
  if (!raw || typeof raw !== 'object') return fallback;
  return { ...fallback, ...raw };
}

export function saveCatalogState(mediaType, state) {
  safeWriteJson(
    window.sessionStorage,
    `${STORAGE_KEYS.catalogFiltersPrefix}${mediaType}`,
    state
  );
}

export function loadSpotlightHistory() {
  const raw = safeReadJson(window.localStorage, STORAGE_KEYS.spotlightHistory, null);
  if (!raw || typeof raw !== 'object') {
    return { current: null, history: [] };
  }
  const isEntry = (e) =>
    e &&
    typeof e === 'object' &&
    typeof e.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    typeof e.id === 'number';
  return {
    current: isEntry(raw.current) ? raw.current : null,
    history: Array.isArray(raw.history) ? raw.history.filter(isEntry) : [],
  };
}

export function saveSpotlightHistory(record) {
  safeWriteJson(window.localStorage, STORAGE_KEYS.spotlightHistory, record);
}

export function mediaKey(id, mediaType) {
  return `${mediaType}-${id}`;
}
