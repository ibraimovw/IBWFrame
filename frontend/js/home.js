import { fetchTmdb, getGenreMap, getImageUrl } from './api.js';
import { getStore } from './storage.js';
import { t } from './i18n.js';
import { renderMediaCard, renderSkeletonGrid, escapeHtml, openTrailerModal } from './ui.js';

const EDITORIAL_SETS = [
  { id: 'scifi', titleEn: 'Best Sci-Fi Worlds', titleRu: 'Лучшая научная фантастика', descEn: 'Visionary futures and space odysseys.', descRu: 'Визионерские миры и космические одиссеи.' },
  { id: 'thrillers', titleEn: 'Greatest Thrillers', titleRu: 'Культовые триллеры', descEn: 'High-tension stories with unforgettable twists.', descRu: 'Напряжённые сюжеты с неожиданными развязками.' },
  { id: 'hidden-gems', titleEn: 'Hidden Gems', titleRu: 'Скрытые жемчужины', descEn: 'Critically acclaimed cinema off the beaten path.', descRu: 'Высоко оценённое кино вне мейнстрима.' },
  { id: 'action', titleEn: 'Action Classics', titleRu: 'Классика экшена', descEn: 'Adrenaline-charged cinema milestones.', descRu: 'Эталонные боевики с высоким рейтингом.' }
];

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.welcomeMorning';
  if (hour < 18) return 'home.welcomeAfternoon';
  return 'home.welcomeEvening';
}

export async function renderHomePage(container) {
  const store = getStore();
  const userName = store.profile.name || 'Guest';
  const isRu = document.documentElement.lang === 'ru';

  container.innerHTML = `
    <div class="container">
      <div class="welcome-strip">
        <p class="welcome-text">
          ${t(getGreetingKey())}, <strong>${escapeHtml(userName)}</strong>. ${t('home.welcomeSub')}
        </p>
      </div>
      <div id="home-hero-slot"></div>
      <div id="home-sections-slot">${renderSkeletonGrid(10)}</div>
    </div>
  `;

  try {
    const [movieGenres, tvGenres, trending, popularMovies, topRated, upcoming, popularSeries] = await Promise.all([
      getGenreMap('movie'),
      getGenreMap('tv'),
      fetchTmdb('/trending/movie/week'),
      fetchTmdb('/movie/popular'),
      fetchTmdb('/movie/top_rated'),
      fetchTmdb('/movie/upcoming'),
      fetchTmdb('/tv/popular')
    ]);

    const featured = (trending.results || [])[0] || (popularMovies.results || [])[0];
    if (featured) {
      const backdrop = getImageUrl(featured.backdrop_path || featured.poster_path, 'w1280');
      const year = (featured.release_date || '').slice(0, 4);
      const rating = featured.vote_average ? featured.vote_average.toFixed(1) : 'NR';

      document.getElementById('home-hero-slot').innerHTML = `
        <section class="hero-featured" style="background-image: url('${backdrop}')">
          <div class="hero-content">
            <span class="hero-kicker">${t('home.featured')}</span>
            <h1 class="hero-title">${escapeHtml(featured.title)}</h1>
            <div class="hero-meta">
              <span>★ ${rating}</span>
              <span>•</span>
              <span>${year}</span>
            </div>
            <p class="hero-overview">${escapeHtml(featured.overview || '')}</p>
            <div class="hero-actions">
              <button type="button" class="btn btn-primary" id="hero-trailer-btn">▶ ${t('home.watchTrailer')}</button>
              <a href="/movie/${featured.id}" data-link class="btn btn-secondary">${t('home.moreDetails')}</a>
            </div>
          </div>
        </section>
      `;

      document.getElementById('hero-trailer-btn')?.addEventListener('click', () => {
        openTrailerModal('movie', featured.id);
      });
    }

    // Персональные рекомендации на основе просмотренного/избранного/оценок
    const userHistory = [...store.watched, ...store.favorites, ...store.watchlist];
    let recommendedItems = [];
    if (userHistory.length > 0) {
      const genreCounts = {};
      userHistory.forEach((item) => {
        (item.genre_ids || []).forEach((gid) => {
          genreCounts[gid] = (genreCounts[gid] || 0) + 1;
        });
      });
      const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const recRes = await fetchTmdb('/discover/movie', {
        with_genres: topGenre || '',
        'vote_average.gte': 7.2,
        'vote_count.gte': 300,
        sort_by: 'popularity.desc'
      });
      const seenIds = new Set(userHistory.map((i) => i.id));
      recommendedItems = (recRes.results || []).filter((m) => !seenIds.has(m.id)).slice(0, 10);
    } else {
      recommendedItems = (topRated.results || []).slice(0, 10);
    }

    const renderRail = (titleKey, linkHref, items, gMap, type = 'movie') => `
      <section class="section-block">
        <div class="section-header">
          <h2 class="section-title">${t(titleKey)}</h2>
          ${linkHref ? `<a href="${linkHref}" data-link class="section-link">→</a>` : ''}
        </div>
        <div class="media-rail">
          ${items.slice(0, 12).map((item) => renderMediaCard(item, gMap, type)).join('')}
        </div>
      </section>
    `;

    const genrePillsHtml = Object.entries(movieGenres).slice(0, 14).map(([id, name]) => `
      <a href="/movies?genre=${id}" data-link class="genre-pill">${escapeHtml(name)}</a>
    `).join('');

    const editorialHtml = EDITORIAL_SETS.map((col) => `
      <a href="/collections?preset=${col.id}" data-link class="editorial-card">
        <div>
          <h3>${escapeHtml(isRu ? col.titleRu : col.titleEn)}</h3>
          <p>${escapeHtml(isRu ? col.descRu : col.descEn)}</p>
        </div>
        <span class="section-link">→</span>
      </a>
    `).join('');

    document.getElementById('home-sections-slot').innerHTML = `
      ${renderRail('home.trending', '/movies?tab=trending', trending.results || [], movieGenres, 'movie')}
      ${renderRail('home.popularMovies', '/movies?tab=popular', popularMovies.results || [], movieGenres, 'movie')}
      ${renderRail('home.topRated', '/movies?tab=top_rated', topRated.results || [], movieGenres, 'movie')}
      ${renderRail('home.upcoming', '/movies?tab=upcoming', upcoming.results || [], movieGenres, 'movie')}
      ${renderRail('home.popularSeries', '/series?tab=popular', popularSeries.results || [], tvGenres, 'tv')}

      <section class="section-block">
        <div class="section-header">
          <h2 class="section-title">${t('home.browseGenres')}</h2>
        </div>
        <div class="genre-pills">${genrePillsHtml}</div>
      </section>

      <section class="section-block">
        <div class="section-header">
          <h2 class="section-title">${t('home.editorsChoice')}</h2>
          <a href="/collections" data-link class="section-link">→</a>
        </div>
        <div class="editorial-grid">${editorialHtml}</div>
      </section>

      ${renderRail('home.recommended', '/explore', recommendedItems, movieGenres, 'movie')}
    `;
  } catch (err) {
    document.getElementById('home-sections-slot').innerHTML = `
      <div class="state-box">
        <h2>${t('error.title')}</h2>
        <p>${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-primary" onclick="location.reload()">${t('error.retry')}</button>
      </div>
    `;
  }
}
