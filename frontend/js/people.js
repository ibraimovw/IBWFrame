import { fetchTmdb, fetchTmdbWithFallback, getGenreMap, getImageUrl } from './api.js';
import { t } from './i18n.js';
import { renderMediaCard, renderSkeletonGrid, escapeHtml } from './ui.js';

export async function renderPeoplePage(container) {
  container.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1 class="page-title">${t('nav.people')}</h1>
        <div style="display:flex;gap:10px;max-width:520px;">
          <input type="search" id="people-search-input" class="form-input" style="flex:1;" placeholder="${t('people.searchPlaceholder')}" />
          <button type="button" class="btn btn-primary" id="people-search-btn">${t('nav.search')}</button>
        </div>
      </div>
      <div id="people-grid-slot">${renderSkeletonGrid(10)}</div>
    </div>
  `;

  const slot = document.getElementById('people-grid-slot');
  const input = document.getElementById('people-search-input');

  async function loadPeople(query = '') {
    slot.innerHTML = renderSkeletonGrid(10);
    try {
      const data = query.trim()
        ? await fetchTmdb('/search/person', { query: query.trim() })
        : await fetchTmdb('/person/popular');
      const list = data.results || [];
      if (!list.length) {
        slot.innerHTML = `<div class="state-box"><h3>${t('search.emptyTitle')}</h3><p>${t('search.emptyDesc')}</p></div>`;
        return;
      }
      slot.innerHTML = `<div class="media-grid">
        ${list.map((p) => `
          <a href="/person/${p.id}" data-link class="media-card">
            <div class="card-poster-wrap">
              <img class="card-poster" src="${getImageUrl(p.profile_path, 'w342', '/assets/person-fallback.svg')}" alt="${escapeHtml(p.name)}" loading="lazy" />
            </div>
            <div class="card-body">
              <h3 class="card-title">${escapeHtml(p.name)}</h3>
              <div class="card-meta">${escapeHtml(p.known_for_department || '')}</div>
            </div>
          </a>
        `).join('')}
      </div>`;
    } catch (err) {
      slot.innerHTML = `<div class="state-box"><h3>${t('error.title')}</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  document.getElementById('people-search-btn').addEventListener('click', () => loadPeople(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadPeople(input.value); });
  await loadPeople();
}

export async function renderPersonDetailsPage(container, id) {
  container.innerHTML = `<div class="container" style="padding-top:40px;"><p>Loading...</p></div>`;
  try {
    const [person, credits, movieGenres] = await Promise.all([
      fetchTmdbWithFallback(`/person/${id}`),
      fetchTmdb(`/person/${id}/combined_credits`),
      getGenreMap('movie')
    ]);

    const allCredits = [...(credits.cast || []), ...(credits.crew || [])]
      .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 16);

    container.innerHTML = `
      <div class="container" style="padding-top:36px;">
        <div class="details-grid">
          <img class="details-poster" src="${getImageUrl(person.profile_path, 'w500', '/assets/person-fallback.svg')}" alt="${escapeHtml(person.name)}" />
          <div>
            <h1 style="margin:0 0 10px;">${escapeHtml(person.name)}</h1>
            <div class="details-facts">
              ${person.known_for_department ? `<span class="fact-pill" style="background:var(--bg-elevated);color:var(--text-primary)">${escapeHtml(person.known_for_department)}</span>` : ''}
              ${person.birthday ? `<span class="fact-pill" style="background:var(--bg-elevated);color:var(--text-secondary)">${t('people.born')}: ${escapeHtml(person.birthday)}</span>` : ''}
              ${person.place_of_birth ? `<span class="fact-pill" style="background:var(--bg-elevated);color:var(--text-secondary)">${escapeHtml(person.place_of_birth)}</span>` : ''}
            </div>
            <h3>${t('people.biography')}</h3>
            <p style="line-height:1.65;color:var(--text-secondary);white-space:pre-line;">
              ${escapeHtml(person.biography || t('people.noBio'))}
            </p>
          </div>
        </div>

        <section class="section-block">
          <div class="section-header"><h2 class="section-title">${t('people.filmography')}</h2></div>
          <div class="media-grid">
            ${allCredits.map((item) => renderMediaCard(item, movieGenres, item.media_type || 'movie')).join('')}
          </div>
        </section>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="container" style="padding-top:40px;"><div class="state-box"><h3>${t('error.title')}</h3><p>${escapeHtml(err.message)}</p></div></div>`;
  }
}
