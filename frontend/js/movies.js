import { tmdbApi } from './api.js';
import { EXPLORE_COUNTRIES } from './editorial.js';
import { icons } from './icons.js';
import { loadCatalogState, saveCatalogState } from './storage.js';
import { ensureGenresLoaded, state, t } from './store.js';
import {
  createEmptyState,
  createErrorState,
  createMediaCard,
  createSkeletonGrid,
  escapeHtml,
} from './ui.js';

const MOVIE_TABS = ['popular', 'trending', 'top_rated', 'upcoming', 'now_playing', 'all'];
const SERIES_TABS = ['popular', 'trending', 'top_rated', 'airing_today', 'on_the_air', 'all'];

const DEFAULT_FILTERS = {
  tab: 'popular',
  genre: '',
  year: '',
  country: '',
  minRating: '',
  runtime: '',
  sortBy: 'popularity.desc',
};

export function renderCatalogPage(container, mediaType, outerSignal) {
  const dict = t();
  const isMovie = mediaType === 'movie';
  const tabs = isMovie ? MOVIE_TABS : SERIES_TABS;
  const genresList = () => (isMovie ? state.movieGenres : state.tvGenres);

  const urlParams = new URLSearchParams(window.location.search);
  const stored = loadCatalogState(mediaType, DEFAULT_FILTERS);
  const urlTab = urlParams.get('tab');
  const urlGenre = urlParams.get('genre');
  const urlYear = urlParams.get('year');
  const urlCountry = urlParams.get('country');

  const initialTab =
    urlTab && tabs.includes(urlTab)
      ? urlTab
      : urlGenre || urlYear || urlCountry
        ? 'all'
        : tabs.includes(stored.tab)
          ? stored.tab
          : 'popular';

  const filters = {
    ...stored,
    tab: initialTab,
    genre: urlGenre ?? stored.genre,
    year: urlYear ?? stored.year,
    country: urlCountry ?? stored.country,
  };

  let showAdvanced = Boolean(filters.country || filters.minRating || filters.runtime);
  let items = [];
  let page = 1;
  let totalPages = 1;
  let loading = false;
  let loadingMore = false;
  let error = null;
  let activeController = null;
  const seenIds = new Set();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 56 }, (_, i) => String(currentYear - i));

  container.innerHTML = `
    <div class="container page-stack page-enter">
      <div>
        <h1 class="page-title">${escapeHtml(isMovie ? dict.catalog.moviesTitle : dict.catalog.seriesTitle)}</h1>
        <p class="page-subtitle">${escapeHtml(isMovie ? dict.catalog.moviesSubtitle : dict.catalog.seriesSubtitle)}</p>
      </div>

      <div class="tabs-row no-scrollbar" id="catalog-tabs"></div>
      <div class="filter-panel" id="catalog-filters"></div>
      <div id="catalog-results"></div>
      <div id="catalog-sentinel" style="height:24px;"></div>
    </div>
  `;

  const tabsEl = container.querySelector('#catalog-tabs');
  const filtersEl = container.querySelector('#catalog-filters');
  const resultsEl = container.querySelector('#catalog-results');
  const sentinelEl = container.querySelector('#catalog-sentinel');

  function hasActiveFilterCriteria() {
    return Boolean(
      filters.genre ||
        filters.year ||
        filters.country ||
        filters.minRating ||
        filters.runtime ||
        filters.sortBy !== 'popularity.desc'
    );
  }

  function persistFilters() {
    saveCatalogState(mediaType, filters);
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const tabKey of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab-btn ${filters.tab === tabKey ? 'is-active' : ''}`;
      btn.textContent = dict.catalog.tabs[tabKey] || tabKey;
      btn.addEventListener('click', () => {
        filters.tab = tabKey;
        persistFilters();
        renderTabs();
        fetchPage(1, true);
      });
      tabsEl.appendChild(btn);
    }
  }

  function renderFilters() {
    const gOpts = genresList()
      .map(
        (g) =>
          `<option value="${g.id}" ${filters.genre === String(g.id) ? 'selected' : ''}>${escapeHtml(g.name)}</option>`
      )
      .join('');

    const yOpts = years
      .map((y) => `<option value="${y}" ${filters.year === y ? 'selected' : ''}>${y}</option>`)
      .join('');

    const cOpts = EXPLORE_COUNTRIES.map(
      (c) =>
        `<option value="${c.code}" ${filters.country === c.code ? 'selected' : ''}>${escapeHtml(
          state.lang === 'ru' ? c.nameRu : c.nameEn
        )}</option>`
    ).join('');

    const sortYearValue = isMovie ? 'primary_release_date.desc' : 'first_air_date.desc';
    const sortOldValue = isMovie ? 'primary_release_date.asc' : 'first_air_date.asc';

    filtersEl.innerHTML = `
      <div class="filter-primary-row">
        <div>
          <label class="field-label" for="f-genre">${escapeHtml(dict.catalog.filters.genre)}</label>
          <select id="f-genre" class="select-control">
            <option value="">${escapeHtml(dict.catalog.filters.allGenres)}</option>
            ${gOpts}
          </select>
        </div>

        <div>
          <label class="field-label" for="f-year">${escapeHtml(dict.catalog.filters.year)}</label>
          <select id="f-year" class="select-control">
            <option value="">${escapeHtml(dict.catalog.filters.allYears)}</option>
            ${yOpts}
          </select>
        </div>

        <div>
          <label class="field-label" for="f-sort">${escapeHtml(dict.catalog.filters.sortBy)}</label>
          <select id="f-sort" class="select-control">
            <option value="popularity.desc" ${filters.sortBy === 'popularity.desc' ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.sortPopularity)}</option>
            <option value="vote_average.desc" ${filters.sortBy === 'vote_average.desc' ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.sortRating)}</option>
            <option value="${sortYearValue}" ${filters.sortBy === sortYearValue ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.sortNewest)}</option>
            <option value="${sortOldValue}" ${filters.sortBy === sortOldValue ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.sortOldest)}</option>
          </select>
        </div>

        <div class="filter-actions">
          <button type="button" id="f-adv-btn" class="btn ${showAdvanced ? 'btn-active-soft' : 'btn-secondary'}" style="flex:1;">
            ${icons.sliders}
            <span>${escapeHtml(dict.catalog.filters.advanced)}</span>
          </button>
          ${
            hasActiveFilterCriteria()
              ? `<button type="button" id="f-reset-btn" class="btn btn-secondary" aria-label="${escapeHtml(dict.catalog.filters.reset)}" title="${escapeHtml(dict.catalog.filters.reset)}">${icons.x}</button>`
              : ''
          }
        </div>
      </div>

      ${
        showAdvanced
          ? `
        <div class="filter-advanced-row">
          <div>
            <label class="field-label" for="f-country">${escapeHtml(dict.catalog.filters.country)}</label>
            <select id="f-country" class="select-control">
              <option value="">${escapeHtml(dict.catalog.filters.allCountries)}</option>
              ${cOpts}
            </select>
          </div>
          <div>
            <label class="field-label" for="f-rating">${escapeHtml(dict.catalog.filters.minRating)}</label>
            <select id="f-rating" class="select-control">
              <option value="" ${filters.minRating === '' ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.anyRating)}</option>
              <option value="8" ${filters.minRating === '8' ? 'selected' : ''}>8.0+</option>
              <option value="7" ${filters.minRating === '7' ? 'selected' : ''}>7.0+</option>
              <option value="6" ${filters.minRating === '6' ? 'selected' : ''}>6.0+</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="f-runtime">${escapeHtml(dict.catalog.filters.runtime)}</label>
            <select id="f-runtime" class="select-control">
              <option value="" ${filters.runtime === '' ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.runtimeAny)}</option>
              <option value="short" ${filters.runtime === 'short' ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.runtimeShort)}</option>
              <option value="medium" ${filters.runtime === 'medium' ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.runtimeMedium)}</option>
              <option value="long" ${filters.runtime === 'long' ? 'selected' : ''}>${escapeHtml(dict.catalog.filters.runtimeLong)}</option>
            </select>
          </div>
        </div>
      `
          : ''
      }
    `;

    const applyFilterChange = (patch, switchToAll = true) => {
      Object.assign(filters, patch);
      if (switchToAll) filters.tab = 'all';
      persistFilters();
      renderTabs();
      renderFilters();
      fetchPage(1, true);
    };

    filtersEl.querySelector('#f-genre')?.addEventListener('change', (e) => {
      applyFilterChange({ genre: e.target.value });
    });
    filtersEl.querySelector('#f-year')?.addEventListener('change', (e) => {
      applyFilterChange({ year: e.target.value });
    });
    filtersEl.querySelector('#f-sort')?.addEventListener('change', (e) => {
      applyFilterChange({ sortBy: e.target.value });
    });
    filtersEl.querySelector('#f-country')?.addEventListener('change', (e) => {
      applyFilterChange({ country: e.target.value });
    });
    filtersEl.querySelector('#f-rating')?.addEventListener('change', (e) => {
      applyFilterChange({ minRating: e.target.value });
    });
    filtersEl.querySelector('#f-runtime')?.addEventListener('change', (e) => {
      applyFilterChange({ runtime: e.target.value });
    });

    filtersEl.querySelector('#f-adv-btn')?.addEventListener('click', () => {
      showAdvanced = !showAdvanced;
      renderFilters();
    });

    filtersEl.querySelector('#f-reset-btn')?.addEventListener('click', () => {
      Object.assign(filters, {
        ...DEFAULT_FILTERS,
        tab: filters.tab === 'all' ? 'popular' : filters.tab,
      });
      persistFilters();
      renderTabs();
      renderFilters();
      fetchPage(1, true);
    });
  }

  function renderResults() {
    resultsEl.innerHTML = '';

    if (loading) {
      resultsEl.appendChild(createSkeletonGrid(18));
      return;
    }

    if (error && items.length === 0) {
      resultsEl.appendChild(createErrorState(error, () => fetchPage(1, true)));
      return;
    }

    if (items.length === 0) {
      resultsEl.appendChild(
        createEmptyState({
          title: dict.search.noResultsTitle,
          description: dict.search.noResultsDesc,
          actionLabel: dict.catalog.filters.reset,
          onAction: () => {
            Object.assign(filters, DEFAULT_FILTERS);
            persistFilters();
            renderTabs();
            renderFilters();
            fetchPage(1, true);
          },
        })
      );
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'poster-grid';
    for (const item of items) {
      grid.appendChild(createMediaCard(item, { explicitType: mediaType }));
    }
    resultsEl.appendChild(grid);

    if (loadingMore) {
      const moreEl = document.createElement('div');
      moreEl.style.cssText = 'text-align:center;padding:24px 0;font-size:0.875rem;color:var(--text-muted);';
      moreEl.textContent = dict.catalog.loadingMore;
      resultsEl.appendChild(moreEl);
    } else if (error) {
      const errRow = document.createElement('div');
      errRow.style.cssText = 'text-align:center;padding:20px 0;';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn btn-secondary';
      retryBtn.textContent = dict.errors.retry;
      retryBtn.addEventListener('click', () => fetchPage(page + 1, false));
      errRow.appendChild(retryBtn);
      resultsEl.appendChild(errRow);
    } else if (page >= totalPages) {
      const endEl = document.createElement('div');
      endEl.style.cssText = 'text-align:center;padding:24px 0;font-size:0.75rem;color:var(--text-subtle);';
      endEl.textContent = dict.catalog.endOfList;
      resultsEl.appendChild(endEl);
    }
  }

  async function fetchPage(targetPage, reset) {
    if (outerSignal.aborted) return;
    if (!reset && (loading || loadingMore || targetPage > totalPages)) return;

    if (activeController) activeController.abort();
    activeController = new AbortController();
    const signal = activeController.signal;

    if (reset) {
      loading = true;
      error = null;
      seenIds.clear();
      items = [];
      page = 1;
    } else {
      loadingMore = true;
      error = null;
    }
    renderResults();

    try {
      const useDiscover = filters.tab === 'all' || hasActiveFilterCriteria();
      let res;

      if (useDiscover) {
        const params = { page: targetPage, sort_by: filters.sortBy };
        if (filters.genre) params.with_genres = filters.genre;
        if (filters.country) params.with_origin_country = filters.country;
        if (filters.year) {
          if (isMovie) params.primary_release_year = filters.year;
          else params.first_air_date_year = filters.year;
        }
        if (filters.minRating) {
          params['vote_average.gte'] = filters.minRating;
          params['vote_count.gte'] = 100;
        } else if (filters.sortBy === 'vote_average.desc') {
          params['vote_count.gte'] = 300;
        }
        if (filters.runtime === 'short') params['with_runtime.lte'] = 90;
        if (filters.runtime === 'medium') {
          params['with_runtime.gte'] = 90;
          params['with_runtime.lte'] = 140;
        }
        if (filters.runtime === 'long') params['with_runtime.gte'] = 140;

        res = await tmdbApi.discover(mediaType, params, state.lang, signal);
      } else if (filters.tab === 'trending') {
        res = await tmdbApi.getTrending(mediaType, 'week', state.lang, targetPage, signal);
      } else if (isMovie) {
        res = await tmdbApi.getMoviesCategory(filters.tab, state.lang, targetPage, signal);
      } else {
        res = await tmdbApi.getSeriesCategory(filters.tab, state.lang, targetPage, signal);
      }

      if (signal.aborted || outerSignal.aborted) return;

      for (const item of res.results || []) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          items.push(item);
        }
      }
      page = targetPage;
      totalPages = Math.min(res.total_pages || 1, 500);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      error = err;
    } finally {
      if (!signal.aborted && !outerSignal.aborted) {
        loading = false;
        loadingMore = false;
        renderResults();
      }
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !loading && !loadingMore && !error && page < totalPages) {
        fetchPage(page + 1, false);
      }
    },
    { rootMargin: '320px' }
  );
  observer.observe(sentinelEl);
  outerSignal.addEventListener('abort', () => {
    observer.disconnect();
    if (activeController) activeController.abort();
  });

  renderTabs();
  ensureGenresLoaded(outerSignal).then(() => {
    if (!outerSignal.aborted) renderFilters();
  });
  renderFilters();
  fetchPage(1, true);
}
