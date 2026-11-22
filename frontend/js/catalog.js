import { fetchTmdb, getGenreMap } from './api.js';
import { getSessionState, setSessionState } from './storage.js';
import { t } from './i18n.js';
import { renderMediaCard, renderSkeletonGrid, escapeHtml } from './ui.js';

export async function renderCatalogPage(container, mediaType = 'movie') {
  const isMovie = mediaType === 'movie';
  const urlParams = new URLSearchParams(window.location.search);
  const sessionKey = `catalog_${mediaType}`;
  const saved = getSessionState()[sessionKey] || {};

  const state = {
    tab: urlParams.get('tab') || saved.tab || 'popular',
    genre: urlParams.get('genre') || saved.genre || '',
    year: urlParams.get('year') || saved.year || '',
    rating: urlParams.get('rating') || saved.rating || '',
    country: urlParams.get('country') || saved.country || '',
    runtime: urlParams.get('runtime') || saved.runtime || '',
    sort: urlParams.get('sort') || saved.sort || 'popularity.desc',
    page: 1,
    totalPages: 1,
    loading: false,
    loadedIds: new Set()
  };

  const tabs = isMovie
    ? [
        { id: 'popular', label: t('catalog.popular') },
        { id: 'trending', label: t('catalog.trending') },
        { id: 'top_rated', label: t('catalog.topRated') },
        { id: 'upcoming', label: t('catalog.upcoming') },
        { id: 'now_playing', label: t('catalog.nowPlaying') },
        { id: 'all', label: t('catalog.all') }
      ]
    : [
        { id: 'popular', label: t('catalog.popular') },
        { id: 'trending', label: t('catalog.trending') },
        { id: 'top_rated', label: t('catalog.topRated') },
        { id: 'airing_today', label: t('catalog.airingToday') },
        { id: 'on_the_air', label: t('catalog.onTheAir') },
        { id: 'all', label: t('catalog.all') }
      ];

  const genreMap = await getGenreMap(mediaType);
  const genreOptions = Object.entries(genreMap)
    .map(([id, name]) => `<option value="${id}" ${state.genre === id ? 'selected' : ''}>${escapeHtml(name)}</option>`)
    .join('');

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 45 }, (_, idx) => String(currentYear - idx))
    .map((y) => `<option value="${y}" ${state.year === y ? 'selected' : ''}>${y}</option>`)
    .join('');

  container.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1 class="page-title">${isMovie ? t('nav.movies') : t('nav.series')}</h1>
        <div class="tabs-bar" id="catalog-tabs">
          ${tabs.map((tb) => `
            <button type="button" class="tab-btn ${state.tab === tb.id ? 'active' : ''}" data-tab="${tb.id}">
              ${tb.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="filter-panel">
        <div class="filter-row">
          <label class="filter-field">
            <span>${t('filter.genre')}</span>
            <select id="flt-genre">
              <option value="">${t('filter.allGenres')}</option>
              ${genreOptions}
            </select>
          </label>
          <label class="filter-field">
            <span>${t('filter.year')}</span>
            <select id="flt-year">
              <option value="">${t('filter.anyYear')}</option>
              ${yearOptions}
            </select>
          </label>
          <label class="filter-field">
            <span>${t('filter.rating')}</span>
            <select id="flt-rating">
              <option value="">${t('filter.anyRating')}</option>
              <option value="8" ${state.rating === '8' ? 'selected' : ''}>8.0+</option>
              <option value="7" ${state.rating === '7' ? 'selected' : ''}>7.0+</option>
              <option value="6" ${state.rating === '6' ? 'selected' : ''}>6.0+</option>
            </select>
          </label>
          <label class="filter-field">
            <span>${t('filter.sort')}</span>
            <select id="flt-sort">
              <option value="popularity.desc" ${state.sort === 'popularity.desc' ? 'selected' : ''}>${t('filter.sortPop')}</option>
              <option value="vote_average.desc" ${state.sort === 'vote_average.desc' ? 'selected' : ''}>${t('filter.sortRating')}</option>
              <option value="${isMovie ? 'primary_release_date.desc' : 'first_air_date.desc'}" ${state.sort.includes('date') ? 'selected' : ''}>${t('filter.sortNewest')}</option>
            </select>
          </label>
        </div>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm" id="toggle-adv-filters">${t('filter.more')}</button>
          <button type="button" class="btn btn-secondary btn-sm" id="reset-filters">${t('filter.reset')}</button>
        </div>

        <div class="filter-advanced hidden" id="adv-filters-box">
          <div class="filter-row">
            <label class="filter-field">
              <span>${t('filter.country')}</span>
              <select id="flt-country">
                <option value="">${t('filter.anyCountry')}</option>
                <option value="US" ${state.country === 'US' ? 'selected' : ''}>USA</option>
                <option value="GB" ${state.country === 'GB' ? 'selected' : ''}>UK</option>
                <option value="FR" ${state.country === 'FR' ? 'selected' : ''}>France</option>
                <option value="KR" ${state.country === 'KR' ? 'selected' : ''}>South Korea</option>
                <option value="JP" ${state.country === 'JP' ? 'selected' : ''}>Japan</option>
                <option value="RU" ${state.country === 'RU' ? 'selected' : ''}>Russia</option>
              </select>
            </label>
            <label class="filter-field">
              <span>${t('filter.runtime')}</span>
              <input type="number" id="flt-runtime" min="30" max="300" step="10" value="${escapeHtml(state.runtime)}" placeholder="e.g. 140" />
            </label>
          </div>
        </div>
      </div>

      <div id="catalog-grid-slot">${renderSkeletonGrid(12)}</div>
      <div id="catalog-sentinel" style="height: 40px; margin-top: 24px; text-align:center; color: var(--text-muted);"></div>
    </div>
  `;

  const gridSlot = document.getElementById('catalog-grid-slot');
  const sentinel = document.getElementById('catalog-sentinel');

  function hasActiveFilters() {
    return Boolean(state.genre || state.year || state.rating || state.country || state.runtime || state.sort !== 'popularity.desc');
  }

  function persistFilters() {
    setSessionState({
      [sessionKey]: {
        tab: state.tab,
        genre: state.genre,
        year: state.year,
        rating: state.rating,
        country: state.country,
        runtime: state.runtime,
        sort: state.sort
      }
    });
  }

  async function loadPage(reset = false) {
    if (state.loading) return;
    if (!reset && state.page > state.totalPages) return;

    state.loading = true;
    if (reset) {
      state.page = 1;
      state.loadedIds.clear();
      gridSlot.innerHTML = renderSkeletonGrid(12);
    } else {
      sentinel.textContent = 'Loading...';
    }

    try {
      let endpoint = '';
      const params = { page: state.page };

      if (hasActiveFilters() || state.tab === 'all') {
        endpoint = `/discover/${mediaType}`;
        params.sort_by = state.sort;
        if (state.genre) params.with_genres = state.genre;
        if (state.year) {
          params[isMovie ? 'primary_release_year' : 'first_air_date_year'] = state.year;
        }
        if (state.rating) {
          params['vote_average.gte'] = state.rating;
          params['vote_count.gte'] = 100;
        }
        if (state.country) params.with_origin_country = state.country;
        if (state.runtime) params['with_runtime.lte'] = state.runtime;
      } else if (state.tab === 'trending') {
        endpoint = `/trending/${mediaType}/week`;
      } else {
        endpoint = `/${mediaType}/${state.tab}`;
      }

      const data = await fetchTmdb(endpoint, params);
      state.totalPages = Math.min(data.total_pages || 1, 500);

      const uniqueItems = (data.results || []).filter((item) => {
        if (state.loadedIds.has(item.id)) return false;
        state.loadedIds.add(item.id);
        return true;
      });

      const cardsHtml = uniqueItems.map((item) => renderMediaCard(item, genreMap, mediaType)).join('');

      if (reset) {
        if (!uniqueItems.length) {
          gridSlot.innerHTML = `<div class="state-box"><h3>${t('search.emptyTitle')}</h3><p>${t('search.emptyDesc')}</p></div>`;
        } else {
          gridSlot.innerHTML = `<div class="media-grid" id="catalog-grid">${cardsHtml}</div>`;
        }
      } else {
        document.getElementById('catalog-grid')?.insertAdjacentHTML('beforeend', cardsHtml);
      }

      state.page += 1;
      sentinel.textContent = '';
    } catch (err) {
      if (reset) {
        gridSlot.innerHTML = `<div class="state-box"><h3>${t('error.title')}</h3><p>${escapeHtml(err.message)}</p></div>`;
      }
      sentinel.textContent = '';
    } finally {
      state.loading = false;
    }
  }

  // Слушатели вкладок и фильтров
  document.getElementById('catalog-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#catalog-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.tab = btn.dataset.tab;
    persistFilters();
    loadPage(true);
  });

  document.getElementById('toggle-adv-filters').addEventListener('click', () => {
    document.getElementById('adv-filters-box').classList.toggle('hidden');
  });

  ['flt-genre', 'flt-year', 'flt-rating', 'flt-sort', 'flt-country', 'flt-runtime'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const key = id.replace('flt-', '');
      state[key] = e.target.value;
      persistFilters();
      loadPage(true);
    });
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    state.genre = '';
    state.year = '';
    state.rating = '';
    state.country = '';
    state.runtime = '';
    state.sort = 'popularity.desc';
    ['flt-genre', 'flt-year', 'flt-rating', 'flt-country', 'flt-runtime'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('flt-sort').value = 'popularity.desc';
    persistFilters();
    loadPage(true);
  });

  // Infinite Scroll через IntersectionObserver
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !state.loading && state.page <= state.totalPages) {
      loadPage(false);
    }
  }, { rootMargin: '250px' });

  observer.observe(sentinel);
  await loadPage(true);
}
