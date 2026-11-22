import { fetchTmdb, fetchTmdbWithFallback, getGenreMap, getImageUrl } from './api.js';
import { getStore, updateStore, isInList, toggleMediaInList, getMediaRating, setMediaRating } from './storage.js';
import { t } from './i18n.js';
import { renderMediaCard, openTrailerModal, showToast, escapeHtml } from './ui.js';

export async function renderDetailsPage(container, mediaType, id) {
  const isMovie = mediaType === 'movie';
  container.innerHTML = `<div class="container" style="padding-top:40px;"><p>Loading...</p></div>`;

  try {
    const [item, credits, providersRes, similarRes, recRes, genreMap] = await Promise.all([
      fetchTmdbWithFallback(`/${mediaType}/${id}`),
      fetchTmdb(`/${mediaType}/${id}/credits`),
      fetchTmdb(`/${mediaType}/${id}/watch/providers`),
      fetchTmdb(`/${mediaType}/${id}/similar`),
      fetchTmdb(`/${mediaType}/${id}/recommendations`),
      getGenreMap(mediaType)
    ]);

    const title = item.title || item.name || 'Untitled';
    const originalTitle = item.original_title || item.original_name || '';
    const dateStr = item.release_date || item.first_air_date || '';
    const year = dateStr ? dateStr.slice(0, 4) : '—';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const runtime = isMovie
      ? (item.runtime ? `${item.runtime} min` : '')
      : (item.episode_run_time?.[0] ? `~${item.episode_run_time[0]} min` : '');
    const countries = (item.production_countries || []).map((c) => c.iso_3166_1).join(', ');
    const genres = (item.genres || []).map((g) => g.name).join(' • ');
    const studios = (item.production_companies || []).slice(0, 3).map((c) => c.name).join(', ');

    const backdrop = getImageUrl(item.backdrop_path || item.poster_path, 'w1280');
    const poster = getImageUrl(item.poster_path, 'w500');

    const inWatchlist = isInList('watchlist', item.id, mediaType);
    const inWatched = isInList('watched', item.id, mediaType);
    const inFav = isInList('favorites', item.id, mediaType);
    const userScore = getMediaRating(mediaType, item.id);

    // Определение региона для Where to Watch
    const store = getStore();
    const browserRegion = (navigator.language.split('-')[1] || 'US').toUpperCase();
    const selectedRegion = store.preferences.watchRegion || browserRegion;
    const allRegions = providersRes.results || {};
    const regionData = allRegions[selectedRegion] || allRegions.US || null;
    const providerList = [
      ...(regionData?.flatrate || []),
      ...(regionData?.rent || []),
      ...(regionData?.buy || [])
    ].filter((v, idx, arr) => arr.findIndex((x) => x.provider_id === v.provider_id) === idx);

    const directors = (credits.crew || []).filter((c) => c.job === 'Director');
    const cast = (credits.cast || []).slice(0, 12);

    // Исключаем дубли между Similar и Recommended
    const recItems = (recRes.results || []).slice(0, 8);
    const recIds = new Set(recItems.map((r) => r.id));
    const simItems = (similarRes.results || []).filter((s) => !recIds.has(s.id)).slice(0, 8);

    const mediaPayload = {
      id: item.id,
      media_type: mediaType,
      title,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: dateStr,
      genre_ids: (item.genres || []).map((g) => g.id)
    };

    container.innerHTML = `
      <section class="details-hero" style="background-image: url('${backdrop}')">
        <div class="container details-grid">
          <img class="details-poster" src="${poster}" alt="${escapeHtml(title)}"
               onerror="this.onerror=null;this.src='/assets/poster-fallback.svg';" />

          <div class="details-info">
            <h1>${escapeHtml(title)}</h1>
            ${originalTitle && originalTitle !== title ? `<div class="details-original">${escapeHtml(originalTitle)}</div>` : ''}

            <div class="details-facts">
              <span class="fact-pill" style="color:var(--rating-gold)">★ ${rating} TMDB</span>
              <span class="fact-pill">${year}</span>
              ${runtime ? `<span class="fact-pill">${runtime}</span>` : ''}
              ${countries ? `<span class="fact-pill">${escapeHtml(countries)}</span>` : ''}
              ${genres ? `<span class="fact-pill">${escapeHtml(genres)}</span>` : ''}
            </div>

            <p class="details-overview">${escapeHtml(item.overview || '')}</p>

            <div class="hero-actions">
              <button type="button" class="btn btn-primary" id="details-trailer-btn">▶ ${t('home.watchTrailer')}</button>
            </div>

            <div class="user-actions-bar">
              <button type="button" class="btn btn-secondary btn-sm ${inWatchlist ? 'btn-active' : ''}" id="act-watchlist">
                ${inWatchlist ? t('details.watchlistIn') : t('details.watchlistAdd')}
              </button>
              <button type="button" class="btn btn-secondary btn-sm ${inWatched ? 'btn-active' : ''}" id="act-watched">
                ${inWatched ? t('details.watchedIn') : t('details.watchedAdd')}
              </button>
              <button type="button" class="btn btn-secondary btn-sm ${inFav ? 'btn-active' : ''}" id="act-fav">
                ${inFav ? t('details.favIn') : t('details.favAdd')}
              </button>

              <select id="act-rate" class="rate-select" aria-label="${t('details.rate')}">
                <option value="0">${t('details.rate')}: ${t('details.noRating')}</option>
                ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `
                  <option value="${n}" ${userScore === n ? 'selected' : ''}>★ ${n} / 10</option>
                `).join('')}
              </select>
            </div>

            <div class="providers-box">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <strong>${t('details.whereToWatch')}</strong>
                <select id="watch-region-select" class="rate-select" style="height:32px;font-size:0.8rem;">
                  ${['US', 'GB', 'DE', 'FR', 'RU', 'KZ', 'KR', 'JP'].map((code) => `
                    <option value="${code}" ${selectedRegion === code ? 'selected' : ''}>Region: ${code}</option>
                  `).join('')}
                </select>
              </div>
              ${providerList.length
                ? `<div class="providers-list">
                    ${providerList.map((p) => `
                      <div class="provider-item">
                        <img src="${getImageUrl(p.logo_path, 'w92')}" alt="${escapeHtml(p.provider_name)}" />
                        <span>${escapeHtml(p.provider_name)}</span>
                      </div>
                    `).join('')}
                  </div>`
                : `<p style="margin:10px 0 0;font-size:0.84rem;color:var(--text-secondary);">${t('details.noProviders')}</p>`
              }
            </div>
          </div>
        </div>
      </section>

      <div class="container">
        <section class="section-block">
          <div class="details-facts" style="margin-bottom:20px;">
            ${item.status ? `<span class="fact-pill" style="background:var(--bg-elevated);color:var(--text-secondary)">${t('details.status')}: ${escapeHtml(item.status)}</span>` : ''}
            ${dateStr ? `<span class="fact-pill" style="background:var(--bg-elevated);color:var(--text-secondary)">${t('details.releaseDate')}: ${escapeHtml(dateStr)}</span>` : ''}
            ${studios ? `<span class="fact-pill" style="background:var(--bg-elevated);color:var(--text-secondary)">${t('details.studios')}: ${escapeHtml(studios)}</span>` : ''}
          </div>

          <div class="section-header">
            <h2 class="section-title">${t('details.cast')}</h2>
          </div>
          <div class="cast-rail">
            ${[...directors.map((d) => ({ ...d, roleText: 'Director' })), ...cast.map((c) => ({ ...c, roleText: c.character }))].map((person) => `
              <a href="/person/${person.id}" data-link class="person-card">
                <img src="${getImageUrl(person.profile_path, 'w185', '/assets/person-fallback.svg')}" alt="${escapeHtml(person.name)}" loading="lazy"
                     onerror="this.onerror=null;this.src='/assets/person-fallback.svg';" />
                <div class="person-card-body">
                  <div class="person-card-name">${escapeHtml(person.name)}</div>
                  <div class="person-card-role">${escapeHtml(person.roleText || '')}</div>
                </div>
              </a>
            `).join('')}
          </div>
        </section>

        ${recItems.length ? `
          <section class="section-block">
            <div class="section-header"><h2 class="section-title">${t('details.recommended')}</h2></div>
            <div class="media-rail">${recItems.map((m) => renderMediaCard(m, genreMap, mediaType)).join('')}</div>
          </section>
        ` : ''}

        ${simItems.length ? `
          <section class="section-block">
            <div class="section-header"><h2 class="section-title">${t('details.similar')}</h2></div>
            <div class="media-rail">${simItems.map((m) => renderMediaCard(m, genreMap, mediaType)).join('')}</div>
          </section>
        ` : ''}
      </div>
    `;

    document.getElementById('details-trailer-btn').addEventListener('click', () => {
      openTrailerModal(mediaType, item.id);
    });

    document.getElementById('act-watchlist').addEventListener('click', (e) => {
      const added = toggleMediaInList('watchlist', mediaPayload);
      e.target.classList.toggle('btn-active', added);
      e.target.textContent = added ? t('details.watchlistIn') : t('details.watchlistAdd');
      showToast(added ? t('toast.added') : t('toast.removed'));
    });

    document.getElementById('act-watched').addEventListener('click', (e) => {
      const added = toggleMediaInList('watched', mediaPayload);
      e.target.classList.toggle('btn-active', added);
      e.target.textContent = added ? t('details.watchedIn') : t('details.watchedAdd');
      showToast(added ? t('toast.added') : t('toast.removed'));
    });

    document.getElementById('act-fav').addEventListener('click', (e) => {
      const added = toggleMediaInList('favorites', mediaPayload);
      e.target.classList.toggle('btn-active', added);
      e.target.textContent = added ? t('details.favIn') : t('details.favAdd');
      showToast(added ? t('toast.added') : t('toast.removed'));
    });

    document.getElementById('act-rate').addEventListener('change', (e) => {
      setMediaRating(mediaType, item.id, e.target.value);
      showToast(t('toast.rated'));
    });

    document.getElementById('watch-region-select').addEventListener('change', (e) => {
      updateStore((s) => {
        s.preferences.watchRegion = e.target.value;
        return s;
      });
      renderDetailsPage(container, mediaType, id);
    });
  } catch (err) {
    container.innerHTML = `
      <div class="container" style="padding-top:40px;">
        <div class="state-box">
          <h2>${t('error.title')}</h2>
          <p>${escapeHtml(err.message)}</p>
          <a href="/" data-link class="btn btn-primary">${t('notFound.home')}</a>
        </div>
      </div>
    `;
  }
}
