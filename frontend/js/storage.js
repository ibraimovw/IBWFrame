const STORAGE_KEY = 'ibwframe_user_data_v1';
const SESSION_KEY = 'ibwframe_session_v1';

const DEFAULT_DATA = {
  profile: {
    name: '',
    onboarded: false
  },
  preferences: {
    lang: null,
    theme: 'dark',
    watchRegion: ''
  },
  watchlist: [],     // [{ id, media_type, title, poster_path, vote_average, release_date, genre_ids }]
  watched: [],       // same structure
  favorites: [],     // same structure
  ratings: {},       // { "movie_550": 9 }
  collections: []    // [{ id, title, description, items: [] }]
};

function safeParse(raw, fallback) {
  if (!raw) return structuredClone(fallback);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(fallback),
      ...parsed,
      profile: { ...fallback.profile, ...(parsed.profile || {}) },
      preferences: { ...fallback.preferences, ...(parsed.preferences || {}) }
    };
  } catch {
    return structuredClone(fallback);
  }
}

export function getStore() {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY), DEFAULT_DATA);
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

export function saveStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('localStorage write failed:', err);
  }
}

export function updateStore(updater) {
  const current = getStore();
  const next = updater(current) || current;
  saveStore(next);
  return next;
}

export function isInList(listName, id, mediaType) {
  const store = getStore();
  return (store[listName] || []).some((item) => item.id === Number(id) && item.media_type === mediaType);
}

export function toggleMediaInList(listName, mediaItem) {
  let added = false;
  updateStore((store) => {
    const list = store[listName] || [];
    const idx = list.findIndex((i) => i.id === Number(mediaItem.id) && i.media_type === mediaItem.media_type);
    if (idx >= 0) {
      list.splice(idx, 1);
      added = false;
    } else {
      list.unshift({
        id: Number(mediaItem.id),
        media_type: mediaItem.media_type,
        title: mediaItem.title || mediaItem.name || 'Untitled',
        poster_path: mediaItem.poster_path || null,
        vote_average: mediaItem.vote_average || 0,
        release_date: mediaItem.release_date || mediaItem.first_air_date || '',
        genre_ids: mediaItem.genre_ids || (mediaItem.genres ? mediaItem.genres.map((g) => g.id) : [])
      });
      added = true;
    }
    store[listName] = list;
    return store;
  });
  return added;
}

export function setMediaRating(mediaType, id, score) {
  const key = `${mediaType}_${id}`;
  updateStore((store) => {
    if (!score) {
      delete store.ratings[key];
    } else {
      store.ratings[key] = Number(score);
    }
    return store;
  });
}

export function getMediaRating(mediaType, id) {
  const store = getStore();
  return store.ratings[`${mediaType}_${id}`] || 0;
}

// SessionStorage для временных фильтров и последнего поискового запроса
export function getSessionState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setSessionState(patch) {
  try {
    const current = getSessionState();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // ignore
  }
}
