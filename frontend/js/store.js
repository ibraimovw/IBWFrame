import { tmdbApi, toLibraryItem } from './api.js';
import { detectInitialLang, getT, setDocumentLang } from './i18n.js';
import {
  loadCollections,
  loadFavorites,
  loadProfile,
  loadRatings,
  loadWatched,
  loadWatchlist,
  loadWatchRegion,
  mediaKey,
  saveCollections,
  saveFavorites,
  saveProfile,
  saveRatings,
  saveWatched,
  saveWatchlist,
  saveWatchRegion,
} from './storage.js';
import { applyTheme, getInitialTheme } from './theme.js';

const subscribers = new Set();
let toastHandler = null;

export const state = {
  lang: detectInitialLang(),
  theme: getInitialTheme(),
  profile: loadProfile(),
  watchRegion: loadWatchRegion(),
  watchlist: loadWatchlist(),
  watched: loadWatched(),
  favorites: loadFavorites(),
  ratings: loadRatings(),
  customCollections: loadCollections(),
  movieGenres: [],
  tvGenres: [],
  genresLangLoaded: null,
};

setDocumentLang(state.lang);
applyTheme(state.theme);

export function t() {
  return getT(state.lang);
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify(reason = 'state') {
  for (const fn of subscribers) {
    fn(state, reason);
  }
}

export function registerToastHandler(fn) {
  toastHandler = fn;
}

export function notifyToast(message) {
  if (toastHandler) toastHandler(message);
}

export async function ensureGenresLoaded(signal) {
  if (state.genresLangLoaded === state.lang && state.movieGenres.length > 0) {
    return;
  }
  try {
    const [mRes, tvRes] = await Promise.all([
      tmdbApi.getGenres('movie', state.lang, signal),
      tmdbApi.getGenres('tv', state.lang, signal),
    ]);
    state.movieGenres = mRes.genres || [];
    state.tvGenres = tvRes.genres || [];
    state.genresLangLoaded = state.lang;
  } catch {
    // Genres will remain empty cleanly until TMDB responds
  }
}

export function getGenreName(genreId) {
  return (
    state.movieGenres.find((g) => g.id === genreId)?.name ||
    state.tvGenres.find((g) => g.id === genreId)?.name ||
    ''
  );
}

export function setLang(nextLang) {
  if (nextLang !== 'en' && nextLang !== 'ru') return;
  if (state.lang === nextLang) return;
  state.lang = nextLang;
  state.genresLangLoaded = null;
  setDocumentLang(nextLang);
  notify('lang');
}

export function setTheme(nextTheme) {
  state.theme = applyTheme(nextTheme);
  notify('theme');
}

export function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
}

export function updateProfile(next) {
  state.profile = { ...state.profile, ...next };
  saveProfile(state.profile);
  notify('profile');
}

export function setWatchRegion(region) {
  state.watchRegion = region;
  saveWatchRegion(region);
  notify('region');
}

export function isInWatchlist(id, type) {
  return state.watchlist.some((i) => i.id === id && i.mediaType === type);
}

export function isWatched(id, type) {
  return state.watched.some((i) => i.id === id && i.mediaType === type);
}

export function isFavorite(id, type) {
  return state.favorites.some((i) => i.id === id && i.mediaType === type);
}

export function getUserRating(id, type) {
  return state.ratings[mediaKey(id, type)]?.score ?? null;
}

export function toggleWatchlist(rawItem, explicitType) {
  const item = toLibraryItem(rawItem, explicitType);
  const exists = isInWatchlist(item.id, item.mediaType);
  state.watchlist = exists
    ? state.watchlist.filter((i) => !(i.id === item.id && i.mediaType === item.mediaType))
    : [item, ...state.watchlist];
  saveWatchlist(state.watchlist);
  notifyToast(exists ? t().actions.watchlistRemoved : t().actions.watchlistAdded);
  notify('library');
}

export function toggleWatched(rawItem, explicitType) {
  const item = toLibraryItem(rawItem, explicitType);
  const exists = isWatched(item.id, item.mediaType);
  state.watched = exists
    ? state.watched.filter((i) => !(i.id === item.id && i.mediaType === item.mediaType))
    : [item, ...state.watched];
  saveWatched(state.watched);
  notifyToast(exists ? t().actions.watchedRemoved : t().actions.watchedAdded);
  notify('library');
}

export function toggleFavorite(rawItem, explicitType) {
  const item = toLibraryItem(rawItem, explicitType);
  const exists = isFavorite(item.id, item.mediaType);
  state.favorites = exists
    ? state.favorites.filter((i) => !(i.id === item.id && i.mediaType === item.mediaType))
    : [item, ...state.favorites];
  saveFavorites(state.favorites);
  notifyToast(exists ? t().actions.favoriteRemoved : t().actions.favoriteAdded);
  notify('library');
}

export function setRating(rawItem, score, explicitType) {
  const item = toLibraryItem(rawItem, explicitType);
  const key = mediaKey(item.id, item.mediaType);
  const next = { ...state.ratings };
  if (score === null) {
    delete next[key];
    notifyToast(t().actions.ratingRemoved);
  } else {
    next[key] = { score, updatedAt: Date.now(), item };
    notifyToast(`${t().actions.ratingSaved}: ${score}/10`);
  }
  state.ratings = next;
  saveRatings(state.ratings);
  notify('library');
}

export function createCollection(name, description = '') {
  const newCol = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    description: description.trim(),
    createdAt: Date.now(),
    items: [],
  };
  state.customCollections = [newCol, ...state.customCollections];
  saveCollections(state.customCollections);
  notifyToast(t().actions.collectionCreated);
  notify('library');
  return newCol;
}

export function deleteCollection(id) {
  state.customCollections = state.customCollections.filter((c) => c.id !== id);
  saveCollections(state.customCollections);
  notifyToast(t().actions.collectionDeleted);
  notify('library');
}

export function addToCollection(collectionId, rawItem, explicitType) {
  const item = toLibraryItem(rawItem, explicitType);
  let changed = false;
  state.customCollections = state.customCollections.map((c) => {
    if (c.id !== collectionId) return c;
    const exists = c.items.some((i) => i.id === item.id && i.mediaType === item.mediaType);
    if (exists) return c;
    changed = true;
    return { ...c, items: [item, ...c.items] };
  });
  if (changed) {
    saveCollections(state.customCollections);
    notifyToast(t().actions.addedToCollection);
    notify('library');
  }
}

export function removeFromCollection(collectionId, itemId, mediaType) {
  state.customCollections = state.customCollections.map((c) =>
    c.id === collectionId
      ? { ...c, items: c.items.filter((i) => !(i.id === itemId && i.mediaType === mediaType)) }
      : c
  );
  saveCollections(state.customCollections);
  notifyToast(t().actions.removedFromCollection);
  notify('library');
}
