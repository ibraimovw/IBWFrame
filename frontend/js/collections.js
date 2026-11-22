import { tmdbApi } from './api.js';
import { EDITORIAL_COLLECTIONS } from './editorial.js';
import { icons } from './icons.js';
import {
  createCollection,
  deleteCollection,
  removeFromCollection,
  state,
  t,
} from './store.js';
import {
  createEmptyState,
  createErrorState,
  createMediaCard,
  createSkeletonGrid,
  escapeHtml,
  navigateTo,
  openConfirmModal,
} from './ui.js';

function openCreateCollectionModal() {
  const dict = t();
  const root = document.getElementById('modal-root');
  if (!root) return;

  root.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-panel">
        <div class="modal-header">
          <h3 class="modal-title">${escapeHtml(dict.collections.createTitle)}</h3>
          <button type="button" class="modal-close-btn" data-close aria-label="${escapeHtml(dict.detail.closeModal)}">${icons.x}</button>
        </div>
        <form data-create-col-form style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label class="field-label" for="col-name-input">${escapeHtml(dict.collections.nameLabel)}</label>
            <input id="col-name-input" type="text" class="input-control" placeholder="${escapeHtml(dict.collections.namePlaceholder)}" maxlength="60" required autofocus />
          </div>
          <div>
            <label class="field-label" for="col-desc-input">${escapeHtml(dict.collections.descLabel)}</label>
            <textarea id="col-desc-input" class="textarea-control" rows="3" maxlength="200" placeholder="${escapeHtml(dict.collections.descPlaceholder)}"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" data-cancel>${escapeHtml(dict.collections.cancelBtn)}</button>
            <button type="submit" class="btn btn-primary">${escapeHtml(dict.collections.saveBtn)}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => {
    root.innerHTML = '';
  };

  root.querySelector('.modal-backdrop')?.addEventListener('click', close);
  root.querySelector('.modal-panel')?.addEventListener('click', (e) => e.stopPropagation());
  root.querySelector('[data-close]')?.addEventListener('click', close);
  root.querySelector('[data-cancel]')?.addEventListener('click', close);
  root.querySelector('[data-create-col-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = root.querySelector('#col-name-input')?.value.trim() || '';
    const desc = root.querySelector('#col-desc-input')?.value.trim() || '';
    if (!name) return;
    const created = createCollection(name, desc);
    close();
    navigateTo(`/collections/custom/${created.id}`);
  });
}

export function renderCollectionsPage(container, { editorialSlug, customId } = {}, outerSignal) {
  const dict = t();

  // 1. Editorial detail
  if (editorialSlug) {
    const editorial = EDITORIAL_COLLECTIONS.find((c) => c.slug === editorialSlug);
    if (!editorial) {
      container.innerHTML = '<div class="container page-stack" id="col-not-found"></div>';
      container.querySelector('#col-not-found')?.appendChild(
        createEmptyState({
          title: dict.errors.notFoundTitle,
          description: dict.errors.notFoundDesc,
          actionLabel: dict.collections.title,
          onAction: () => navigateTo('/collections'),
        })
      );
      return;
    }

    container.innerHTML = `
      <div class="container page-stack page-enter">
        <div>
          <button type="button" class="btn btn-ghost" data-back style="height:32px;padding:0 10px;font-size:0.8rem;">
            ${icons.arrowLeft}
            <span>${escapeHtml(dict.collections.title)}</span>
          </button>
        </div>

        <div class="editorial-card ${editorial.toneClass}" style="min-height:auto;cursor:default;">
          <h1 class="editorial-card-title" style="font-size:2rem;">${escapeHtml(state.lang === 'ru' ? editorial.titleRu : editorial.titleEn)}</h1>
          <p class="editorial-card-desc" style="font-size:0.95rem;max-width:680px;">${escapeHtml(state.lang === 'ru' ? editorial.descRu : editorial.descEn)}</p>
        </div>

        <div id="editorial-items-slot"></div>
      </div>
    `;

    container.querySelector('[data-back]')?.addEventListener('click', () => navigateTo('/collections'));
    const slot = container.querySelector('#editorial-items-slot');

    const loadEd = async () => {
      slot.innerHTML = '';
      slot.appendChild(createSkeletonGrid(12));
      try {
        const res = await tmdbApi.discover('movie', editorial.discoverParams, state.lang, outerSignal);
        if (outerSignal.aborted) return;
        slot.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'poster-grid';
        for (const item of res.results || []) {
          grid.appendChild(createMediaCard(item, { explicitType: 'movie' }));
        }
        slot.appendChild(grid);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        slot.innerHTML = '';
        slot.appendChild(createErrorState(err, loadEd));
      }
    };

    loadEd();
    return;
  }

  // 2. Custom collection detail
  if (customId) {
    const col = state.customCollections.find((c) => c.id === customId);
    if (!col) {
      container.innerHTML = '<div class="container page-stack" id="col-not-found"></div>';
      container.querySelector('#col-not-found')?.appendChild(
        createEmptyState({
          title: dict.errors.notFoundTitle,
          description: dict.errors.notFoundDesc,
          actionLabel: dict.collections.title,
          onAction: () => navigateTo('/collections'),
        })
      );
      return;
    }

    container.innerHTML = `
      <div class="container page-stack page-enter">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
          <button type="button" class="btn btn-ghost" data-back style="height:32px;padding:0 10px;font-size:0.8rem;">
            ${icons.arrowLeft}
            <span>${escapeHtml(dict.collections.title)}</span>
          </button>
          <button type="button" class="btn btn-danger-outline" data-delete-col>
            ${icons.trash}
            <span>${escapeHtml(dict.collections.deleteBtn)}</span>
          </button>
        </div>

        <div>
          <h1 class="page-title">${escapeHtml(col.name)}</h1>
          ${col.description ? `<p class="page-subtitle">${escapeHtml(col.description)}</p>` : ''}
          <p class="page-subtitle tabular-nums">${col.items.length} ${escapeHtml(dict.collections.titlesCount)}</p>
        </div>

        <div id="custom-col-items"></div>
      </div>
    `;

    container.querySelector('[data-back]')?.addEventListener('click', () => navigateTo('/collections'));
    container.querySelector('[data-delete-col]')?.addEventListener('click', () => {
      openConfirmModal({
        title: dict.collections.deleteConfirmTitle,
        body: dict.collections.deleteConfirmBody,
        confirmLabel: dict.collections.confirmDelete,
        cancelLabel: dict.collections.cancelBtn,
        onConfirm: () => {
          deleteCollection(col.id);
          navigateTo('/collections');
        },
      });
    });

    const itemsSlot = container.querySelector('#custom-col-items');
    if (col.items.length === 0) {
      itemsSlot.appendChild(
        createEmptyState({
          title: dict.collections.title,
          description: dict.collections.emptyCollectionItems,
          actionLabel: dict.collections.browseMovies,
          onAction: () => navigateTo('/movies'),
        })
      );
    } else {
      const grid = document.createElement('div');
      grid.className = 'poster-grid';
      for (const item of col.items) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        wrap.appendChild(createMediaCard(item));
        const remBtn = document.createElement('button');
        remBtn.type = 'button';
        remBtn.className = 'btn btn-ghost';
        remBtn.style.cssText = 'height:28px;padding:0 6px;justify-content:flex-start;font-size:0.75rem;';
        remBtn.textContent = dict.collections.removeItem;
        remBtn.addEventListener('click', () => {
          removeFromCollection(col.id, item.id, item.mediaType);
          renderCollectionsPage(container, { customId }, outerSignal);
        });
        wrap.appendChild(remBtn);
        grid.appendChild(wrap);
      }
      itemsSlot.appendChild(grid);
    }
    return;
  }

  // 3. Overview (Editorial + Custom Collections)
  container.innerHTML = `
    <div class="container page-stack page-enter">
      <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;">
        <div>
          <h1 class="page-title">${escapeHtml(dict.collections.title)}</h1>
          <p class="page-subtitle">${escapeHtml(dict.collections.subtitle)}</p>
        </div>
        <button type="button" class="btn btn-primary" data-create-col>
          ${icons.plus}
          <span>${escapeHtml(dict.collections.createBtn)}</span>
        </button>
      </div>

      <section>
        <h2 class="section-title" style="margin-bottom:16px;">${escapeHtml(dict.collections.editorialTab)}</h2>
        <div class="cards-grid-3" id="editorial-list"></div>
      </section>

      <section>
        <h2 class="section-title" style="margin-bottom:16px;">${escapeHtml(dict.collections.myTab)}</h2>
        <div id="custom-list"></div>
      </section>
    </div>
  `;

  container.querySelector('[data-create-col]')?.addEventListener('click', openCreateCollectionModal);

  const edList = container.querySelector('#editorial-list');
  for (const col of EDITORIAL_COLLECTIONS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `editorial-card ${col.toneClass}`;
    card.innerHTML = `
      <div>
        <h3 class="editorial-card-title">${escapeHtml(state.lang === 'ru' ? col.titleRu : col.titleEn)}</h3>
        <p class="editorial-card-desc">${escapeHtml(state.lang === 'ru' ? col.descRu : col.descEn)}</p>
      </div>
      <div class="editorial-card-cta"><span>${escapeHtml(dict.home.seeAll)}</span>${icons.arrowRight}</div>
    `;
    card.addEventListener('click', () => navigateTo(`/collections/${col.slug}`));
    edList.appendChild(card);
  }

  const customList = container.querySelector('#custom-list');
  if (state.customCollections.length === 0) {
    customList.appendChild(
      createEmptyState({
        title: dict.collections.emptyCustomTitle,
        description: dict.collections.emptyCustomDesc,
        actionLabel: dict.collections.createBtn,
        onAction: openCreateCollectionModal,
      })
    );
  } else {
    const grid = document.createElement('div');
    grid.className = 'cards-grid-3';
    for (const col of state.customCollections) {
      const card = document.createElement('div');
      card.className = 'collection-card';
      card.innerHTML = `
        <div style="cursor:pointer;" data-open-col>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
            <h3 style="margin:0;font-size:1.1rem;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(col.name)}</h3>
            <span class="tabular-nums" style="font-size:0.75rem;color:var(--text-muted);flex-shrink:0;">${col.items.length} ${escapeHtml(dict.collections.titlesCount)}</span>
          </div>
          ${col.description ? `<p style="margin:6px 0 0;font-size:0.82rem;color:var(--text-muted);">${escapeHtml(col.description)}</p>` : ''}
        </div>
        <div style="padding-top:12px;border-top:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;">
          <button type="button" class="section-link" data-open-col>${escapeHtml(dict.home.seeAll)}${icons.arrowRight}</button>
          <button type="button" class="btn btn-ghost" data-del-col style="width:32px;height:32px;padding:0;" aria-label="${escapeHtml(dict.collections.deleteBtn)}">${icons.trash}</button>
        </div>
      `;
      card.querySelectorAll('[data-open-col]').forEach((el) => {
        el.addEventListener('click', () => navigateTo(`/collections/custom/${col.id}`));
      });
      card.querySelector('[data-del-col]')?.addEventListener('click', () => {
        openConfirmModal({
          title: dict.collections.deleteConfirmTitle,
          body: dict.collections.deleteConfirmBody,
          confirmLabel: dict.collections.confirmDelete,
          cancelLabel: dict.collections.cancelBtn,
          onConfirm: () => {
            deleteCollection(col.id);
            renderCollectionsPage(container, {}, outerSignal);
          },
        });
      });
      grid.appendChild(card);
    }
    customList.appendChild(grid);
  }
}

export function renderLibraryPage(container) {
  const dict = t();
  let activeTab = 'watchlist';

  const render = () => {
    const ratingEntries = Object.values(state.ratings).sort((a, b) => b.updatedAt - a.updatedAt);
    const tabs = [
      { id: 'watchlist', label: dict.library.tabs.watchlist, count: state.watchlist.length, icon: icons.bookmark },
      { id: 'watched', label: dict.library.tabs.watched, count: state.watched.length, icon: icons.check },
      { id: 'favorites', label: dict.library.tabs.favorites, count: state.favorites.length, icon: icons.heart },
      { id: 'ratings', label: dict.library.tabs.ratings, count: ratingEntries.length, icon: icons.star },
      { id: 'collections', label: dict.library.tabs.collections, count: state.customCollections.length, icon: icons.layers },
    ];

    container.innerHTML = `
      <div class="container page-stack page-enter">
        <div>
          <h1 class="page-title">${escapeHtml(dict.library.title)}</h1>
          <p class="page-subtitle">${escapeHtml(dict.library.subtitle)}</p>
        </div>

        <div class="tabs-row no-scrollbar" id="library-tabs"></div>
        <div id="library-content"></div>
      </div>
    `;

    const tabsEl = container.querySelector('#library-tabs');
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab-btn ${activeTab === tab.id ? 'is-active' : ''}`;
      btn.innerHTML = `${tab.icon}<span>${escapeHtml(tab.label)}</span><span class="tabular-nums" style="opacity:0.78;">${tab.count}</span>`;
      btn.addEventListener('click', () => {
        activeTab = tab.id;
        render();
      });
      tabsEl.appendChild(btn);
    }

    const contentEl = container.querySelector('#library-content');

    const renderList = (list, emptyTitle, emptyDesc, isRatings = false) => {
      if (list.length === 0) {
        contentEl.appendChild(
          createEmptyState({
            title: emptyTitle,
            description: emptyDesc,
            actionLabel: dict.library.findMoviesBtn,
            onAction: () => navigateTo('/movies'),
          })
        );
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'poster-grid';
      for (const entry of list) {
        if (isRatings) {
          grid.appendChild(createMediaCard(entry.item, { userScore: entry.score }));
        } else {
          grid.appendChild(createMediaCard(entry));
        }
      }
      contentEl.appendChild(grid);
    };

    if (activeTab === 'watchlist') {
      renderList(state.watchlist, dict.library.emptyWatchlistTitle, dict.library.emptyWatchlistDesc);
    } else if (activeTab === 'watched') {
      renderList(state.watched, dict.library.emptyWatchedTitle, dict.library.emptyWatchedDesc);
    } else if (activeTab === 'favorites') {
      renderList(state.favorites, dict.library.emptyFavoritesTitle, dict.library.emptyFavoritesDesc);
    } else if (activeTab === 'ratings') {
      renderList(ratingEntries, dict.library.emptyRatingsTitle, dict.library.emptyRatingsDesc, true);
    } else if (activeTab === 'collections') {
      if (state.customCollections.length === 0) {
        contentEl.appendChild(
          createEmptyState({
            title: dict.collections.emptyCustomTitle,
            description: dict.collections.emptyCustomDesc,
            actionLabel: dict.collections.createBtn,
            onAction: () => navigateTo('/collections'),
          })
        );
      } else {
        const grid = document.createElement('div');
        grid.className = 'cards-grid-3';
        for (const col of state.customCollections) {
          const card = document.createElement('div');
          card.className = 'collection-card';
          card.innerHTML = `
            <div style="cursor:pointer;" data-open-col>
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                <h3 style="margin:0;font-size:1.1rem;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(col.name)}</h3>
                <span class="tabular-nums" style="font-size:0.75rem;color:var(--text-muted);flex-shrink:0;">${col.items.length} ${escapeHtml(dict.collections.titlesCount)}</span>
              </div>
              ${col.description ? `<p style="margin:6px 0 0;font-size:0.82rem;color:var(--text-muted);">${escapeHtml(col.description)}</p>` : ''}
            </div>
            <div style="padding-top:12px;border-top:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;">
              <button type="button" class="section-link" data-open-col>${escapeHtml(dict.home.seeAll)}${icons.arrowRight}</button>
              <button type="button" class="btn btn-ghost" data-del-col style="width:32px;height:32px;padding:0;" aria-label="${escapeHtml(dict.collections.deleteBtn)}">${icons.trash}</button>
            </div>
          `;
          card.querySelectorAll('[data-open-col]').forEach((el) => {
            el.addEventListener('click', () => navigateTo(`/collections/custom/${col.id}`));
          });
          card.querySelector('[data-del-col]')?.addEventListener('click', () => {
            openConfirmModal({
              title: dict.collections.deleteConfirmTitle,
              body: dict.collections.deleteConfirmBody,
              confirmLabel: dict.collections.confirmDelete,
              cancelLabel: dict.collections.cancelBtn,
              onConfirm: () => {
                deleteCollection(col.id);
                render();
              },
            });
          });
          grid.appendChild(card);
        }
        contentEl.appendChild(grid);
      }
    }
  };

  render();
}
