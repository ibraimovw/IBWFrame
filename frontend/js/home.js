import { getImageUrl, getMediaTitle, getMediaYear, pickOfficialTrailer, tmdbApi } from './api.js';
import { EDITORIAL_COLLECTIONS } from './editorial.js';
import { icons } from './icons.js';
import { fetchPersonalizedRecommendations } from './recommendations.js';
import { ensureGenresLoaded, state, t } from './store.js';
import {
  createErrorState,
  createMediaRail,
  escapeHtml,
  navigateTo,
  openTrailerModal,
} from './ui.js';

function getGreeting(dict) {
  const hour = new Date().getHours();
  if (hour < 12) return dict.welcome.morning;
  if (hour < 18) return dict.welcome.afternoon;
  return dict.welcome.evening;
}

export function renderHomePage(container, signal) {
  const dict = t();
  const displayName = state.profile.name || dict.welcome.guestName;

  container.innerHTML = `
    <div class="container page-stack page-enter">
      <section class="welcome-banner">
        <div>
          <h1 class="welcome-title">
            ${escapeHtml(getGreeting(dict))}, <span class="welcome-name">${escapeHtml(displayName)}</span>
          </h1>
          <p class="page-subtitle">${escapeHtml(dict.welcome.subtitle)}</p>
        </div>
      </section>

      <div id="home-body" style="display:flex;flex-direction:column;gap:40px;">
        <div class="skeleton-box" style="height:420px;border-radius:20px;"></div>
      </div>
    </div>
  `;

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
      const spotlight = popMovies.find((m) => Boolean(m.backdrop_path)) || popMovies[0] || null;
      const trendingItems = (trendingRes.results || []).filter(
        (item) => item.media_type === 'movie' || item.media_type === 'tv'
      );

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
        // Keep home rendering if recommendations fail
      }

      if (signal.aborted) return;
      bodyEl.innerHTML = '';

      // 1. Featured Movie Spotlight (single film, no slider)
      if (spotlight) {
        const heroEl = document.createElement('section');
        heroEl.className = 'hero-spotlight';
        const backdropUrl = getImageUrl(spotlight.backdrop_path, 'w1280');
        const title = getMediaTitle(spotlight);
        const year = getMediaYear(spotlight);
        const rating = spotlight.vote_average > 0 ? spotlight.vote_average.toFixed(1) : null;

        heroEl.innerHTML = `
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
        `;

        heroEl.querySelector('[data-hero-details]')?.addEventListener('click', () => {
          navigateTo(`/movie/${spotlight.id}`);
        });

        const trailerBtn = heroEl.querySelector('[data-hero-trailer]');
        trailerBtn?.addEventListener('click', async () => {
          trailerBtn.disabled = true;
          try {
            const detail = await tmdbApi.getMovieDetail(spotlight.id, state.lang);
            const trailer = pickOfficialTrailer(detail.videos?.results);
            if (trailer?.key) {
              openTrailerModal({ youtubeKey: trailer.key, title });
            } else {
              navigateTo(`/movie/${spotlight.id}`);
            }
          } catch {
            navigateTo(`/movie/${spotlight.id}`);
          } finally {
            trailerBtn.disabled = false;
          }
        });

        bodyEl.appendChild(heroEl);
      }

      // 2. Trending Now
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.trendingNow,
          items: trendingItems,
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=trending'),
        })
      );

      // 3. Popular Movies
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.popularMovies,
          items: popMovies,
          explicitType: 'movie',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=popular'),
        })
      );

      // 4. Top Rated
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.topRated,
          items: topRatedRes.results || [],
          explicitType: 'movie',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=top_rated'),
        })
      );

      // 5. Upcoming
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.upcoming,
          items: upcomingRes.results || [],
          explicitType: 'movie',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/movies?tab=upcoming'),
        })
      );

      // 6. Popular Series
      bodyEl.appendChild(
        createMediaRail({
          title: dict.home.popularSeries,
          items: popularSeriesRes.results || [],
          explicitType: 'tv',
          actionLabel: dict.home.seeAll,
          onAction: () => navigateTo('/series?tab=popular'),
        })
      );

      // 7. Browse by Genres
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

      // 8. Editor's Choice
      const editorsSection = document.createElement('section');
      editorsSection.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">${escapeHtml(dict.home.editorsChoice)}</h2>
          <button type="button" class="section-link" data-all-collections>
            <span>${escapeHtml(dict.home.seeAll)}</span>
            ${icons.arrowRight}
          </button>
        </div>
        <div class="cards-grid-3"></div>
      `;
      editorsSection.querySelector('[data-all-collections]')?.addEventListener('click', () => {
        navigateTo('/collections');
      });
      const edGrid = editorsSection.querySelector('.cards-grid-3');
      for (const col of EDITORIAL_COLLECTIONS.slice(0, 3)) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `editorial-card ${col.toneClass}`;
        card.innerHTML = `
          <div>
            <h3 class="editorial-card-title">${escapeHtml(state.lang === 'ru' ? col.titleRu : col.titleEn)}</h3>
            <p class="editorial-card-desc">${escapeHtml(state.lang === 'ru' ? col.descRu : col.descEn)}</p>
          </div>
          <div class="editorial-card-cta">
            <span>${escapeHtml(dict.home.seeAll)}</span>
            ${icons.arrowRight}
          </div>
        `;
        card.addEventListener('click', () => navigateTo(`/collections/${col.slug}`));
        edGrid.appendChild(card);
      }
      bodyEl.appendChild(editorsSection);

      // 9. Recommended for You
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
