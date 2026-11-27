import { getImageUrl, getMediaTitle, getMediaType, tmdbApi } from './api.js';
import { translateDepartment } from './i18n.js';
import { icons } from './icons.js';
import { state, t } from './store.js';
import {
  createEmptyState,
  createErrorState,
  createMediaCard,
  createSkeletonGrid,
  escapeHtml,
  navigateTo,
} from './ui.js';

// Выбирает до 2 фильмов персоны с высоким рейтингом для верхней полоски карточки
function getTopPersonMovies(person) {
  const allKnown = Array.isArray(person.known_for) ? person.known_for : [];
  const moviesOnly = allKnown.filter((item) => getMediaType(item, 'movie') === 'movie');
  const sourceList = moviesOnly.length > 0 ? moviesOnly : allKnown;

  const sorted = [...sourceList].sort((a, b) => {
    const aHasVotes = (a.vote_count || 0) >= 80;
    const bHasVotes = (b.vote_count || 0) >= 80;
    if (aHasVotes !== bHasVotes) {
      return bHasVotes ? 1 : -1;
    }

    const ratingDiff = (b.vote_average || 0) - (a.vote_average || 0);
    if (Math.abs(ratingDiff) > 0.05) {
      return ratingDiff;
    }

    return (b.popularity || 0) - (a.popularity || 0);
  });

  const topTwo = sorted.slice(0, 2);
  const titles = topTwo.map((item) => getMediaTitle(item)).filter(Boolean).join(', ');
  const firstRating = topTwo[0]?.vote_average;
  const rating = typeof firstRating === 'number' && firstRating > 0 ? firstRating.toFixed(1) : null;

  return { titles, rating };
}

// Страница списка актёров и режиссёров
export function renderPeoplePage(container, outerSignal) {
  const dict = t();
  let query = '';
  let roleTab = 'actors';
  let people = [];
  let loading = true;
  let error = null;
  let timer = null;
  let reqController = null;

  container.innerHTML = `
    <div class="container page-stack page-enter">
      <div>
        <h1 class="page-title">${escapeHtml(dict.people.title)}</h1>
        <p class="page-subtitle">${escapeHtml(dict.people.subtitle)}</p>
      </div>

      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;">
        <div class="tabs-row" style="border-bottom:none;padding-bottom:0;" id="people-role-tabs"></div>
        <div class="header-search-form" style="max-width:340px;height:40px;">
          <span class="header-search-icon">${icons.search}</span>
          <input id="people-search-input" type="text" class="header-search-input" placeholder="${escapeHtml(dict.people.searchPlaceholder)}" />
          <button type="button" id="people-search-clear" class="header-search-clear" style="display:none;" aria-label="Clear">${icons.x}</button>
        </div>
      </div>

      <div id="people-grid"></div>
    </div>
  `;

  const roleTabsEl = container.querySelector('#people-role-tabs');
  const inputEl = container.querySelector('#people-search-input');
  const clearBtn = container.querySelector('#people-search-clear');
  const gridEl = container.querySelector('#people-grid');

  function renderRoleTabs() {
    roleTabsEl.innerHTML = '';
    for (const tabKey of ['actors', 'directors']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab-btn ${roleTab === tabKey ? 'is-active' : ''}`;
      btn.textContent = tabKey === 'actors' ? dict.people.actorsTab : dict.people.directorsTab;
      btn.addEventListener('click', () => {
        if (roleTab === tabKey) return;
        roleTab = tabKey;
        renderRoleTabs();
        if (!query.trim()) {
          loadPeople();
        } else {
          renderGrid();
        }
      });
      roleTabsEl.appendChild(btn);
    }
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    if (loading) {
      gridEl.appendChild(createSkeletonGrid(12));
      return;
    }
    if (error) {
      gridEl.appendChild(createErrorState(error, loadPeople));
      return;
    }

    const trimmed = query.trim();
    const list = trimmed
      ? people.filter((p) => {
          const dept = (p.known_for_department || '').toLowerCase();
          if (roleTab === 'directors') return dept === 'directing';
          return dept === 'acting' || dept === 'actors' || dept === '';
        })
      : people;

    const displayList = trimmed && list.length === 0 ? people : list;
    if (displayList.length === 0) {
      gridEl.appendChild(
        createEmptyState({
          title: dict.search.noResultsTitle,
          description: dict.search.noResultsDesc,
        })
      );
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'poster-grid';
    for (const person of displayList) {
      const photo = getImageUrl(person.profile_path, 'w342');
      const deptLabel = translateDepartment(person.known_for_department || '', state.lang);
      const { titles: topKnown, rating: topRating } = getTopPersonMovies(person);
      const card = document.createElement('article');
      card.className = 'person-mini-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'link');
      card.innerHTML = `
        ${
          topKnown
            ? `<div class="person-mini-known-bar" title="${escapeHtml(`${dict.people.popularFilmsLabel}: ${topKnown}`)}">${icons.film}${
                topRating ? `<span class="person-mini-known-rating">★ ${escapeHtml(topRating)}</span>` : ''
              }<span class="person-mini-known-titles">${escapeHtml(topKnown)}</span></div>`
            : ''
        }
        <div class="person-mini-photo">
          ${
            photo
              ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(person.name || '')}" loading="lazy" referrerpolicy="no-referrer" />`
              : icons.user
          }
        </div>
        <div class="person-mini-body">
          <div class="person-mini-name">${escapeHtml(person.name || '')}</div>
          ${deptLabel ? `<div class="person-mini-role">${escapeHtml(deptLabel)}</div>` : ''}
        </div>
      `;
      card.addEventListener('click', () => navigateTo(`/person/${person.id}`));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateTo(`/person/${person.id}`);
        }
      });
      grid.appendChild(card);
    }
    gridEl.appendChild(grid);
  }

  // Загрузка актёров, режиссёров или результатов поиска
  async function loadPeople() {
    if (reqController) reqController.abort();
    reqController = new AbortController();
    const signal = reqController.signal;
    loading = true;
    error = null;
    renderGrid();

    try {
      const trimmed = query.trim();
      if (trimmed.length >= 2) {
        const res = await tmdbApi.search('person', trimmed, state.lang, 1, signal);
        people = res.results || [];
      } else if (roleTab === 'directors') {
        const res = await tmdbApi.getDirectors(state.lang, signal);
        people = res.results || [];
      } else {
        const [p1, p2] = await Promise.all([
          tmdbApi.getPopularPeople(state.lang, 1, signal),
          tmdbApi.getPopularPeople(state.lang, 2, signal),
        ]);
        const seen = new Set();
        people = [...(p1.results || []), ...(p2.results || [])].filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          const dept = (p.known_for_department || '').toLowerCase();
          return dept === 'acting' || dept === 'actors' || dept === '';
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      error = err;
    } finally {
      if (!signal.aborted && !outerSignal.aborted) {
        loading = false;
        renderGrid();
      }
    }
  }

  inputEl?.addEventListener('input', () => {
    query = inputEl.value;
    if (clearBtn) clearBtn.style.display = query ? 'inline-flex' : 'none';
    window.clearTimeout(timer);
    timer = window.setTimeout(loadPeople, 350);
  });

  clearBtn?.addEventListener('click', () => {
    query = '';
    if (inputEl) inputEl.value = '';
    clearBtn.style.display = 'none';
    loadPeople();
  });

  outerSignal.addEventListener('abort', () => {
    window.clearTimeout(timer);
    if (reqController) reqController.abort();
  });

  renderRoleTabs();
  loadPeople();
}

// Детальная страница актёра или режиссёра с биографией и фильмографией
export function renderPersonDetailPage(container, id, outerSignal) {
  const dict = t();

  container.innerHTML = `
    <div class="container page-stack">
      <div class="skeleton-box" style="height:280px;border-radius:20px;"></div>
    </div>
  `;

  async function load() {
    try {
      const person = await tmdbApi.getPersonDetail(id, state.lang, outerSignal);
      if (outerSignal.aborted) return;

      const dedupeAndSort = (list) => {
        const seen = new Set();
        const out = [];
        for (const item of list || []) {
          const k = `${item.media_type}-${item.id}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push(item);
          }
        }
        return out.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      };

      const castCredits = dedupeAndSort(person.combined_credits?.cast);
      const crewCredits = dedupeAndSort(person.combined_credits?.crew);

      let creditTab = 'cast';
      if (person.known_for_department === 'Directing' && crewCredits.length > 0) {
        creditTab = 'crew';
      } else if (castCredits.length === 0 && crewCredits.length > 0) {
        creditTab = 'crew';
      }

      const photoUrl = getImageUrl(person.profile_path, 'w500');

      const render = () => {
        const activeCredits = creditTab === 'cast' ? castCredits : crewCredits;
        container.innerHTML = `
          <div class="container page-stack page-enter">
            <div>
              <button type="button" class="btn btn-ghost" data-back style="height:32px;padding:0 10px;font-size:0.8rem;">
                ${icons.arrowLeft}
                <span>${escapeHtml(dict.detail.back)}</span>
              </button>
            </div>

            <div class="person-detail-header">
              <div class="person-detail-photo">
                ${
                  photoUrl
                    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(person.name || '')}" referrerpolicy="no-referrer" />`
                    : `<div class="media-poster-fallback">${icons.user}</div>`
                }
              </div>

              <div style="flex:1;min-width:0;">
                <h1 class="detail-title" style="margin-top:0;">${escapeHtml(person.name || '')}</h1>
                ${
                  person.known_for_department
                    ? `<p style="margin:6px 0 0;font-size:0.875rem;font-weight:700;color:var(--accent-brand);">${escapeHtml(dict.people.knownFor)}: ${escapeHtml(translateDepartment(person.known_for_department, state.lang))}</p>`
                    : ''
                }

                <div class="detail-stats-row tabular-nums" style="margin-top:16px;">
                  ${
                    person.birthday
                      ? `<div><div class="info-row-label">${escapeHtml(dict.people.birthday)}</div><div class="info-row-val">${escapeHtml(person.birthday)}${person.deathday ? ` — ${escapeHtml(person.deathday)}` : ''}</div></div>`
                      : ''
                  }
                  ${
                    person.place_of_birth
                      ? `<div><div class="info-row-label">${escapeHtml(dict.people.birthplace)}</div><div class="info-row-val">${escapeHtml(person.place_of_birth)}</div></div>`
                      : ''
                  }
                </div>

                <h2 style="margin:22px 0 8px;font-size:1.1rem;font-weight:800;">${escapeHtml(dict.people.biography)}</h2>
                <p style="margin:0;max-width:75ch;font-size:0.9375rem;line-height:1.65;color:var(--text-secondary);white-space:pre-line;">${escapeHtml(person.biography || dict.people.noBio)}</p>
                ${
                  person._bioFallbackEn
                    ? `<p style="margin:8px 0 0;font-size:0.75rem;color:var(--text-muted);">${escapeHtml(dict.people.bioEnFallback)}</p>`
                    : ''
                }
              </div>
            </div>

            ${
              castCredits.length > 0 || crewCredits.length > 0
                ? `
              <section>
                <div class="section-header" style="border-bottom:1px solid var(--border-color);padding-bottom:12px;">
                  <h2 class="section-title">${escapeHtml(dict.people.filmography)}</h2>
                  <div style="display:flex;gap:8px;">
                    ${
                      castCredits.length > 0
                        ? `<button type="button" class="tab-btn ${creditTab === 'cast' ? 'is-active' : ''}" data-credit-tab="cast">${escapeHtml(dict.people.asCast)} (${castCredits.length})</button>`
                        : ''
                    }
                    ${
                      crewCredits.length > 0
                        ? `<button type="button" class="tab-btn ${creditTab === 'crew' ? 'is-active' : ''}" data-credit-tab="crew">${escapeHtml(dict.people.asCrew)} (${crewCredits.length})</button>`
                        : ''
                    }
                  </div>
                </div>
                <div class="poster-grid" id="person-credits-grid"></div>
              </section>
            `
                : ''
            }
          </div>
        `;

        container.querySelector('[data-back]')?.addEventListener('click', () => window.history.back());
        container.querySelectorAll('[data-credit-tab]').forEach((btn) => {
          btn.addEventListener('click', () => {
            creditTab = btn.getAttribute('data-credit-tab');
            render();
          });
        });

        const creditsGrid = container.querySelector('#person-credits-grid');
        if (creditsGrid) {
          for (const credit of activeCredits.slice(0, 36)) {
            creditsGrid.appendChild(createMediaCard(credit, { explicitType: credit.media_type }));
          }
        }
      };

      render();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      container.innerHTML = '<div class="container page-stack" id="person-err"></div>';
      container.querySelector('#person-err')?.appendChild(createErrorState(err, load));
    }
  }

  load();
}
