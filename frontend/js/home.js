import {
  getImageUrl,
  getMediaTitle,
  getMediaYear,
  getYoutubeSearchUrl,
  pickOfficialTrailer,
  tmdbApi,
} from './api.js';
import { EDITORIAL_COLLECTIONS } from './editorial.js';
import { icons } from './icons.js';
import { fetchPersonalizedRecommendations } from './recommendations.js';
import { loadSpotlightHistory, saveSpotlightHistory } from './storage.js';
import { ensureGenresLoaded, state, t } from './store.js';
import {
  createErrorState,
  createMediaRail,
  escapeHtml,
  navigateTo,
  openTrailerModal,
} from './ui.js';

// Формирует ключ локальной даты вида ГГГГ-ММ-ДД
function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Разница в днях между двумя датами
function daysBetweenKeys(olderKey, newerKey) {
  const parseUtc = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parseUtc(newerKey) - parseUtc(olderKey)) / 86400000);
}

// Выбирает фильм дня на 24 часа без повторов чаще одного раза в 14 дней
async function resolveDailySpotlight({ pool, lang, signal }) {
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const todayKey = getLocalDateKey();
  const saved = loadSpotlightHistory();
  const recentHistory = (saved.history || []).filter((entry) => {
    const diff = daysBetweenKeys(entry.date, todayKey);
    return diff >= 0 && diff < 14;
  });

  if (saved.current && saved.current.date === todayKey) {
    const inPool = pool.find((m) => m.id === saved.current.id);
    if (inPool) return inPool;
    try {
      const fetched = await tmdbApi.getMovieDetail(saved.current.id, lang, signal);
      if (fetched && fetched.id && fetched.backdrop_path) {
        return fetched;
      }
    } catch {
      // Если фильм не загрузился, ниже выберем другой вариант
    }
  }

  const recentIds = new Set(recentHistory.map((h) => h.id));
  const eligible = pool.filter((m) => !recentIds.has(m.id));
  const candidates = eligible.length > 0 ? eligible : pool;
  const dateSeed = Number(todayKey.replace(/-/g, '')) || 1;
  const sliceLen = Math.min(candidates.length, 15);
  const chosen = candidates[dateSeed % sliceLen] || candidates[0];

  if (chosen) {
    const nextHistory = [
      { date: todayKey, id: chosen.id },
      ...recentHistory.filter((h) => h.date !== todayKey && h.id !== chosen.id),
    ].slice(0, 20);
    saveSpotlightHistory({
      current: { date: todayKey, id: chosen.id },
      history: nextHistory,
    });
  }

  return chosen || null;
}

// Определяет время суток по локальному часу пользователя
function getTimePeriod() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

function getGreeting(dict, period) {
  return dict.welcome[period] || dict.welcome.evening;
}

function getPhraseSequence(dict, period) {
  const timeList = dict.welcome.phrases?.[period] || [];
  const generalList = dict.welcome.phrases?.general || [];
  const combined = [...timeList, ...generalList].filter(Boolean);
  return combined.length > 0 ? combined : [dict.welcome.subtitle];
}

// Форматирует локальное время пользователя для блока приветствия
function getBrowserTimeLabel(lang) {
  try {
    return new Date().toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// Отрисовка главной страницы
export function renderHomePage(container, signal) {
  const dict = t();
  const displayName = state.profile.name || dict.welcome.guestName;
  const period = getTimePeriod();
  const phrases = getPhraseSequence(dict, period);
  let phraseIdx = Math.floor(Math.random() * phrases.length);
  const localTimeLabel = getBrowserTimeLabel(state.lang);

  container.innerHTML = `
    <div class="container page-stack page-enter">
      <section class="welcome-banner">
        <div>
          <h1 class="welcome-title">
            ${escapeHtml(getGreeting(dict, period))}, <span class="welcome-name">${escapeHtml(displayName)}</span>
          </h1>
          <p class="page-subtitle welcome-phrase" data-welcome-phrase>${escapeHtml(phrases[phraseIdx])}</p>
        </div>
        ${
          localTimeLabel
            ? `<div class="welcome-time-badge tabular-nums">${icons.clock}<span data-clock-time>${escapeHtml(localTimeLabel)}</span></div>`
            : ''
        }
      </section>

      <div id="home-body" style="display:flex;flex-direction:column;gap:40px;">
        <div class="skeleton-box" style="height:420px;border-radius:20px;"></div>
      </div>
    </div>
  `;

  const clockEl = container.querySelector('[data-clock-time]');
  if (clockEl) {
    const clockTimer = window.setInterval(() => {
      if (signal.aborted || !clockEl.isConnected) {
        window.clearInterval(clockTimer);
        return;
      }
      const next = getBrowserTimeLabel(state.lang);
      if (next) clockEl.textContent = next;
    }, 15000);
    signal.addEventListener('abort', () => window.clearInterval(clockTimer));
  }

  const phraseEl = container.querySelector('[data-welcome-phrase]');
  if (phraseEl && phrases.length > 1) {
    const intervalId = window.setInterval(() => {
      if (signal.aborted || !phraseEl.isConnected) {
        window.clearInterval(intervalId);
        return;
      }
      phraseEl.classList.add('is-switching');
      window.setTimeout(() => {
        if (signal.aborted || !phraseEl.isConnected) return;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        phraseEl.textContent = phrases[phraseIdx];
        phraseEl.classList.remove('is-switching');
      }, 260);
    }, 5200);

    signal.addEventListener('abort', () => window.clearInterval(intervalId));
  }

  const bodyEl = container.querySelector('#home-body');

  async function load() {
    bodyEl.innerHTML = `
      <div class="skeleton-box" style="height:420px;border-radius:20px;"></div>
    `;
    await ensureGenresLoaded(signal);

    try {
      const [trendingRes, popularMoviesRes, topRatedRes, upcomingRes, popularSeriesRes] =
        await Promise.all([
          tmdbApi.getTrending('all', 'day', state.lang, 1, signal),
          tmdbApi.getMoviesCategory('popular', state.lang, 1, signal),
          tmdbApi.getMoviesCategory('top_rated', state.lang, 1, signal),
          tmdbApi.getMoviesCategory('upcoming', state.lang, 1, signal),
          tmdbApi.getSeriesCategory('popular', state.lang, 1, signal),
        ]);

      if (signal.aborted) return;

      const popMovies = popularMoviesRes.results || [];
      const trendingItems = (trendingRes.results || []).filter(
        (item) => item.media_type === 'movie' || item.media_type === 'tv'
      );

      const spotlightPoolMap = new Map();
      for (const item of [
        ...trendingItems.filter((item) => item.media_type === 'movie'),
        ...popMovies,
        ...(topRatedRes.results || []),
      ]) {
        if (item && item.id && item.backdrop_path && !spotlightPoolMap.has(item.id)) {
          spotlightPoolMap.set(item.id, item);
        }
      }
      const spotlightPool = Array.from(spotlightPoolMap.values());
      const spotlight =
        (await resolveDailySpotlight({ pool: spotlightPool, lang: state.lang, signal })) ||
        popMovies.find((m) => Boolean(m.backdrop_path)) ||
        popMovies[0] ||
        null;

      let recs = { items: [], personalized: false };
      try {
        recs = await fetchPersonalizedRecommendations({
          watched: state.watched,
          favorites: state.favorites,
          ratings: state.ratings,
          lang: state.lang,
          signal,
        });
      } catch {
        // Главная страница продолжает работу, даже если рекомендации не загрузились
      }

      if (signal.aborted) return;
      bodyEl.innerHTML = '';

      // 1. Главный фильм дня с мягким двуслойным свечением от постера
      if (spotlight) {
        const heroShell = document.createElement('div');
        heroShell.className = 'hero-spotlight-shell';

        const backdropUrl = getImageUrl(spotlight.backdrop_path, 'w1280');
        const posterUrl = getImageUrl(spotlight.poster_path, 'w500');
        const shadowImgUrl = backdropUrl || posterUrl;
        const bloomImgUrl = posterUrl || backdropUrl;
        const title = getMediaTitle(spotlight);
        const year = getMediaYear(spotlight);
        const rating = spotlight.vote_average > 0 ? spotlight.vote_average.toFixed(1) : null;

        heroShell.innerHTML = `
          ${
            shadowImgUrl
              ? `<img src="${escapeHtml(shadowImgUrl)}" alt="" aria-hidden="true" referrerpolicy="no-referrer" class="hero-ambient-shadow" />`
              : ''
          }
          ${
            bloomImgUrl
              ? `<img src="${escapeHtml(bloomImgUrl)}" alt="" aria-hidden="true" referrerpolicy="no-referrer" class="hero-ambient-bloom" />`
              : ''
          }
          <section class="hero-spotlight">
            ${
              backdropUrl
                ? `<img src="${escapeHtml(backdropUrl)}" alt="${escapeHtml(title)}" referrerpolicy="no-referrer" class="hero-backdrop-img" />`
                : ''
            }
            <div class="hero-gradient"></div>
            <div class="hero-content">
              <div class="hero-kicker">${escapeHtml(dict.home.featuredBadge)}</div>
              <h2 class="hero-title">${escapeHtml(title)}</h2>
              <div class="hero-meta tabular-nums">
                ${year ? `<span>${escapeHtml(year)}</span>` : ''}
                ${
                  rating
                    ? `<span class="hero-rating">${icons.star}<span>${rating}</span></span>`
                    : ''
                }
              </div>
              ${spotlight.overview ? `<p class="hero-overview">${escapeHtml(spotlight.overview)}</p>` : ''}
              <div class="hero-actions">
                <button type="button" class="btn btn-primary" data-hero-trailer>
                  ${icons.play}
                  <span>${escapeHtml(dict.home.watchTrailer)}</span>
                </button>
                <button type="button" class="btn btn-hero-glass" data-hero-details>
                  ${icons.info}
                  <span>${escapeHtml(dict.home.moreDetails)}</span>
                </button>
              </div>
            </div>
          </section>
        `;

        heroShell.querySelector('[data-hero-details]')?.addEventListener('click', () => {
          navigateTo(`/movie/${spotlight.id}`);
        });

        const trailerBtn = heroShell.querySelector('[data-hero-trailer]');
        trailerBtn?.addEventListener('click', async () => {
          trailerBtn.disabled = true;
          const ytSearchUrl = getYoutubeSearchUrl(title, year, state.lang);
          try {
            const detail = await tmdbApi.getMovieDetail(spotlight.id, state.lang);
            const trailer = pickOfficialTrailer(detail.videos?.results, state.lang);
            openTrailerModal({
              youtubeKey: trailer?.key || null,
              title,
              youtubeSearchUrl: ytSearchUrl,
            });
          } catch {
            openTrailerModal({
              youtubeKey: null,
              title,
              youtubeSearchUrl: ytSearchUrl,
            });
          } finally {
            trailerBtn.disabled = false;
          }
        });

        bodyEl.appendChild(heroShell);
      }

      // 2. В тренде сейчас
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.trendingNow,
          items: trendingItems,
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=trending'),
        })
      );

      // 3. Популярные фильмы
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.popularMovies,
          items: popMovies,
          explicitType: 'movie',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=popular'),
        })
      );

      // 4. Высокий рейтинг
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.topRated,
          items: topRatedRes.results || [],
          explicitType: 'movie',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=top_rated'),
        })
      );

      // 5. Скоро в кино
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.upcoming,
          items: upcomingRes.results || [],
          explicitType: 'movie',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=upcoming'),
        })
      );

      // 6. Популярные сериалы
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.popularSeries,
          items: popularSeriesRes.results || [],
          explicitType: 'tv',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/series?tab=popular'),
        })
      );

      // 7. Быстрый переход по жанрам
      if (state.movieGenres.length > 0) {
        const genreSection = document.createElement('section');
        genreSection.innerHTML = `
          <div class="section-header">
            <h2 class="section-title">${escapeHtml(dict.home.browseByGenres)}</h2>
            <button type="button" class="section-link" data-browse-explore>
              <span>${escapeHtml(dict.nav.explore)}</span>
              ${icons.arrowRight}
            </button>
          </div>
          <div class="genre-tiles-grid"></div>
        `;
        genreSection.querySelector('[data-browse-explore]')?.addEventListener('click', () => {
          navigateTo('/explore');
        });
        const grid = genreSection.querySelector('.genre-tiles-grid');
        for (const g of state.movieGenres.slice(0, 10)) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'genre-tile';
          btn.innerHTML = `<span>${escapeHtml(g.name)}</span>${icons.arrowRight}`;
          btn.addEventListener('click', () => navigateTo(`/movies?tab=all&genre=${g.id}`));
          grid.appendChild(btn);
        }
        bodyEl.appendChild(genreSection);
      }

      // 8. Выбор редакции (компактные карточки с мини-постерами)
      const featuredCollections = EDITORIAL_COLLECTIONS.slice(0, 3);
      const editorsSection = document.createElement('section');
      editorsSection.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">${escapeHtml(dict.home.editorsChoice)}</h2>
          <button type="button" class="section-link" data-all-collections>
            <span>${escapeHtml(dict.home.seeAll)}</span>
            ${icons.arrowRight}
          </button>
        </div>
        <div class="editorial-compact-grid"></div>
      `;
      editorsSection.querySelector('[data-all-collections]')?.addEventListener('click', () => {
        navigateTo('/collections');
      });
      const edGrid = editorsSection.querySelector('.editorial-compact-grid');
      for (const col of featuredCollections) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'editorial-card-compact';
        card.setAttribute('data-ed-slug', col.slug);
        card.innerHTML = `
          <div class="editorial-poster-fan" data-fan>
            <div class="editorial-mini-poster pos-0"></div>
            <div class="editorial-mini-poster pos-1"></div>
            <div class="editorial-mini-poster pos-2"></div>
          </div>
          <div class="editorial-compact-body">
            <span class="editorial-compact-tag">${escapeHtml(dict.home.curatedTag)}</span>
            <h3 class="editorial-compact-title">${escapeHtml(state.lang === 'ru' ? col.titleRu : col.titleEn)}</h3>
            <p class="editorial-compact-desc">${escapeHtml(state.lang === 'ru' ? col.descRu : col.descEn)}</p>
          </div>
          <span class="editorial-compact-arrow">${icons.arrowRight}</span>
        `;
        card.addEventListener('click', () => navigateTo(`/collections/${col.slug}`));
        edGrid.appendChild(card);
      }
      bodyEl.appendChild(editorsSection);

      Promise.allSettled(
        featuredCollections.map((col) =>
          tmdbApi.discover('movie', col.discoverParams, state.lang, signal)
        )
      ).then((results) => {
        if (signal.aborted) return;
        results.forEach((res, idx) => {
          if (res.status !== 'fulfilled') return;
          const col = featuredCollections[idx];
          const fanEl = edGrid.querySelector(`[data-ed-slug="${col.slug}"] [data-fan]`);
          if (!fanEl) return;
          const moviesWithPosters = (res.value?.results || []).filter((m) => Boolean(m.poster_path)).slice(0, 3);
          const slots = fanEl.querySelectorAll('.editorial-mini-poster');
          moviesWithPosters.forEach((m, slotIdx) => {
            const url = getImageUrl(m.poster_path, 'w185');
            if (url && slots[slotIdx]) {
              slots[slotIdx].innerHTML = `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`;
            }
          });
        });
      });

      // 9. Персональные рекомендации
      if (recs.items.length > 0) {
        bodyEl.appendChild(
          createMediaRail({
            title: dict.home.recommendedForYou,
            subtitle: recs.personalized
              ? dict.home.recommendedSubtitlePersonalized
              : dict.home.recommendedSubtitleDefault,
            items: recs.items,
            explicitType: 'movie',
          })
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      bodyEl.innerHTML = '';
      bodyEl.appendChild(createErrorState(err, load));
    }
  }

  load();
}
