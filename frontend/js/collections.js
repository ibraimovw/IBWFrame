import { fetchTmdb, getGenreMap } from './api.js';
import { getStore, updateStore } from './storage.js';
import { t } from './i18n.js';
import { renderMediaCard, openModal, closeModal, showToast, escapeHtml } from './ui.js';

const PRESETS = {
  scifi: { titleEn: 'Best Sci-Fi Worlds', titleRu: 'Лучшая научная фантастика', params: { with_genres: '878', 'vote_average.gte': 7.5, 'vote_count.gte': 800, sort_by: 'vote_average.desc' } },
  thrillers: { titleEn: 'Greatest Thrillers', titleRu: 'Культовые триллеры', params: { with_genres: '53', 'vote_average.gte': 7.5, 'vote_count.gte': 800, sort_by: 'vote_average.desc' } },
  'hidden-gems': { titleEn: 'Hidden Gems', titleRu: 'Скрытые жемчужины', params: { 'vote_average.gte': 7.8, 'vote_count.gte': 150, sort_by: 'vote_average.desc' } },
  action: { titleEn: 'Action Classics', titleRu: 'Классика экшена', params: { with_genres: '28', 'vote_average.gte': 7.4, 'vote_count.gte': 1000, sort_by: 'popularity.desc' } }
};

export async function renderCollectionsPage(container) {
  const isRu = document.documentElement.lang === 'ru';
  const urlParams = new URLSearchParams(window.location.search);
  let activePreset = urlParams.get('preset') || 'scifi';
  if (!PRESETS[activePreset]) activePreset = 'scifi';

  const genreMap = await getGenreMap('movie');

  function renderUserCollections() {
    const store = getStore();
    if (!store.collections.length) {
      return `<div class="state-box"><p>${t('collections.emptyMine')}</p></div>`;
    }
    return `<div class="editorial-grid">
      ${store.collections.map((c) => `
        <div class="editorial-card">
          <div>
            <h3>${escapeHtml(c.title)}</h3>
            <p>${escapeHtml(c.description || '')}</p>
            <div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted);">${c.items.length} items</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" data-del-col="${c.id}">✕</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  container.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1 class="page-title">${t('nav.collections')}</h1>
      </div>

      <section class="section-block">
        <div class="section-header"><h2 class="section-title">${t('collections.editorial')}</h2></div>
        <div class="tabs-bar" id="preset-tabs">
          ${Object.entries(PRESETS).map(([key, val]) => `
            <button type="button" class="tab-btn ${activePreset === key ? 'active' : ''}" data-preset="${key}">
              ${escapeHtml(isRu ? val.titleRu : val.titleEn)}
            </button>
          `).join('')}
        </div>
        <div id="preset-grid-slot"></div>
      </section>

      <section class="section-block">
        <div class="section-header">
          <h2 class="section-title">${t('collections.mine')}</h2>
          <button type="button" class="btn btn-primary btn-sm" id="create-col-btn">${t('collections.createBtn')}</button>
        </div>
        <div id="user-cols-slot">${renderUserCollections()}</div>
      </section>
    </div>
  `;

  async function loadPreset(key) {
    const slot = document.getElementById('preset-grid-slot');
    slot.innerHTML = '<p>Loading...</p>';
    const data = await fetchTmdb('/discover/movie', PRESETS[key].params);
    slot.innerHTML = `<div class="media-grid">${(data.results || []).slice(0, 10).map((m) => renderMediaCard(m, genreMap, 'movie')).join('')}</div>`;
  }

  document.getElementById('preset-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    document.querySelectorAll('#preset-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    loadPreset(btn.dataset.preset);
  });

  document.getElementById('create-col-btn').addEventListener('click', () => {
    openModal(`
      <h2 style="margin-top:0;">${t('collections.createBtn')}</h2>
      <form id="new-col-form">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="col-title-input" class="form-input" required maxlength="60" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="col-desc-input" class="form-input" rows="3" maxlength="200"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">${t('profile.save')}</button>
      </form>
    `);

    document.getElementById('new-col-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('col-title-input').value.trim();
      const description = document.getElementById('col-desc-input').value.trim();
      if (!title) return;
      updateStore((s) => {
        s.collections.unshift({ id: String(Date.now()), title, description, items: [] });
        return s;
      });
      closeModal();
      document.getElementById('user-cols-slot').innerHTML = renderUserCollections();
      showToast(t('toast.saved'));
    });
  });

  document.getElementById('user-cols-slot').addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-del-col]');
    if (!delBtn) return;
    if (!confirm(t('collections.deleteConfirm'))) return;
    const id = delBtn.dataset.delCol;
    updateStore((s) => {
      s.collections = s.collections.filter((c) => c.id !== id);
      return s;
    });
    document.getElementById('user-cols-slot').innerHTML = renderUserCollections();
    showToast(t('toast.removed'));
  });

  await loadPreset(activePreset);
}

export async function renderMyLibraryPage(container) {
  let activeTab = 'watchlist';
  const genreMap = await getGenreMap('movie');

  function renderBody() {
    const store = getStore();
    if (activeTab === 'ratings') {
      const entries = Object.entries(store.ratings);
      if (!entries.length) {
        return `<div class="state-box"><h3>${t('library.emptyTitle')}</h3><p>${t('library.emptyDesc')}</p><a href="/movies" data-link class="btn btn-primary">${t('library.goExplore')}</a></div>`;
      }
      return `<div class="editorial-grid">${entries.map(([key, score]) => {
        const [type, id] = key.split('_');
        const href = type === 'tv' ? `/series/${id}` : `/movie/${id}`;
        return `<a href="${href}" data-link class="editorial-card"><strong>${type.toUpperCase()} #${id}</strong><span style="color:var(--rating-gold);font-weight:700;">★ ${score} / 10</span></a>`;
      }).join('')}</div>`;
    }

    const items = store[activeTab] || [];
    if (!items.length) {
      return `
        <div class="state-box">
          <h3>${t('library.emptyTitle')}</h3>
          <p>${t('library.emptyDesc')}</p>
          <a href="/movies" data-link class="btn btn-primary">${t('library.goExplore')}</a>
        </div>
      `;
    }
    return `<div class="media-grid">${items.map((item) => renderMediaCard(item, genreMap, item.media_type)).join('')}</div>`;
  }

  container.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1 class="page-title">${t('library.title')}</h1>
        <div class="tabs-bar" id="lib-tabs">
          <button type="button" class="tab-btn active" data-tab="watchlist">${t('library.watchlist')}</button>
          <button type="button" class="tab-btn" data-tab="watched">${t('library.watched')}</button>
          <button type="button" class="tab-btn" data-tab="favorites">${t('library.favorites')}</button>
          <button type="button" class="tab-btn" data-tab="ratings">${t('library.ratings')}</button>
        </div>
      </div>
      <div id="lib-body-slot">${renderBody()}</div>
    </div>
  `;

  document.getElementById('lib-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#lib-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    document.getElementById('lib-body-slot').innerHTML = renderBody();
  });
}
