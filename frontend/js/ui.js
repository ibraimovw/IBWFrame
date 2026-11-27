import { getImageUrl, getMediaTitle, getMediaType, getMediaYear } from './api.js';
import { WATCH_REGIONS } from './editorial.js';
import { icons } from './icons.js';
import {
  addToCollection,
  createCollection,
  getGenreName,
  isFavorite,
  registerToastHandler,
  removeFromCollection,
  setLang,
  setTheme,
  setWatchRegion,
  state,
  t,
  toggleFavorite,
  updateProfile,
} from './store.js';

// Безопасное экранирование текста для вставки в HTML
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Разметка логотипа IBWFrame
export function renderLogoHtml() {
  return `
    <span class="inline-logo" style="display:inline-flex;align-items:center;gap:10px;">
      <img src="/assets/favicon_55a6f23b.svg" alt="IBWFrame" class="brand-mark" />
      <span class="brand-wordmark">
        <span class="brand-ibw">IBW</span><span class="brand-frame">Frame</span>
      </span>
    </span>
  `;
}

// Всплывающие уведомления (toast) в правом нижнем углу
export function initToastSystem() {
  const root = document.getElementById('toast-root');
  registerToastHandler((message) => {
    if (!root) return;
    const item = document.createElement('div');
    item.className = 'toast-item';
    item.innerHTML = `<span class="toast-dot"></span><span>${escapeHtml(message)}</span>`;
    root.appendChild(item);
    window.setTimeout(() => {
      item.remove();
    }, 2800);
  });
}

let appNavigate = () => {};
export function setNavigator(fn) {
  appNavigate = fn;
}

export function navigateTo(path) {
  appNavigate(path);
}

// Делает первую букву категории заглавной
function capitalizeFirst(text) {
  const str = String(text || '').trim();
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Карточка фильма или сериала с постером, рейтингом и кнопкой «Избранное»
export function createMediaCard(item, { explicitType, userScore } = {}) {
  const dict = t();
  const type = explicitType || getMediaType(item);
  const title = getMediaTitle(item);
  const year = getMediaYear(item);
  const rating = typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : null;
  const posterUrl = getImageUrl(item.poster_path, 'w342');
  const firstGenreId = item.genre_ids?.[0] || item.genres?.[0]?.id;
  const rawGenre = firstGenreId ? getGenreName(firstGenreId) : item.genres?.[0]?.name || '';
  const fallbackType = type === 'tv' ? dict.detail.seriesType : dict.detail.movieType;
  const hoverCategory = capitalizeFirst(rawGenre || fallbackType);
  const fav = isFavorite(item.id, type);
  const targetUrl = type === 'tv' ? `/series/${item.id}` : `/movie/${item.id}`;

  const card = document.createElement('article');
  card.className = 'media-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.setAttribute('aria-label', title);

  card.innerHTML = `
    <div class="media-poster-wrap">
      ${
        posterUrl
          ? `<img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" class="media-poster-img" />`
          : `<div class="media-poster-fallback">${icons.film}<span>${escapeHtml(title)}</span></div>`
      }
      ${
        rating
          ? `<div class="media-rating-badge">${icons.star}<span class="tabular-nums">${rating}</span></div>`
          : ''
      }
      <button type="button" class="media-fav-btn ${fav ? 'is-active' : ''}" aria-label="${escapeHtml(fav ? dict.detail.favorited : dict.detail.favorite)}" title="${escapeHtml(fav ? dict.detail.favorited : dict.detail.favorite)}">
        ${fav ? icons.heartFill : icons.heart}
      </button>
      <div class="media-hover-overlay">
        <span>${escapeHtml(hoverCategory)}</span>
      </div>
    </div>
    <div class="media-card-body">
      <h3 class="media-card-title">${escapeHtml(title)}</h3>
      <div class="media-card-meta tabular-nums">
        <span>${escapeHtml(year || '—')}</span>
        <span>·</span>
        <span>${escapeHtml(type === 'tv' ? dict.detail.seriesType : dict.detail.movieType)}</span>
        ${userScore ? `<span class="user-score-pill">${userScore}/10</span>` : ''}
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.media-fav-btn')) return;
    navigateTo(targetUrl);
  });

  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest('.media-fav-btn')) return;
      e.preventDefault();
      navigateTo(targetUrl);
    }
  });

  const favBtn = card.querySelector('.media-fav-btn');
  favBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(item, type);
    const nowFav = isFavorite(item.id, type);
    favBtn.classList.toggle('is-active', nowFav);
    favBtn.innerHTML = nowFav ? icons.heartFill : icons.heart;
    favBtn.setAttribute('aria-label', nowFav ? dict.detail.favorited : dict.detail.favorite);
  });

  return card;
}

// Скелетон-заглушка на время загрузки сетки
export function createSkeletonGrid(count = 12) {
  const grid = document.createElement('div');
  grid.className = 'poster-grid';
  for (let i = 0; i < count; i += 1) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="skeleton-box skeleton-poster"></div>
      <div class="skeleton-box skeleton-line" style="width:76%"></div>
      <div class="skeleton-box skeleton-line" style="width:45%"></div>
    `;
    grid.appendChild(wrap);
  }
  return grid;
}

// Горизонтальная лента фильмов со стрелками прокрутки на ПК
export function createMediaRail({
  title,
  subtitle = '',
  items = [],
  explicitType,
  loading = false,
  actionLabel = '',
  onAction = null,
}) {
  const dict = t();
  const section = document.createElement('section');

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    <div>
      <h2 class="section-title">${escapeHtml(title)}</h2>
      ${subtitle ? `<p class="section-subtitle">${escapeHtml(subtitle)}</p>` : ''}
    </div>
  `;

  if (actionLabel && typeof onAction === 'function') {
    const linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    linkBtn.className = 'section-link';
    linkBtn.innerHTML = `<span>${escapeHtml(actionLabel)}</span>${icons.arrowRight}`;
    linkBtn.addEventListener('click', onAction);
    header.appendChild(linkBtn);
  }

  section.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'media-rail-wrap';

  const rail = document.createElement('div');
  rail.className = 'media-rail no-scrollbar';

  if (loading) {
    for (let i = 0; i < 8; i += 1) {
      const sk = document.createElement('div');
      sk.className = 'media-card';
      sk.style.flex = '0 0 184px';
      sk.innerHTML = `
        <div class="skeleton-box skeleton-poster"></div>
        <div class="skeleton-box skeleton-line" style="width:75%"></div>
      `;
      rail.appendChild(sk);
    }
    wrap.appendChild(rail);
  } else {
    for (const item of items) {
      rail.appendChild(createMediaCard(item, { explicitType }));
    }
    wrap.appendChild(rail);

    if (items.length > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'rail-scroll-btn rail-scroll-prev';
      prevBtn.setAttribute('aria-label', dict.home.scrollPrev);
      prevBtn.setAttribute('data-hidden', 'true');
      prevBtn.innerHTML = icons.chevronLeft;

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'rail-scroll-btn rail-scroll-next';
      nextBtn.setAttribute('aria-label', dict.home.scrollNext);
      nextBtn.setAttribute('data-hidden', 'true');
      nextBtn.innerHTML = icons.chevronRight;

      const syncArrows = () => {
        if (!rail.isConnected) return;
        const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
        const atStart = rail.scrollLeft <= 4;
        const atEnd = maxScroll <= 4 || rail.scrollLeft >= maxScroll - 4;
        prevBtn.setAttribute('data-hidden', atStart ? 'true' : 'false');
        nextBtn.setAttribute('data-hidden', atEnd ? 'true' : 'false');
      };

      const scrollByStep = (direction) => {
        const step = Math.max(320, Math.round(rail.clientWidth * 0.78));
        rail.scrollBy({ left: direction * step, behavior: 'smooth' });
      };

      prevBtn.addEventListener('click', () => scrollByStep(-1));
      nextBtn.addEventListener('click', () => scrollByStep(1));
      rail.addEventListener('scroll', syncArrows, { passive: true });

      if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(syncArrows);
        ro.observe(rail);
      } else {
        window.addEventListener('resize', syncArrows);
      }

      window.requestAnimationFrame(syncArrows);
      wrap.appendChild(prevBtn);
      wrap.appendChild(nextBtn);
    }
  }

  section.appendChild(wrap);
  return section;
}

// Блок пустого состояния (если список пуст или ничего не найдено)
export function createEmptyState({ title, description, actionLabel, onAction }) {
  const box = document.createElement('div');
  box.className = 'state-card';
  box.innerHTML = `
    <div class="state-icon">${icons.film}</div>
    <h3 class="state-title">${escapeHtml(title)}</h3>
    <p class="state-desc">${escapeHtml(description)}</p>
    ${actionLabel && onAction ? '<div class="state-actions"><button type="button" class="btn btn-primary" data-empty-action></button></div>' : ''}
  `;
  const btn = box.querySelector('[data-empty-action]');
  if (btn && onAction) {
    btn.textContent = actionLabel;
    btn.addEventListener('click', onAction);
  }
  return box;
}

// Блок ошибки с кнопкой повторной загрузки
export function createErrorState(error, onRetry) {
  const dict = t();
  const code = error?.code || 'BACKEND_ERROR';

  let title = dict.errors.backendTitle;
  let desc = dict.errors.backendDesc;
  let iconSvg = icons.alert;

  if (code === 'OFFLINE') {
    title = dict.errors.offlineTitle;
    desc = dict.errors.offlineDesc;
    iconSvg = icons.wifiOff;
  } else if (code === 'TMDB_NOT_CONFIGURED') {
    title = dict.errors.tmdbConfigTitle;
    desc = dict.errors.tmdbConfigDesc;
  } else if (code === 'RATE_LIMIT') {
    title = dict.errors.rateLimitTitle;
    desc = dict.errors.rateLimitDesc;
  }

  const box = document.createElement('div');
  box.className = 'state-card';
  box.innerHTML = `
    <div class="state-icon">${iconSvg}</div>
    <h3 class="state-title">${escapeHtml(title)}</h3>
    <p class="state-desc">${escapeHtml(desc)}</p>
    ${onRetry ? `<div class="state-actions"><button type="button" class="btn btn-primary" data-retry>${escapeHtml(dict.errors.retry)}</button></div>` : ''}
  `;
  const btn = box.querySelector('[data-retry]');
  if (btn && onRetry) {
    btn.addEventListener('click', onRetry);
  }
  return box;
}

// Базовые помощники для открытия и закрытия модальных окон
function closeModalRoot() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function mountModal({ contentHtml, wide = false, backdropClass = '', dismissible = true, onMount }) {
  const root = document.getElementById('modal-root');
  if (!root) return closeModalRoot;

  root.innerHTML = `
    <div class="modal-backdrop ${backdropClass}" role="dialog" aria-modal="true">
      <div class="modal-panel ${wide ? 'modal-panel-wide' : ''}">
        ${contentHtml}
      </div>
    </div>
  `;

  const backdrop = root.querySelector('.modal-backdrop');
  const panel = root.querySelector('.modal-panel');

  const cleanup = () => {
    document.removeEventListener('keydown', onEsc);
    closeModalRoot();
  };

  const onEsc = (e) => {
    if (e.key === 'Escape' && dismissible) cleanup();
  };

  if (dismissible) {
    backdrop?.addEventListener('click', cleanup);
    panel?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('keydown', onEsc);
  } else {
    panel?.addEventListener('click', (e) => e.stopPropagation());
  }

  if (onMount) onMount(panel, cleanup);
  return cleanup;
}

// Модальное окно с YouTube-трейлером и кнопкой перехода на весь экран
export function openTrailerModal({ youtubeKey, title, youtubeSearchUrl = '' }) {
  const dict = t();
  const embedUrl = youtubeKey
    ? `https://www.youtube.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1&rel=0&fs=1`
    : '';
  const directYtUrl = youtubeKey
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeKey)}`
    : youtubeSearchUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title || ''} trailer`)}`;

  mountModal({
    wide: true,
    backdropClass: 'is-trailer-backdrop',
    contentHtml: `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;border-bottom:1px solid #27272a;color:#fff;">
        <h3 style="margin:0;font-size:1rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</h3>
        <button type="button" class="modal-close-btn" data-close aria-label="${escapeHtml(dict.detail.closeModal)}">${icons.x}</button>
      </div>
      <div class="trailer-frame-wrap" data-trailer-wrap>
        ${
          embedUrl
            ? `<iframe src="${embedUrl}" title="${escapeHtml(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
            : `<div style="width:100%;height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;color:#e4e4e7;">
                <p style="margin:0;max-width:440px;font-size:0.92rem;line-height:1.5;">${escapeHtml(dict.detail.trailerUnavailable)}</p>
                <a href="${escapeHtml(directYtUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                  ${icons.play}
                  <span>${escapeHtml(dict.detail.findTrailerOnYoutube)}</span>
                  ${icons.externalLink}
                </a>
              </div>`
        }
      </div>
      <div class="trailer-hint-bar">
        <span>${escapeHtml(dict.detail.trailerFullscreenTip)}</span>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex-shrink:0;">
          <a href="${escapeHtml(directYtUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="height:34px;padding:0 12px;font-size:0.78rem;">
            ${icons.externalLink}
            <span>${escapeHtml(dict.detail.openOnYoutube)}</span>
          </a>
          ${
            embedUrl
              ? `<button type="button" class="btn btn-secondary" data-fullscreen style="height:34px;padding:0 12px;font-size:0.78rem;">
                  ${icons.maximize}
                  <span>${escapeHtml(dict.detail.fullscreenBtn)}</span>
                </button>`
              : ''
          }
        </div>
      </div>
    `,
    onMount(panel, cleanup) {
      const wrap = panel.querySelector('[data-trailer-wrap]');
      const iframe = wrap?.querySelector('iframe');
      const requestFs = () => {
        const target = iframe || wrap;
        if (!target) return;
        const fn =
          target.requestFullscreen ||
          target.webkitRequestFullscreen ||
          target.mozRequestFullScreen ||
          target.msRequestFullscreen;
        if (fn) {
          try {
            fn.call(target);
          } catch {
            // Браузер может ограничивать полноэкранный режим внутри встроенного окна
          }
        }
      };

      const onKeyF = (e) => {
        if (!panel.isConnected) {
          document.removeEventListener('keydown', onKeyF);
          return;
        }
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          requestFs();
        }
      };
      document.addEventListener('keydown', onKeyF);

      panel.querySelector('[data-fullscreen]')?.addEventListener('click', requestFs);
      panel.querySelector('[data-close]')?.addEventListener('click', () => {
        document.removeEventListener('keydown', onKeyF);
        cleanup();
      });
    },
  });
}

// Окно подтверждения опасного действия (например, удаления коллекции)
export function openConfirmModal({ title, body, confirmLabel, cancelLabel, onConfirm }) {
  mountModal({
    contentHtml: `
      <h3 class="modal-title">${escapeHtml(title)}</h3>
      <p style="margin:10px 0 0;font-size:0.875rem;color:var(--text-muted);line-height:1.55;">${escapeHtml(body)}</p>
      <div style="margin-top:22px;display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" class="btn btn-secondary" data-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn btn-primary" data-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    `,
    onMount(panel, cleanup) {
      panel.querySelector('[data-cancel]')?.addEventListener('click', cleanup);
      panel.querySelector('[data-confirm]')?.addEventListener('click', () => {
        cleanup();
        onConfirm();
      });
    },
  });
}

// Модальное окно добавления фильма или сериала в личную коллекцию
export function openCollectionPickerModal(mediaItem) {
  const dict = t();
  const renderPickerContent = (panel, cleanup) => {
    const listHtml =
      state.customCollections.length === 0
        ? `<p style="font-size:0.875rem;color:var(--text-muted);margin:10px 0;">${escapeHtml(dict.collections.noCollectionsPicker)}</p>`
        : state.customCollections
            .map((col) => {
              const added = col.items.some(
                (i) => i.id === mediaItem.id && i.mediaType === mediaItem.mediaType
              );
              return `
                <button type="button" data-toggle-col="${escapeHtml(col.id)}" class="btn ${added ? 'btn-active-soft' : 'btn-secondary'}" style="width:100%;justify-content:space-between;margin-bottom:8px;">
                  <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(col.name)}</span>
                  <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;">
                    <span>${col.items.length}</span>
                    ${added ? icons.check : icons.plus}
                  </span>
                </button>
              `;
            })
            .join('');

    panel.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(dict.collections.pickerTitle)}</h3>
        <button type="button" class="modal-close-btn" data-close aria-label="${escapeHtml(dict.detail.closeModal)}">${icons.x}</button>
      </div>
      <div style="max-height:240px;overflow-y:auto;margin-bottom:14px;">${listHtml}</div>
      <form data-create-inline style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border-subtle);">
        <input type="text" class="input-control" data-new-name placeholder="${escapeHtml(dict.collections.namePlaceholder)}" maxlength="60" required />
        <button type="submit" class="btn btn-primary">${escapeHtml(dict.collections.createInline)}</button>
      </form>
    `;

    panel.querySelector('[data-close]')?.addEventListener('click', cleanup);
    panel.querySelectorAll('[data-toggle-col]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const colId = btn.getAttribute('data-toggle-col');
        const col = state.customCollections.find((c) => c.id === colId);
        if (!col) return;
        const added = col.items.some(
          (i) => i.id === mediaItem.id && i.mediaType === mediaItem.mediaType
        );
        if (added) {
          removeFromCollection(colId, mediaItem.id, mediaItem.mediaType);
        } else {
          addToCollection(colId, mediaItem, mediaItem.mediaType);
        }
        renderPickerContent(panel, cleanup);
      });
    });

    panel.querySelector('[data-create-inline]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = panel.querySelector('[data-new-name]');
      const name = input?.value.trim() || '';
      if (!name) return;
      const created = createCollection(name);
      addToCollection(created.id, mediaItem, mediaItem.mediaType);
      renderPickerContent(panel, cleanup);
    });
  };

  mountModal({
    contentHtml: '',
    onMount(panel, cleanup) {
      renderPickerContent(panel, cleanup);
    },
  });
}

// Стартовое окно приветствия при первом визите
export function openWelcomeModal() {
  const renderWelcome = (panel, cleanup) => {
    const dict = t();
    panel.innerHTML = `
      <div style="margin-bottom:18px;">${renderLogoHtml()}</div>
      <h2 class="modal-title" style="font-size:1.35rem;">${escapeHtml(dict.welcome.modalTitle)}</h2>
      <p style="margin:6px 0 0;font-size:0.875rem;color:var(--text-muted);">${escapeHtml(dict.welcome.modalPrompt)}</p>
      <form data-welcome-form style="margin-top:18px;display:flex;flex-direction:column;gap:16px;">
        <div>
          <label class="field-label" for="welcome-name-input">${escapeHtml(dict.profile.displayName)}</label>
          <input id="welcome-name-input" type="text" class="input-control" placeholder="${escapeHtml(dict.welcome.namePlaceholder)}" maxlength="40" value="${escapeHtml(state.profile.name || '')}" autofocus />
          <p data-name-error style="margin:6px 0 0;font-size:0.75rem;color:var(--accent-red);display:none;">${escapeHtml(dict.welcome.nameRequired)}</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <span class="field-label">${escapeHtml(dict.welcome.languageLabel)}</span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <button type="button" data-set-lang="en" class="btn ${state.lang === 'en' ? 'btn-primary' : 'btn-secondary'}" style="height:36px;padding:0 10px;font-size:0.75rem;">EN</button>
              <button type="button" data-set-lang="ru" class="btn ${state.lang === 'ru' ? 'btn-primary' : 'btn-secondary'}" style="height:36px;padding:0 10px;font-size:0.75rem;">RU</button>
            </div>
          </div>
          <div>
            <span class="field-label">${escapeHtml(dict.welcome.themeLabel)}</span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <button type="button" data-set-theme="dark" class="btn ${state.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" style="height:36px;padding:0 8px;font-size:0.75rem;">${icons.moon}</button>
              <button type="button" data-set-theme="light" class="btn ${state.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" style="height:36px;padding:0 8px;font-size:0.75rem;">${icons.sun}</button>
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%;height:42px;">${escapeHtml(dict.welcome.continueBtn)}</button>
      </form>
    `;

    const nameInput = panel.querySelector('#welcome-name-input');
    const nameError = panel.querySelector('[data-name-error]');

    panel.querySelectorAll('[data-set-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const draftName = nameInput?.value || '';
        setLang(btn.getAttribute('data-set-lang'));
        renderWelcome(panel, cleanup);
        const refreshedInput = panel.querySelector('#welcome-name-input');
        if (refreshedInput) refreshedInput.value = draftName;
      });
    });

    panel.querySelectorAll('[data-set-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const draftName = nameInput?.value || '';
        setTheme(btn.getAttribute('data-set-theme'));
        renderWelcome(panel, cleanup);
        const refreshedInput = panel.querySelector('#welcome-name-input');
        if (refreshedInput) refreshedInput.value = draftName;
      });
    });

    panel.querySelector('[data-welcome-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (nameInput?.value || '').trim();
      if (!val) {
        if (nameError) nameError.style.display = 'block';
        nameInput?.focus();
        return;
      }
      updateProfile({ name: val, onboarded: true });
      cleanup();
    });
  };

  mountModal({
    dismissible: false,
    contentHtml: '',
    onMount(panel, cleanup) {
      renderWelcome(panel, cleanup);
    },
  });
}

// Окно личного профиля со статистикой и выбором региона
export function openProfileModal() {
  const dict = t();
  const regionsHtml = WATCH_REGIONS.map(
    (r) =>
      `<option value="${r.code}" ${r.code === state.watchRegion ? 'selected' : ''}>${escapeHtml(
        state.lang === 'ru' ? r.nameRu : r.nameEn
      )}</option>`
  ).join('');

  mountModal({
    contentHtml: `
      <div class="modal-header">
        <div>
          <h2 class="modal-title">${escapeHtml(dict.profile.title)}</h2>
          <p style="margin:4px 0 0;font-size:0.78rem;color:var(--text-muted);">${escapeHtml(dict.profile.subtitle)}</p>
        </div>
        <button type="button" class="modal-close-btn" data-close aria-label="${escapeHtml(dict.detail.closeModal)}">${icons.x}</button>
      </div>

      <div class="stats-grid-5" style="margin-bottom:18px;">
        <div class="stat-tile"><div class="stat-tile-num tabular-nums">${state.watchlist.length}</div><div class="stat-tile-label">${escapeHtml(dict.profile.statsWatchlist)}</div></div>
        <div class="stat-tile"><div class="stat-tile-num tabular-nums">${state.watched.length}</div><div class="stat-tile-label">${escapeHtml(dict.profile.statsWatched)}</div></div>
        <div class="stat-tile"><div class="stat-tile-num tabular-nums">${state.favorites.length}</div><div class="stat-tile-label">${escapeHtml(dict.profile.statsFavorites)}</div></div>
        <div class="stat-tile"><div class="stat-tile-num tabular-nums">${Object.keys(state.ratings).length}</div><div class="stat-tile-label">${escapeHtml(dict.profile.statsRatings)}</div></div>
        <div class="stat-tile"><div class="stat-tile-num tabular-nums">${state.customCollections.length}</div><div class="stat-tile-label">${escapeHtml(dict.profile.statsCollections)}</div></div>
      </div>

      <form data-profile-form style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="field-label" for="profile-name-input">${escapeHtml(dict.profile.displayName)}</label>
          <input id="profile-name-input" type="text" class="input-control" maxlength="40" value="${escapeHtml(state.profile.name)}" placeholder="${escapeHtml(dict.welcome.namePlaceholder)}" required />
        </div>

        <div>
          <label class="field-label" for="profile-region-select">${escapeHtml(dict.profile.regionLabel)}</label>
          <select id="profile-region-select" class="select-control">${regionsHtml}</select>
        </div>

        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;padding-top:6px;">
          <button type="button" class="btn btn-secondary" data-open-lib>${escapeHtml(dict.profile.openLibrary)}</button>
          <button type="submit" class="btn btn-primary">${escapeHtml(dict.profile.save)}</button>
        </div>
      </form>
    `,
    onMount(panel, cleanup) {
      panel.querySelector('[data-close]')?.addEventListener('click', cleanup);
      panel.querySelector('[data-open-lib]')?.addEventListener('click', () => {
        cleanup();
        navigateTo('/library');
      });
      panel.querySelector('[data-profile-form]')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameVal = (panel.querySelector('#profile-name-input')?.value || '').trim();
        const regVal = panel.querySelector('#profile-region-select')?.value || state.watchRegion;
        if (nameVal) {
          updateProfile({ name: nameVal, onboarded: true });
        }
        setWatchRegion(regVal);
        cleanup();
      });
    },
  });
}
