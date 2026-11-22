import { getImageUrl, fetchTmdb } from './api.js';
import { isInList, toggleMediaInList } from './storage.js';
import { t } from './i18n.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2800);
}

export function openModal(html, { wide = false, locked = false } = {}) {
  const backdrop = document.getElementById('modal-backdrop');
  const win = document.getElementById('modal-window');
  const content = document.getElementById('modal-content');
  const closeBtn = document.getElementById('modal-close');

  win.classList.toggle('modal-wide', wide);
  closeBtn.classList.toggle('hidden', locked);
  backdrop.dataset.locked = locked ? '1' : '0';
  content.innerHTML = html;
  backdrop.classList.remove('hidden');
}

export function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  const content = document.getElementById('modal-content');
  if (backdrop.dataset.locked === '1') return;
  backdrop.classList.add('hidden');
  content.innerHTML = ''; // Останавливает воспроизведение YouTube iframe
}

export function renderSkeletonGrid(count = 10) {
  return `<div class="media-grid">${Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-poster"></div>
      <div class="skeleton-line"></div>
    </div>
  `).join('')}</div>`;
}

export function renderMediaCard(item, genreMap = {}, forcedType = null) {
  const mediaType = forcedType || item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const title = item.title || item.name || 'Untitled';
  const dateStr = item.release_date || item.first_air_date || '';
  const year = dateStr ? dateStr.slice(0, 4) : '—';
  const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : 'NR';
  const poster = getImageUrl(item.poster_path, 'w342');
  const isFav = isInList('favorites', item.id, mediaType);
  const genresText = (item.genre_ids || [])
    .slice(0, 2)
    .map((id) => genreMap[id])
    .filter(Boolean)
    .join(' • ');

  const href = mediaType === 'tv' ? `/series/${item.id}` : `/movie/${item.id}`;
  const payload = escapeHtml(JSON.stringify({
    id: item.id,
    media_type: mediaType,
    title,
    poster_path: item.poster_path || null,
    vote_average: item.vote_average || 0,
    release_date: dateStr,
    genre_ids: item.genre_ids || []
  }));

  return `
    <article class="media-card">
      <button type="button" class="card-fav-btn ${isFav ? 'active' : ''}" data-fav-payload="${payload}" aria-label="Favorite">
        ${isFav ? '♥' : '♡'}
      </button>
      <a href="${href}" data-link class="card-poster-wrap">
        <span class="card-rating-badge">★ ${rating}</span>
        <img class="card-poster" src="${poster}" alt="${escapeHtml(title)}" loading="lazy"
             onerror="this.onerror=null;this.src='/assets/poster-fallback.svg';" />
        <div class="card-overlay">
          <span class="card-genres">${escapeHtml(genresText || (mediaType === 'tv' ? 'Series' : 'Movie'))}</span>
        </div>
      </a>
      <div class="card-body">
        <h3 class="card-title"><a href="${href}" data-link>${escapeHtml(title)}</a></h3>
        <div class="card-meta">${year} • ${mediaType === 'tv' ? 'TV' : 'Movie'}</div>
      </div>
    </article>
  `;
}

export async function openTrailerModal(mediaType, id) {
  openModal(`<p style="text-align:center;padding:30px;">Loading trailer...</p>`, { wide: true });
  try {
    let data = await fetchTmdb(`/${mediaType}/${id}/videos`);
    let videos = data.results || [];
    if (!videos.length) {
      const enData = await fetchTmdb(`/${mediaType}/${id}/videos`, { language: 'en-US' });
      videos = enData.results || [];
    }
    const trailer = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
      || videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
      || videos.find((v) => v.site === 'YouTube');

    if (!trailer || !trailer.key) {
      openModal(`<div class="state-box"><h3>${t('home.watchTrailer')}</h3><p>${t('details.noTrailer')}</p></div>`);
      return;
    }

    openModal(`
      <div class="video-frame-wrap">
        <iframe
          src="https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0"
          title="${escapeHtml(trailer.name || 'Trailer')}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    `, { wide: true });
  } catch {
    openModal(`<div class="state-box"><h3>${t('error.title')}</h3><p>${t('details.noTrailer')}</p></div>`);
  }
}

export function bindGlobalCardActions() {
  document.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav-payload]');
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      const item = JSON.parse(favBtn.getAttribute('data-fav-payload'));
      const added = toggleMediaInList('favorites', item);
      favBtn.classList.toggle('active', added);
      favBtn.textContent = added ? '♥' : '♡';
      showToast(added ? t('toast.added') : t('toast.removed'));
    }
  });
}
