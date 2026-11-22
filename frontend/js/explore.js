import { fetchTmdb, getGenreMap } from './api.js';
import { t } from './i18n.js';
import { renderMediaCard, escapeHtml } from './ui.js';

export async function renderExplorePage(container) {
  const genreMap = await getGenreMap('movie');
  const genreOptions = Object.entries(genreMap)
    .map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`)
    .join('');

  const decades = [
    { label: '2020s', gte: '2020-01-01', lte: '2029-12-31' },
    { label: '2010s', gte: '2010-01-01', lte: '2019-12-31' },
    { label: '2000s', gte: '2000-01-01', lte: '2009-12-31' },
    { label: '1990s', gte: '1990-01-01', lte: '1999-12-31' },
    { label: '1980s', gte: '1980-01-01', lte: '1989-12-31' }
  ];

  container.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1 class="page-title">${t('explore.title')}</h1>
      </div>

      <section class="editorial-card" style="margin-bottom:32px;border-color:var(--border-strong);">
        <div>
          <h2 style="margin:0 0 6px;">${t('explore.randomTitle')}</h2>
          <p>${t('explore.randomDesc')}</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <select id="rnd-genre" class="rate-select">
            <option value="">${t('filter.allGenres')}</option>
            ${genreOptions}
          </select>
          <select id="rnd-rating" class="rate-select">
            <option value="7.0">★ 7.0+</option>
            <option value="7.5">★ 7.5+</option>
            <option value="8.0">★ 8.0+</option>
          </select>
          <button type="button" class="btn btn-primary" id="rnd-pick-btn">🎲 ${t('explore.randomBtn')}</button>
        </div>
        <div id="rnd-result-slot"></div>
      </section>

      <section class="section-block">
        <div class="section-header"><h2 class="section-title">${t('explore.decades')}</h2></div>
        <div class="tabs-bar" id="decade-tabs">
          ${decades.map((d, i) => `
            <button type="button" class="tab-btn ${i === 0 ? 'active' : ''}" data-gte="${d.gte}" data-lte="${d.lte}">${d.label}</button>
          `).join('')}
        </div>
        <div id="decade-grid-slot"></div>
      </section>
    </div>
  `;

  document.getElementById('rnd-pick-btn').addEventListener('click', async () => {
    const slot = document.getElementById('rnd-result-slot');
    slot.innerHTML = '<p>Picking...</p>';
    const genre = document.getElementById('rnd-genre').value;
    const rating = document.getElementById('rnd-rating').value;
    const randomPage = Math.floor(Math.random() * 8) + 1;
    try {
      const data = await fetchTmdb('/discover/movie', {
        with_genres: genre,
        'vote_average.gte': rating,
        'vote_count.gte': 250,
        page: randomPage
      }, { noCache: true });
      const pool = data.results || [];
      if (!pool.length) {
        slot.innerHTML = `<p>${t('search.emptyTitle')}</p>`;
        return;
      }
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      slot.innerHTML = `<div style="max-width:220px;margin-top:14px;">${renderMediaCard(chosen, genreMap, 'movie')}</div>`;
    } catch (err) {
      slot.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
    }
  });

  async function loadDecade(gte, lte) {
    const slot = document.getElementById('decade-grid-slot');
    slot.innerHTML = '<p>Loading...</p>';
    const data = await fetchTmdb('/discover/movie', {
      'primary_release_date.gte': gte,
      'primary_release_date.lte': lte,
      'vote_count.gte': 500,
      sort_by: 'vote_average.desc'
    });
    slot.innerHTML = `<div class="media-grid">${(data.results || []).slice(0, 10).map((m) => renderMediaCard(m, genreMap, 'movie')).join('')}</div>`;
  }

  document.getElementById('decade-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-gte]');
    if (!btn) return;
    document.querySelectorAll('#decade-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    loadDecade(btn.dataset.gte, btn.dataset.lte);
  });

  await loadDecade(decades[0].gte, decades[0].lte);
}
