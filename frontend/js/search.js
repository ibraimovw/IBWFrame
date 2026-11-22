import { fetchTmdb, getGenreMap, getImageUrl } from './api.js';
import { getSessionState, setSessionState } from './storage.js';
import { t } from './i18n.js';
import { renderMediaCard, renderSkeletonGrid, escapeHtml } from './ui.js';

export function initHeaderSearch(navigate) {
  const input = document.getElementById('header-search-input');
  const btn = document.getElementById('header-search-btn');
  const dropdown = document.getElementById('search-suggestions');
  if (!input || !dropdown) return;

  let debounceTimer = null;
  let abortController = null;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    if (q.length < 2) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      try {
        const data = await fetchTmdb('/search/multi', { query: q, page: 1 }, { signal: abortController.signal });
        const items = (data.results || []).slice(0, 6);
        if (!items.length) {
          dropdown.classList.add('hidden');
          return;
        }
        dropdown.innerHTML = items.map((item) => {
          const type = item.media_type;
          const name = item.title || item.name;
          const img = type === 'person'
            ? getImageUrl(item.profile_path, 'w92', '/assets/person-fallback.svg')
            : getImageUrl(item.poster_path, 'w92');
          const href = type === 'person' ? `/person/${item.id}` : type === 'tv' ? `/series/${item.id}` : `/movie/${item.id}`;
          const year = (item.release_date || item.first_air_date || '').slice(0, 4);
          return `
            <a href="${href}" data-link class="suggestion-item">
              <img class="suggestion-thumb" src="${img}" alt="" />
              <div class="suggestion-info">
                <div class="suggestion-title">${escapeHtml(name)}</div>
                <div class="suggestion-sub">${type.toUpperCase()} ${year ? `• ${year}` : ''}</div>
              </div>
            </a>
          `;
        }).join('');
        dropdown.classList.remove('hidden');
      } catch (err) {
        if (err.name !== 'AbortError') dropdown.classList.add('hidden');
      }
    }, 320);
  });

  const submitSearch = () => {
    const q = input.value.trim();
    dropdown.classList.add('hidden');
    if (q) {
      setSessionState({ lastSearchQuery: q });
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/search');
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSearch();
    }
  });

  btn?.addEventListener('click', submitSearch);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#header-search-wrap')) {
      dropdown.classList.add('hidden');
    }
  });
}

export async function renderSearchPage(container) {
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') ?? getSessionState().lastSearchQuery ?? '';
  let activeType = urlParams.get('type') || 'multi';

  container.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1 class="page-title">${t('search.title')}</h1>
        <div style="display:flex;gap:10px;max-width:620px;margin-bottom:16px;">
          <input type="search" id="page-search-input" class="form-input" style="flex:1;"
                 value="${escapeHtml(initialQuery)}" placeholder="${t('search.quickPlaceholder')}" />
          <button type="button" class="btn btn-primary" id="page-search-submit">${t('nav.search')}</button>
        </div>
        <div class="tabs-bar" id="search-type-tabs">
          <button type="button" class="tab-btn ${activeType === 'multi' ? 'active' : ''}" data-type="multi">${t('search.all')}</button>
          <button type="button" class="tab-btn ${activeType === 'movie' ? 'active' : ''}" data-type="movie">${t('search.movies')}</button>
          <button type="button" class="tab-btn ${activeType === 'tv' ? 'active' : ''}" data-type="tv">${t('search.series')}</button>
          <button type="button" class="tab-btn ${activeType === 'person' ? 'active' : ''}" data-type="person">${t('search.people')}</button>
        </div>
      </div>
      <div id="search-results-slot"></div>
    </div>
  `;

  const resultsSlot = document.getElementById('search-results-slot');
  const pageInput = document.getElementById('page-search-input');

  async function runSearch(query) {
    const q = query.trim();
    if (!q) {
      resultsSlot.innerHTML = `<div class="state-box"><p>${t('search.quickPlaceholder')}</p></div>`;
      return;
    }

    setSessionState({ lastSearchQuery: q });
    resultsSlot.innerHTML = renderSkeletonGrid(10);

    try {
      const [data, movieGenres, tvGenres] = await Promise.all([
        fetchTmdb(`/search/${activeType}`, { query: q, page: 1 }),
        getGenreMap('movie'),
        getGenreMap('tv')
      ]);

      const results = data.results || [];
      if (!results.length) {
        resultsSlot.innerHTML = `<div class="state-box"><h3>${t('search.emptyTitle')}</h3><p>${t('search.emptyDesc')}</p></div>`;
        return;
      }

      resultsSlot.innerHTML = `<div class="media-grid">
        ${results.map((item) => {
          const itemType = activeType === 'multi' ? item.media_type : activeType;
          if (itemType === 'person') {
            return `
              <a href="/person/${item.id}" data-link class="media-card">
                <div class="card-poster-wrap">
                  <img class="card-poster" src="${getImageUrl(item.profile_path, 'w342', '/assets/person-fallback.svg')}" alt="${escapeHtml(item.name)}" loading="lazy" />
                </div>
                <div class="card-body">
                  <h3 class="card-title">${escapeHtml(item.name)}</h3>
                  <div class="card-meta">${escapeHtml(item.known_for_department || 'Person')}</div>
                </div>
              </a>
            `;
          }
          return renderMediaCard(item, itemType === 'tv' ? tvGenres : movieGenres, itemType);
        }).join('')}
      </div>`;
    } catch (err) {
      resultsSlot.innerHTML = `<div class="state-box"><h3>${t('error.title')}</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  document.getElementById('search-type-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    document.querySelectorAll('#search-type-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeType = btn.dataset.type;
    runSearch(pageInput.value);
  });

  document.getElementById('page-search-submit').addEventListener('click', () => runSearch(pageInput.value));
  pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch(pageInput.value);
  });

  if (initialQuery) runSearch(initialQuery);
}
