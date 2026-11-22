import { getImageUrl, getMediaTitle, getMediaYear, tmdbApi } from './api.js';
import { icons } from './icons.js';
import { loadLastSearch, saveLastSearch } from './storage.js';
import { state, t } from './store.js';
import {
  createEmptyState,
  createErrorState,
  createMediaCard,
  createSkeletonGrid,
  escapeHtml,
  navigateTo,
} from './ui.js';

export function renderSearchPage(container, outerSignal) {
  const dict = t();
  const urlQ = new URLSearchParams(window.location.search).get('q');
  let query = urlQ !== null ? urlQ : loadLastSearch();
  let activeTab = 'all';
  let results = [];
  let loading = false;
  let error = null;
  let debounceTimer = null;
  let reqController = null;

  container.innerHTML = `
    <div class="container page-stack page-enter">
      <div>
        <h1 class="page-title">${escapeHtml(dict.search.title)}</h1>
        <p class="page-subtitle">${escapeHtml(dict.search.peopleHint)}</p>
      </div>

      <form id="search-page-form" style="position:relative;max-width:760px;">
        <div class="header-search-form" style="height:48px;">
          <span class="header-search-icon">${icons.search}</span>
          <input id="search-page-input" type="text" class="header-search-input" value="${escapeHtml(query)}" placeholder="${escapeHtml(dict.search.placeholder)}" autocomplete="off" />
          <button type="button" id="search-page-clear" class="header-search-clear" style="display:${query ? 'inline-flex' : 'none'}" aria-label="Clear">
            ${icons.x}
          </button>
          <button type="submit" class="header-search-submit" style="height:34px;">${escapeHtml(dict.nav.search)}</button>
        </div>
      </form>

      <div class="tabs-row no-scrollbar" id="search-tabs"></div>
      <div id="search-results"></div>
    </div>
  `;

  const inputEl = container.querySelector('#search-page-input');
  const clearBtn = container.querySelector('#search-page-clear');
  const formEl = container.querySelector('#search-page-form');
  const tabsEl = container.querySelector('#search-tabs');
  const resultsEl = container.querySelector('#search-results');

  const tabTypes = ['all', 'movie', 'tv', 'person'];

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const typeKey of tabTypes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab-btn ${activeTab === typeKey ? 'is-active' : ''}`;
      btn.textContent = dict.search.tabs[typeKey];
      btn.addEventListener('click', () => {
        activeTab = typeKey;
        renderTabs();
        runSearch(query);
      });
      tabsEl.appendChild(btn);
    }
  }

  function renderResults() {
    resultsEl.innerHTML = '';
    const trimmed = query.trim();

    if (!trimmed) {
      resultsEl.appendChild(
        createEmptyState({
          title: dict.search.emptyPromptTitle,
          description: dict.search.emptyPromptDesc,
        })
      );
      return;
    }

    if (loading) {
      resultsEl.appendChild(createSkeletonGrid(12));
      return;
    }

    if (error) {
      resultsEl.appendChild(createErrorState(error, () => runSearch(query)));
      return;
    }

    if (results.length === 0) {
      resultsEl.appendChild(
        createEmptyState({
          title: dict.search.noResultsTitle,
          description: dict.search.noResultsDesc,
        })
      );
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'poster-grid';

    for (const item of results) {
      const itemType = activeTab === 'all' ? item.media_type : activeTab;

      if (itemType === 'person') {
        const photo = getImageUrl(item.profile_path, 'w342');
        const pCard = document.createElement('article');
        pCard.className = 'person-mini-card';
        pCard.tabIndex = 0;
        pCard.setAttribute('role', 'link');
        pCard.innerHTML = `
          <div class="person-mini-photo">
            ${
              photo
                ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(item.name || '')}" loading="lazy" referrerpolicy="no-referrer" />`
                : icons.user
            }
          </div>
          <div class="person-mini-body">
            <div class="person-mini-name">${escapeHtml(item.name || '')}</div>
            <div class="person-mini-role">${escapeHtml(item.known_for_department || dict.search.personBadge)}</div>
          </div>
        `;
        pCard.addEventListener('click', () => navigateTo(`/person/${item.id}`));
        pCard.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigateTo(`/person/${item.id}`);
          }
        });
        grid.appendChild(pCard);
      } else {
        grid.appendChild(
          createMediaCard(item, { explicitType: itemType === 'tv' ? 'tv' : 'movie' })
        );
      }
    }

    resultsEl.appendChild(grid);
  }

  async function runSearch(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
      results = [];
      loading = false;
      error = null;
      renderResults();
      return;
    }

    saveLastSearch(trimmed);
    if (reqController) reqController.abort();
    reqController = new AbortController();
    const signal = reqController.signal;

    loading = true;
    error = null;
    renderResults();

    try {
      const endpointType = activeTab === 'all' ? 'multi' : activeTab;
      const res = await tmdbApi.search(endpointType, trimmed, state.lang, 1, signal);
      if (signal.aborted || outerSignal.aborted) return;
      results = res.results || [];
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      error = err;
    } finally {
      if (!signal.aborted && !outerSignal.aborted) {
        loading = false;
        renderResults();
      }
    }
  }

  inputEl?.addEventListener('input', () => {
    query = inputEl.value;
    if (clearBtn) clearBtn.style.display = query ? 'inline-flex' : 'none';
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => runSearch(query), 350);
  });

  clearBtn?.addEventListener('click', () => {
    query = '';
    if (inputEl) inputEl.value = '';
    clearBtn.style.display = 'none';
    renderResults();
    inputEl?.focus();
  });

  formEl?.addEventListener('submit', (e) => {
    e.preventDefault();
    window.clearTimeout(debounceTimer);
    runSearch(query);
  });

  outerSignal.addEventListener('abort', () => {
    window.clearTimeout(debounceTimer);
    if (reqController) reqController.abort();
  });

  renderTabs();
  runSearch(query);
}

export function attachHeaderSearchBehavior(headerEl) {
  const dict = t();
  const wrap = headerEl.querySelector('#header-search-wrap');
  const form = headerEl.querySelector('#header-search-form');
  const input = headerEl.querySelector('#header-search-input');
  const clearBtn = headerEl.querySelector('#header-search-clear');
  const dropdown = headerEl.querySelector('#header-search-dropdown');

  if (!wrap || !form || !input || !dropdown) return;

  let timer = null;
  let controller = null;

  function hideDropdown() {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
  }

  function renderSuggestions(items, rawQuery, isLoading) {
    if (rawQuery.trim().length < 2) {
      hideDropdown();
      return;
    }
    dropdown.hidden = false;

    if (isLoading) {
      dropdown.innerHTML = `
        <div style="padding:8px;display:flex;flex-direction:column;gap:8px;">
          <div class="skeleton-box" style="height:52px;"></div>
          <div class="skeleton-box" style="height:52px;"></div>
          <div class="skeleton-box" style="height:52px;"></div>
        </div>
      `;
      return;
    }

    if (!items || items.length === 0) {
      dropdown.innerHTML = `<div style="padding:20px;text-align:center;font-size:0.85rem;color:var(--text-muted);">${escapeHtml(dict.search.noResultsTitle)}</div>`;
      return;
    }

    dropdown.innerHTML = `<div class="suggestion-heading">${escapeHtml(dict.search.suggestions)}</div>`;

    for (const item of items.slice(0, 6)) {
      const isPerson = item.media_type === 'person';
      const imgUrl = getImageUrl(isPerson ? item.profile_path : item.poster_path, 'w185');
      const title = getMediaTitle(item);
      const year = getMediaYear(item);
      const target =
        item.media_type === 'person'
          ? `/person/${item.id}`
          : item.media_type === 'tv'
            ? `/series/${item.id}`
            : `/movie/${item.id}`;
      const badge =
        item.media_type === 'person'
          ? dict.search.personBadge
          : item.media_type === 'tv'
            ? dict.search.seriesBadge
            : dict.search.movieBadge;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggestion-item';
      btn.innerHTML = `
        <div class="suggestion-thumb">
          ${
            imgUrl
              ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(title)}" referrerpolicy="no-referrer" />`
              : icons.film
          }
        </div>
        <div style="flex:1;min-width:0;">
          <div class="suggestion-title">${escapeHtml(title)}</div>
          <div class="suggestion-meta">${escapeHtml(badge)}${year ? ` · ${escapeHtml(year)}` : ''}</div>
        </div>
      `;
      btn.addEventListener('click', () => {
        saveLastSearch(rawQuery.trim());
        hideDropdown();
        navigateTo(target);
      });
      dropdown.appendChild(btn);
    }

    const viewAllBtn = document.createElement('button');
    viewAllBtn.type = 'button';
    viewAllBtn.className = 'suggestion-view-all';
    viewAllBtn.textContent = `${dict.search.viewAllResults} «${rawQuery.trim()}»`;
    viewAllBtn.addEventListener('click', () => {
      saveLastSearch(rawQuery.trim());
      hideDropdown();
      navigateTo(`/search?q=${encodeURIComponent(rawQuery.trim())}`);
    });
    dropdown.appendChild(viewAllBtn);
  }

  input.addEventListener('input', () => {
    const val = input.value;
    if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
    window.clearTimeout(timer);
    if (val.trim().length < 2) {
      if (controller) controller.abort();
      hideDropdown();
      return;
    }

    renderSuggestions([], val, true);
    timer = window.setTimeout(async () => {
      if (controller) controller.abort();
      controller = new AbortController();
      try {
        const res = await tmdbApi.search('multi', val.trim(), state.lang, 1, controller.signal);
        renderSuggestions(res.results || [], val, false);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          renderSuggestions([], val, false);
        }
      }
    }, 300);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2 && dropdown.innerHTML) {
      dropdown.hidden = false;
    }
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    hideDropdown();
    input.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const trimmed = input.value.trim();
    hideDropdown();
    if (!trimmed) {
      navigateTo('/search');
      return;
    }
    saveLastSearch(trimmed);
    navigateTo(`/search?q=${encodeURIComponent(trimmed)}`);
  });

  document.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target)) hideDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDropdown();
      input.blur();
    }
  });
}
