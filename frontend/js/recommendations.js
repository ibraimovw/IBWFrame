import { tmdbApi } from './api.js';

// Вычисляем до 3 любимых жанров по просмотрам, избранному и оценкам
export function deriveFavoriteGenreIds({ watched, favorites, ratings }) {
  const weights = new Map();

  for (const item of watched) {
    for (const g of item.genre_ids || []) {
      weights.set(g, (weights.get(g) || 0) + 1);
    }
  }

  for (const item of favorites) {
    for (const g of item.genre_ids || []) {
      weights.set(g, (weights.get(g) || 0) + 2);
    }
  }

  for (const entry of Object.values(ratings)) {
    if (entry.score >= 7) {
      const boost = entry.score >= 9 ? 3 : 2;
      for (const g of entry.item.genre_ids || []) {
        weights.set(g, (weights.get(g) || 0) + boost);
      }
    }
  }

  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genreId]) => genreId);
}

// Загружаем персональные рекомендации или популярную подборку
export async function fetchPersonalizedRecommendations({
  watched,
  favorites,
  ratings,
  lang,
  signal,
}) {
  const topGenres = deriveFavoriteGenreIds({ watched, favorites, ratings });
  const excludeIds = new Set([
    ...watched.map((i) => i.id),
    ...favorites.map((i) => i.id),
  ]);

  if (topGenres.length > 0) {
    const res = await tmdbApi.discover(
      'movie',
      {
        with_genres: topGenres.join('|'),
        sort_by: 'vote_average.desc',
        'vote_count.gte': 1200,
        'vote_average.gte': 7.2,
      },
      lang,
      signal
    );
    const filtered = (res.results || []).filter((m) => !excludeIds.has(m.id));
    if (filtered.length >= 6) {
      return { items: filtered.slice(0, 14), personalized: true };
    }
  }

  const fallbackRes = await tmdbApi.getMoviesCategory('top_rated', lang, 1, signal);
  return {
    items: (fallbackRes.results || []).filter((m) => !excludeIds.has(m.id)).slice(0, 14),
    personalized: topGenres.length > 0,
  };
}
