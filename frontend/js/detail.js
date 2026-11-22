import {
  getImageUrl,
  getMediaTitle,
  getMediaYear,
  getYoutubeSearchUrl,
  pickOfficialTrailer,
  tmdbApi,
} from './api.js';
import { WATCH_REGIONS } from './editorial.js';
import { translateJob, translateStatus } from './i18n.js';
import { icons } from './icons.js';
import {
  getUserRating,
  isFavorite,
  isInWatchlist,
  isWatched,
  setRating,
  setWatchRegion,
  state,
  t,
  toggleFavorite,
  toggleWatched,
  toggleWatchlist,
} from './store.js';
import {
  createErrorState,
  createMediaRail,
  escapeHtml,
  navigateTo,
  openCollectionPickerModal,
  openTrailerModal,
} from './ui.js';

function getCertification(detail, isMovie) {
  if (isMovie && detail.release_dates?.results) {
    const pick =
      detail.release_dates.results.find((r) => r.iso_3166_1 === 'US') ||
      detail.release_dates.results[0];
    const cert = pick?.release_dates?.find((d) => d.certification)?.certification;
    return cert || null;
  }
  if (!isMovie && detail.content_ratings?.results) {
    const pick =
      detail.content_ratings.results.find((r) => r.iso_3166_1 === 'US') ||
      detail.content_ratings.results[0];
    return pick?.rating || null;
  }
  return null;
}

export function renderDetailPage(container, mediaType, id, outerSignal) {
  const dict = t();
  const isMovie = mediaType === 'movie';

  container.innerHTML = `
    <div class="container page-stack">
      <div class="skeleton-box" style="height:360px;border-radius:20px;"></div>
    </div>
  `;

  async function load() {
    try {
      const detail = isMovie
        ? await tmdbApi.getMovieDetail(id, state.lang, outerSignal)
        : await tmdbApi.getSeriesDetail(id, state.lang, outerSignal);

      if (outerSignal.aborted) return;

      const title = getMediaTitle(detail);
      const originalTitle = detail.original_title || detail.original_name || '';
      const year = getMediaYear(detail);
      const cert = getCertification(detail, isMovie);
      const rating = detail.vote_average > 0 ? detail.vote_average.toFixed(1) : null;
      const runtime = detail.runtime || detail.episode_run_time?.[0] || null;
      const countries = (detail.production_countries || []).map((c) => c.name).filter(Boolean);
      const posterUrl = getImageUrl(detail.poster_path, 'w500');
      const backdropUrl = getImageUrl(detail.backdrop_path, 'w1280');
      const officialTrailer = pickOfficialTrailer(detail.videos?.results, state.lang);
      const ytSearchUrl = getYoutubeSearchUrl(title || originalTitle, year, state.lang);

      const cast = (detail.credits?.cast || []).slice(0, 12);
      const director = isMovie
        ? detail.credits?.crew?.find((c) => c.job === 'Director')
        : detail.created_by?.[0] || detail.credits?.crew?.find((c) => c.job === 'Director');
      const keyCrew = (detail.credits?.crew || [])
        .filter((c) => ['Director', 'Writer', 'Screenplay', 'Director of Photography'].includes(c.job))
        .slice(0, 4);

      const recItems = (detail.recommendations?.results || []).slice(0, 14);
      const recIds = new Set(recItems.map((r) => r.id));
      const simItems = (detail.similar?.results || [])
        .filter((s) => !recIds.has(s.id))
        .slice(0, 14);

      const renderHeroAndBody = () => {
        const inWatchlist = isInWatchlist(detail.id, mediaType);
        const watched = isWatched(detail.id, mediaType);
        const fav = isFavorite(detail.id, mediaType);
        const userScore = getUserRating(detail.id, mediaType);

        const regionData = detail['watch/providers']?.results?.[state.watchRegion] || null;
        const providerGroups = [
          { label: dict.detail.stream, list: regionData?.flatrate || [] },
          { label: dict.detail.free, list: regionData?.free || [] },
          { label: dict.detail.rent, list: regionData?.rent || [] },
          { label: dict.detail.buy, list: regionData?.buy || [] },
        ].filter((g) => g.list.length > 0);

        container.innerHTML = `
          <div class="page-enter">
            <section class="detail-hero">
              ${
                backdropUrl
                  ? `<div class="detail-backdrop"><img src="${escapeHtml(backdropUrl)}" alt="" referrerpolicy="no-referrer" /></div>`
                  : ''
              }
              <div class="detail-backdrop-fade"></div>

              <div class="container detail-hero-inner">
                <button type="button" class="btn btn-ghost" data-back style="height:32px;padding:0 10px;font-size:0.8rem;">
                  ${icons.arrowLeft}
                  <span>${escapeHtml(dict.detail.back)}</span>
                </button>

                <div class="detail-layout">
                  <div class="detail-poster">
                    ${
                      posterUrl
                        ? `<img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}" referrerpolicy="no-referrer" />`
                        : `<div class="media-poster-fallback">${icons.film}<span>${escapeHtml(title)}</span></div>`
                    }
                  </div>

                  <div class="detail-info">
                    <div class="detail-type-row">
                      <span>${escapeHtml(isMovie ? dict.detail.movieType : dict.detail.seriesType)}</span>
                      ${cert ? `<span class="cert-badge">${escapeHtml(cert)}</span>` : ''}
                    </div>

                    <h1 class="detail-title">${escapeHtml(title)}</h1>
                    ${
                      originalTitle && originalTitle !== title
                        ? `<p class="detail-original-title">${escapeHtml(dict.detail.originalTitle)}: ${escapeHtml(originalTitle)}</p>`
                        : ''
                    }

                    <div class="detail-stats-row tabular-nums">
                      ${
                        rating
                          ? `<span style="display:inline-flex;align-items:center;gap:5px;font-weight:800;color:var(--text-primary);">${icons.star} ${rating}</span>`
                          : ''
                      }
                      ${year ? `<span>${escapeHtml(year)}</span>` : ''}
                      ${runtime ? `<span>${runtime} ${escapeHtml(dict.detail.minutes)}</span>` : ''}
                      ${countries.length ? `<span>${escapeHtml(countries.slice(0, 2).join(', '))}</span>` : ''}
                    </div>

                    ${
                      detail.genres?.length
                        ? `<div class="detail-genres-row">
                            ${detail.genres
                              .map(
                                (g) =>
                                  `<button type="button" class="genre-chip" data-genre-id="${g.id}">${escapeHtml(g.name)}</button>`
                              )
                              .join('')}
                          </div>`
                        : ''
                    }

                    <p class="detail-overview">${escapeHtml(detail.overview || dict.detail.noOverview)}</p>
                    ${
                      detail._overviewFallbackEn
                        ? `<p style="margin:6px 0 0;font-size:0.75rem;color:var(--text-muted);">${escapeHtml(dict.detail.overviewEnFallback)}</p>`
                        : ''
                    }

                    <div class="detail-actions-row">
                      ${
                        officialTrailer?.key
                          ? `<button type="button" class="btn btn-primary" data-watch-trailer>
                              ${icons.play}
                              <span>${escapeHtml(dict.detail.watchTrailer)}</span>
                            </button>
                            <a href="${escapeHtml(ytSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
                              ${icons.externalLink}
                              <span>YouTube</span>
                            </a>`
                          : `<a href="${escapeHtml(ytSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                              ${icons.play}
                              <span>${escapeHtml(dict.detail.findTrailerOnYoutube)}</span>
                              ${icons.externalLink}
                            </a>`
                      }

                      <button type="button" class="btn ${inWatchlist ? 'btn-active-soft' : 'btn-secondary'}" data-toggle-watchlist>
                        ${icons.bookmark}
                        <span>${escapeHtml(inWatchlist ? dict.detail.inWatchlist : dict.detail.addToWatchlist)}</span>
                      </button>

                      <button type="button" class="btn ${watched ? 'btn-active-soft' : 'btn-secondary'}" data-toggle-watched>
                        ${icons.check}
                        <span>${escapeHtml(watched ? dict.detail.watched : dict.detail.markWatched)}</span>
                      </button>

                      <button type="button" class="btn ${fav ? 'btn-active-soft' : 'btn-secondary'}" data-toggle-fav>
                        ${fav ? icons.heartFill : icons.heart}
                        <span>${escapeHtml(fav ? dict.detail.favorited : dict.detail.favorite)}</span>
                      </button>

                      <button type="button" class="btn btn-secondary" data-add-collection>
                        ${icons.plus}
                        <span>${escapeHtml(dict.detail.addToCollection)}</span>
                      </button>
                    </div>

                    <div class="rating-strip">
                      <span style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-right:4px;">${escapeHtml(dict.detail.yourRating)}:</span>
                      ${Array.from({ length: 10 }, (_, idx) => idx + 1)
                        .map(
                          (num) =>
                            `<button type="button" class="rating-num-btn ${userScore === num ? 'is-active' : ''}" data-rate="${num}">${num}</button>`
                        )
                        .join('')}
                      ${
                        userScore !== null
                          ? `<button type="button" class="btn btn-ghost" data-clear-rating style="height:28px;padding:0 8px;font-size:0.75rem;">${escapeHtml(dict.detail.clearRating)}</button>`
                          : ''
                      }
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div class="container page-stack">
              <div class="detail-body-grid">
                <div>
                  <h2 class="section-title" style="margin-bottom:16px;">${escapeHtml(dict.detail.castAndCrew)}</h2>
                  ${
                    director
                      ? `<p style="margin:0 0 16px;font-size:0.875rem;color:var(--text-muted);">
                          <strong>${escapeHtml(isMovie ? dict.detail.director : dict.detail.creator)}:</strong>
                          <button type="button" class="section-link" style="display:inline;font-size:0.875rem;" data-person-id="${director.id}">${escapeHtml(director.name)}</button>
                        </p>`
                      : ''
                    }
                  <div class="cast-grid">
                    ${cast
                      .map((person) => {
                        const photo = getImageUrl(person.profile_path, 'w185');
                        return `
                          <article class="person-mini-card" data-person-id="${person.id}" tabindex="0" role="link">
                            <div class="person-mini-photo">
                              ${
                                photo
                                  ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(person.name)}" loading="lazy" referrerpolicy="no-referrer" />`
                                  : icons.user
                              }
                            </div>
                            <div class="person-mini-body">
                              <div class="person-mini-name">${escapeHtml(person.name)}</div>
                              <div class="person-mini-role">${escapeHtml(person.character || '')}</div>
                            </div>
                          </article>
                        `;
                      })
                      .join('')}
                  </div>

                  ${
                    keyCrew.length
                      ? `<div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:12px 24px;">
                          ${keyCrew
                            .map(
                              (c) => `
                              <div>
                                <div class="info-row-label">${escapeHtml(translateJob(c.job, state.lang))}</div>
                                <button type="button" class="section-link" data-person-id="${c.id}" style="font-size:0.875rem;padding:2px 0;">${escapeHtml(c.name)}</button>
                              </div>
                            `
                            )
                            .join('')}
                        </div>`
                      : ''
                  }
                </div>

                <aside style="display:flex;flex-direction:column;gap:20px;">
                  <div class="info-box">
                    <h3 style="margin:0;font-size:1.05rem;font-weight:800;">${escapeHtml(dict.detail.detailsTitle)}</h3>
                    <div>
                      <div class="info-row-label">${escapeHtml(isMovie ? dict.detail.releaseDate : dict.detail.firstAirDate)}</div>
                      <div class="info-row-val tabular-nums">${escapeHtml(detail.release_date || detail.first_air_date || '—')}</div>
                    </div>
                    ${
                      detail.status
                        ? `<div><div class="info-row-label">${escapeHtml(dict.detail.status)}</div><div class="info-row-val">${escapeHtml(translateStatus(detail.status, state.lang))}</div></div>`
                        : ''
                    }
                    ${
                      !isMovie && detail.number_of_seasons
                        ? `<div><div class="info-row-label">${escapeHtml(dict.detail.seasons)} / ${escapeHtml(dict.detail.episodes)}</div><div class="info-row-val tabular-nums">${detail.number_of_seasons} / ${detail.number_of_episodes || '—'}</div></div>`
                        : ''
                    }
                    ${
                      isMovie && detail.budget > 0
                        ? `<div><div class="info-row-label">${escapeHtml(dict.detail.budget)}</div><div class="info-row-val tabular-nums">$${detail.budget.toLocaleString()}</div></div>`
                        : ''
                    }
                    ${
                      isMovie && detail.revenue > 0
                        ? `<div><div class="info-row-label">${escapeHtml(dict.detail.revenue)}</div><div class="info-row-val tabular-nums">$${detail.revenue.toLocaleString()}</div></div>`
                        : ''
                    }
                    ${
                      detail.production_companies?.length
                        ? `<div><div class="info-row-label">${escapeHtml(dict.detail.companies)}</div><div class="info-row-val">${escapeHtml(detail.production_companies.slice(0, 4).map((c) => c.name).join(', '))}</div></div>`
                        : ''
                    }
                  </div>

                  <div class="info-box">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                      <h3 style="margin:0;font-size:1.05rem;font-weight:800;">${escapeHtml(dict.detail.whereToWatch)}</h3>
                      <select id="watch-region-select" class="select-control" style="width:auto;height:32px;font-size:0.75rem;" aria-label="${escapeHtml(dict.detail.regionLabel)}">
                        ${WATCH_REGIONS.map(
                          (r) =>
                            `<option value="${r.code}" ${r.code === state.watchRegion ? 'selected' : ''}>${escapeHtml(
                              state.lang === 'ru' ? r.nameRu : r.nameEn
                            )}</option>`
                        ).join('')}
                      </select>
                    </div>

                    ${
                      providerGroups.length === 0
                        ? `<p style="margin:0;font-size:0.8125rem;color:var(--text-muted);line-height:1.5;">${escapeHtml(dict.detail.noWatchProviders)}</p>`
                        : providerGroups
                            .map(
                              (grp) => `
                              <div>
                                <div class="info-row-label">${escapeHtml(grp.label)}</div>
                                <div class="provider-list">
                                  ${grp.list
                                    .map((p) => {
                                      const pLogo = getImageUrl(p.logo_path, 'w185');
                                      return `
                                        <span class="provider-chip">
                                          ${pLogo ? `<img src="${escapeHtml(pLogo)}" alt="${escapeHtml(p.provider_name)}" referrerpolicy="no-referrer" />` : ''}
                                          <span>${escapeHtml(p.provider_name)}</span>
                                        </span>
                                      `;
                                    })
                                    .join('')}
                                </div>
                              </div>
                            `
                            )
                            .join('')
                    }

                    ${
                      regionData?.link
                        ? `<a href="${escapeHtml(regionData.link)}" target="_blank" rel="noopener noreferrer" class="section-link" style="font-size:0.78rem;">
                            <span>${escapeHtml(dict.detail.openOnTmdb)}</span>
                            ${icons.externalLink}
                          </a>`
                        : ''
                    }

                    <p style="margin:0;font-size:0.72rem;color:var(--text-subtle);line-height:1.45;">
                      ${escapeHtml(dict.detail.watchAttribution)}
                    </p>
                  </div>
                </aside>
              </div>

              <div id="detail-rails" style="display:flex;flex-direction:column;gap:36px;"></div>
            </div>
          </div>
        `;

        const railsEl = container.querySelector('#detail-rails');
        if (recItems.length > 0) {
          railsEl.appendChild(
            createMediaRail({
              title: dict.detail.recommended,
              items: recItems,
              explicitType: mediaType,
            })
          );
        }
        if (simItems.length > 0) {
          railsEl.appendChild(
            createMediaRail({
              title: dict.detail.similar,
              items: simItems,
              explicitType: mediaType,
            })
          );
        }

        container.querySelector('[data-back]')?.addEventListener('click', () => window.history.back());

        container.querySelector('[data-watch-trailer]')?.addEventListener('click', () => {
          openTrailerModal({
            youtubeKey: officialTrailer?.key || null,
            title,
            youtubeSearchUrl: ytSearchUrl,
          });
        });

        container.querySelector('[data-toggle-watchlist]')?.addEventListener('click', () => {
          toggleWatchlist(detail, mediaType);
          renderHeroAndBody();
        });

        container.querySelector('[data-toggle-watched]')?.addEventListener('click', () => {
          toggleWatched(detail, mediaType);
          renderHeroAndBody();
        });

        container.querySelector('[data-toggle-fav]')?.addEventListener('click', () => {
          toggleFavorite(detail, mediaType);
          renderHeroAndBody();
        });

        container.querySelector('[data-add-collection]')?.addEventListener('click', () => {
          openCollectionPickerModal({
            id: detail.id,
            mediaType,
            title,
            poster_path: detail.poster_path,
            release_date: detail.release_date || detail.first_air_date || '',
            vote_average: detail.vote_average || 0,
            genre_ids: (detail.genres || []).map((g) => g.id),
          });
        });

        container.querySelectorAll('[data-rate]').forEach((btn) => {
          btn.addEventListener('click', () => {
            setRating(detail, Number(btn.getAttribute('data-rate')), mediaType);
            renderHeroAndBody();
          });
        });

        container.querySelector('[data-clear-rating]')?.addEventListener('click', () => {
          setRating(detail, null, mediaType);
          renderHeroAndBody();
        });

        container.querySelectorAll('[data-genre-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const gid = btn.getAttribute('data-genre-id');
            navigateTo(`/${isMovie ? 'movies' : 'series'}?tab=all&genre=${gid}`);
          });
        });

        container.querySelectorAll('[data-person-id]').forEach((el) => {
          el.addEventListener('click', () => {
            navigateTo(`/person/${el.getAttribute('data-person-id')}`);
          });
        });

        container.querySelector('#watch-region-select')?.addEventListener('change', (e) => {
          setWatchRegion(e.target.value);
          renderHeroAndBody();
        });
      };

      renderHeroAndBody();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      container.innerHTML = '<div class="container page-stack" id="detail-err"></div>';
      container.querySelector('#detail-err')?.appendChild(createErrorState(err, load));
    }
  }

  load();
}
