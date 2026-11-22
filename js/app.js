(() => {
  const IMG_BASE = 'https://image.tmdb.org/t/p';
  const FALLBACK_POSTER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><rect width="500" height="750" fill="#1a2030"/><text x="50%" y="50%" fill="#7c879e" font-family="sans-serif" font-size="24" text-anchor="middle">No Poster</text></svg>'
  );

  const state = {
    lang: localStorage.getItem('ibwframe_lang') || 'ru-RU',
    watchlist: JSON.parse(localStorage.getItem('ibwframe_watchlist') || '[]')
  };

  const appEl = document.getElementById('app');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const langToggle = document.getElementById('langToggle');
  const watchlistCountEl = document.getElementById('watchlistCount');
  const trailerModal = document.getElementById('trailerModal');
  const trailerContainer = document.getElementById('trailerContainer');
  const toastContainer = document.getElementById('toastContainer');

  function showToast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function updateWatchlistBadge() {
    watchlistCountEl.textContent = String(state.watchlist.length);
  }

  function isInWatchlist(id, mediaType) {
    return state.watchlist.some((item) => item.id === Number(id) && item.media_type === mediaType);
  }

  function toggleWatchlist(item) {
    const idx = state.watchlist.findIndex(
      (entry) => entry.id === Number(item.id) && entry.media_type === item.media_type
    );
    if (idx >= 0) {
      state.watchlist.splice(idx, 1);
      showToast('Удалено из избранного');
    } else {
      state.watchlist.unshift({
        id: Number(item.id),
        media_type: item.media_type,
        title: item.title || item.name || 'Без названия',
        poster_path: item.poster_path || '',
        vote_average: item.vote_average || 0,
        release_date: item.release_date || item.first_air_date || ''
      });
      showToast('Добавлено в избранное');
    }
    localStorage.setItem('ibwframe_watchlist', JSON.stringify(state.watchlist));
    updateWatchlistBadge();
  }

  async function apiGet(path, params = {}) {
    const url = new URL(`/api/tmdb${path}`, window.location.origin);
    url.searchParams.set('language', state.lang);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.status_message || `Ошибка сервера (${res.status})`);
    }
    return data;
  }

  function posterUrl(path, size = 'w500') {
    return path ? `${IMG_BASE}/${size}${path}` : FALLBACK_POSTER;
  }

  function backdropUrl(path) {
    return path ? `${IMG_BASE}/original${path}` : '';
  }

  function formatYear(dateStr) {
    return dateStr ? String(dateStr).slice(0, 4) : '—';
  }

  function formatRating(num) {
    return typeof num === 'number' && num > 0 ? num.toFixed(1) : 'NR';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderSkeletons(count = 10) {
    return `<div class="cards-grid">${Array.from({ length: count })
      .map(() => '<div class="skeleton-card"></div>')
      .join('')}</div>`;
  }

  function renderMediaCard(item, forcedType) {
    const mediaType = forcedType || item.media_type || (item.first_air_date ? 'tv' : 'movie');
    if (mediaType === 'person') {
      return `
        <article class="card">
          <a href="/person/${item.id}" data-link class="card-poster-wrap">
            <img class="card-poster" src="${posterUrl(item.profile_path)}" alt="${escapeHtml(item.name)}" loading="lazy" />
          </a>
          <div class="card-body">
            <a href="/person/${item.id}" data-link class="card-title">${escapeHtml(item.name)}</a>
            <div class="card-sub">${escapeHtml(item.known_for_department || 'Персона')}</div>
          </div>
        </article>
      `;
    }

    const title = item.title || item.name || 'Без названия';
    const year = formatYear(item.release_date || item.first_air_date);
    const active = isInWatchlist(item.id, mediaType) ? 'active' : '';
    const payload = encodeURIComponent(
      JSON.stringify({
        id: item.id,
        media_type: mediaType,
        title,
        poster_path: item.poster_path || '',
        vote_average: item.vote_average || 0,
        release_date: item.release_date || item.first_air_date || ''
      })
    );

    return `
      <article class="card">
        <div class="card-poster-wrap">
          <span class="card-rating">★ ${formatRating(item.vote_average)}</span>
          <button class="card-fav-btn ${active}" data-fav="${payload}" title="В избранное" aria-label="В избранное">♥</button>
          <a href="/${mediaType}/${item.id}" data-link>
            <img class="card-poster" src="${posterUrl(item.poster_path)}" alt="${escapeHtml(title)}" loading="lazy" />
          </a>
        </div>
        <div class="card-body">
          <a href="/${mediaType}/${item.id}" data-link class="card-title">${escapeHtml(title)}</a>
          <div class="card-sub">${mediaType === 'tv' ? 'Сериал' : 'Фильм'} • ${year}</div>
        </div>
      </article>
    `;
  }

  function openTrailer(videoKey) {
    if (!videoKey) {
      showToast('Трейлер для этого тайтла не найден');
      return;
    }
    trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(
      videoKey
    )}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    trailerModal.classList.add('open');
    trailerModal.setAttribute('aria-hidden', 'false');
  }

  function closeTrailer() {
    trailerModal.classList.remove('open');
    trailerModal.setAttribute('aria-hidden', 'true');
    trailerContainer.innerHTML = '';
  }

  function pickBestTrailer(videos = []) {
    return (
      videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
      videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
      videos.find((v) => v.site === 'YouTube') ||
      null
    );
  }

  async function renderHome() {
    appEl.innerHTML = `
      <div class="container section">
        ${renderSkeletons(10)}
      </div>
    `;

    try {
      const [trending, popularMovies, topRated, popularTv] = await Promise.all([
        apiGet('/trending/all/week'),
        apiGet('/movie/popular'),
        apiGet('/movie/top_rated'),
        apiGet('/tv/popular')
      ]);

      const featured = (trending.results || []).find((x) => x.backdrop_path) || trending.results?.[0];
      const featuredType = featured?.media_type === 'tv' ? 'tv' : 'movie';
      const featuredTitle = featured ? featured.title || featured.name : 'IBWFrame';

      appEl.innerHTML = `
        ${
          featured
            ? `
          <section class="hero" style="background-image: url('${backdropUrl(featured.backdrop_path)}')">
            <div class="container">
              <div class="hero-content">
                <div class="hero-tag">В тренде недели</div>
                <h1 class="hero-title">${escapeHtml(featuredTitle)}</h1>
                <div class="hero-meta">
                  <span class="rating-pill">★ ${formatRating(featured.vote_average)}</span>
                  <span>${featuredType === 'tv' ? 'Сериал' : 'Фильм'}</span>
                  <span>${formatYear(featured.release_date || featured.first_air_date)}</span>
                </div>
                <p class="hero-overview">${escapeHtml(featured.overview || 'Описание скоро появится.')}</p>
                <div class="btn-group">
                  <a href="/${featuredType}/${featured.id}" data-link class="btn btn-primary">Подробнее</a>
                  <button class="btn btn-secondary" data-play-hero="${featuredType}:${featured.id}">▶ Смотреть трейлер</button>
                </div>
              </div>
            </div>
          </section>
        `
            : ''
        }

        <div class="container">
          <section class="section">
            <div class="section-header">
              <h2 class="section-title">В тренде сейчас</h2>
            </div>
            <div class="cards-grid">
              ${(trending.results || []).slice(0, 10).map((item) => renderMediaCard(item)).join('')}
            </div>
          </section>

          <section class="section">
            <div class="section-header">
              <h2 class="section-title">Популярные фильмы</h2>
              <a href="/movies" data-link class="nav-link">Смотреть все →</a>
            </div>
            <div class="cards-grid">
              ${(popularMovies.results || []).slice(0, 10).map((item) => renderMediaCard(item, 'movie')).join('')}
            </div>
          </section>

          <section class="section">
            <div class="section-header">
              <h2 class="section-title">Высокий рейтинг</h2>
            </div>
            <div class="cards-grid">
              ${(topRated.results || []).slice(0, 10).map((item) => renderMediaCard(item, 'movie')).join('')}
            </div>
          </section>

          <section class="section">
            <div class="section-header">
              <h2 class="section-title">Популярные сериалы</h2>
              <a href="/tv" data-link class="nav-link">Смотреть все →</a>
            </div>
            <div class="cards-grid">
              ${(popularTv.results || []).slice(0, 10).map((item) => renderMediaCard(item, 'tv')).join('')}
            </div>
          </section>
        </div>
      `;
    } catch (err) {
      appEl.innerHTML = `
        <div class="container">
          <div class="state-box">
            <h3>Не удалось загрузить каталог</h3>
            <p>${escapeHtml(err.message)}</p>
          </div>
        </div>
      `;
    }
  }

  async function renderCatalog(mediaType, urlParams) {
    const page = Math.max(1, Number(urlParams.get('page') || 1));
    const genre = urlParams.get('genre') || '';
    const sortBy = urlParams.get('sort_by') || 'popularity.desc';
    const year = urlParams.get('year') || '';

    appEl.innerHTML = `<div class="container section">${renderSkeletons(15)}</div>`;

    try {
      const discoverParams = {
        page,
        sort_by: sortBy,
        'vote_count.gte': sortBy === 'vote_average.desc' ? 150 : 10
      };
      if (genre) discoverParams.with_genres = genre;
      if (year) {
        if (mediaType === 'tv') discoverParams.first_air_date_year = year;
        else discoverParams.primary_release_year = year;
      }

      const [genresData, listData] = await Promise.all([
        apiGet(`/genre/${mediaType}/list`),
        apiGet(`/discover/${mediaType}`, discoverParams)
      ]);

      const genres = genresData.genres || [];
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: 35 }, (_, i) => currentYear - i);

      appEl.innerHTML = `
        <div class="container section">
          <div class="section-header">
            <h1 class="section-title">${mediaType === 'tv' ? 'Каталог сериалов' : 'Каталог фильмов'}</h1>
          </div>

          <div class="filters-bar">
            <select class="filter-select" id="filterGenre">
              <option value="">Все жанры</option>
              ${genres
                .map(
                  (g) =>
                    `<option value="${g.id}" ${String(g.id) === genre ? 'selected' : ''}>${escapeHtml(
                      g.name
                    )}</option>`
                )
                .join('')}
            </select>

            <select class="filter-select" id="filterYear">
              <option value="">Любой год</option>
              ${years
                .map((y) => `<option value="${y}" ${String(y) === year ? 'selected' : ''}>${y}</option>`)
                .join('')}
            </select>

            <select class="filter-select" id="filterSort">
              <option value="popularity.desc" ${sortBy === 'popularity.desc' ? 'selected' : ''}>По популярности</option>
              <option value="vote_average.desc" ${sortBy === 'vote_average.desc' ? 'selected' : ''}>По рейтингу</option>
              <option value="${
                mediaType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc'
              }" ${sortBy.includes('date.desc') ? 'selected' : ''}>Сначала новые</option>
            </select>
          </div>

          ${
            (listData.results || []).length
              ? `<div class="cards-grid">${listData.results
                  .map((item) => renderMediaCard(item, mediaType))
                  .join('')}</div>`
              : `<div class="state-box"><h3>Ничего не найдено</h3><p>Попробуйте изменить параметры фильтрации.</p></div>`
          }

          <div class="pagination">
            <button class="btn btn-secondary" id="prevPage" ${page <= 1 ? 'disabled' : ''}>← Назад</button>
            <span>Страница ${page} из ${Math.min(listData.total_pages || 1, 500)}</span>
            <button class="btn btn-secondary" id="nextPage" ${
              page >= Math.min(listData.total_pages || 1, 500) ? 'disabled' : ''
            }>Вперёд →</button>
          </div>
        </div>
      `;

      const applyFilters = (nextPage = 1) => {
        const next = new URLSearchParams();
        const gVal = document.getElementById('filterGenre').value;
        const yVal = document.getElementById('filterYear').value;
        const sVal = document.getElementById('filterSort').value;
        if (gVal) next.set('genre', gVal);
        if (yVal) next.set('year', yVal);
        if (sVal) next.set('sort_by', sVal);
        if (nextPage > 1) next.set('page', String(nextPage));
        navigate(`/${mediaType === 'tv' ? 'tv' : 'movies'}?${next.toString()}`);
      };

      document.getElementById('filterGenre').addEventListener('change', () => applyFilters(1));
      document.getElementById('filterYear').addEventListener('change', () => applyFilters(1));
      document.getElementById('filterSort').addEventListener('change', () => applyFilters(1));
      document.getElementById('prevPage')?.addEventListener('click', () => applyFilters(page - 1));
      document.getElementById('nextPage')?.addEventListener('click', () => applyFilters(page + 1));
    } catch (err) {
      appEl.innerHTML = `<div class="container"><div class="state-box"><h3>Ошибка загрузки</h3><p>${escapeHtml(
        err.message
      )}</p></div></div>`;
    }
  }

  async function renderSearch(urlParams) {
    const query = (urlParams.get('q') || '').trim();
    const page = Math.max(1, Number(urlParams.get('page') || 1));

    if (!query) {
      appEl.innerHTML = `<div class="container"><div class="state-box"><h3>Введите поисковый запрос</h3><p>Воспользуйтесь строкой поиска в шапке сайта.</p></div></div>`;
      return;
    }

    appEl.innerHTML = `<div class="container section">${renderSkeletons(10)}</div>`;

    try {
      const data = await apiGet('/search/multi', { query, page, include_adult: false });
      const items = data.results || [];

      appEl.innerHTML = `
        <div class="container section">
          <div class="section-header">
            <h1 class="section-title">Результаты по запросу: «${escapeHtml(query)}»</h1>
          </div>

          ${
            items.length
              ? `<div class="cards-grid">${items.map((item) => renderMediaCard(item)).join('')}</div>`
              : `<div class="state-box"><h3>Ничего не найдено</h3><p>Попробуйте другое название на русском или английском языке.</p></div>`
          }

          ${
            (data.total_pages || 1) > 1
              ? `
            <div class="pagination">
              <button class="btn btn-secondary" id="searchPrev" ${page <= 1 ? 'disabled' : ''}>← Назад</button>
              <span>Страница ${page} из ${Math.min(data.total_pages, 500)}</span>
              <button class="btn btn-secondary" id="searchNext" ${
                page >= Math.min(data.total_pages, 500) ? 'disabled' : ''
              }>Вперёд →</button>
            </div>
          `
              : ''
          }
        </div>
      `;

      document.getElementById('searchPrev')?.addEventListener('click', () =>
        navigate(`/search?q=${encodeURIComponent(query)}&page=${page - 1}`)
      );
      document.getElementById('searchNext')?.addEventListener('click', () =>
        navigate(`/search?q=${encodeURIComponent(query)}&page=${page + 1}`)
      );
    } catch (err) {
      appEl.innerHTML = `<div class="container"><div class="state-box"><h3>Ошибка поиска</h3><p>${escapeHtml(
        err.message
      )}</p></div></div>`;
    }
  }

  async function renderDetails(mediaType, id) {
    appEl.innerHTML = `<div class="container section">${renderSkeletons(6)}</div>`;

    try {
      const [details, credits, videosData, similar] = await Promise.all([
        apiGet(`/${mediaType}/${id}`),
        apiGet(`/${mediaType}/${id}/credits`),
        apiGet(`/${mediaType}/${id}/videos`),
        apiGet(`/${mediaType}/${id}/similar`)
      ]);

      const title = details.title || details.name || 'Без названия';
      const dateStr = details.release_date || details.first_air_date || '';
      const runtime = details.runtime
        ? `${details.runtime} мин`
        : details.number_of_seasons
        ? `Сезонов: ${details.number_of_seasons}`
        : '';
      const trailer = pickBestTrailer(videosData.results || []);
      const inFav = isInWatchlist(details.id, mediaType);
      const favPayload = encodeURIComponent(
        JSON.stringify({
          id: details.id,
          media_type: mediaType,
          title,
          poster_path: details.poster_path || '',
          vote_average: details.vote_average || 0,
          release_date: dateStr
        })
      );

      appEl.innerHTML = `
        <section class="details-hero" style="background-image: url('${backdropUrl(details.backdrop_path)}')">
          <div class="container details-grid">
            <img class="details-poster" src="${posterUrl(details.poster_path)}" alt="${escapeHtml(title)}" />
            <div>
              <h1 class="hero-title">${escapeHtml(title)}</h1>
              <div class="hero-meta">
                <span class="rating-pill">★ ${formatRating(details.vote_average)} (${details.vote_count || 0})</span>
                <span>${formatYear(dateStr)}</span>
                ${runtime ? `<span>${escapeHtml(runtime)}</span>` : ''}
              </div>

              <div class="genres-list">
                ${(details.genres || [])
                  .map((g) => `<span class="genre-chip">${escapeHtml(g.name)}</span>`)
                  .join('')}
              </div>

              <p class="hero-overview" style="-webkit-line-clamp: unset;">${escapeHtml(
                details.overview || 'Описание для этого тайтла пока не добавлено.'
              )}</p>

              <div class="btn-group">
                <button class="btn btn-primary" id="watchTrailerBtn">▶ Смотреть трейлер</button>
                <button class="btn btn-secondary ${inFav ? 'in-watchlist' : ''}" data-fav-detail="${favPayload}">
                  ${inFav ? '✓ В избранном' : '+ В избранное'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div class="container">
          ${
            (credits.cast || []).length
              ? `
            <section class="section">
              <div class="section-header">
                <h2 class="section-title">В главных ролях</h2>
              </div>
              <div class="cast-grid">
                ${credits.cast
                  .slice(0, 12)
                  .map(
                    (actor) => `
                  <a href="/person/${actor.id}" data-link class="cast-card">
                    <img class="cast-photo" src="${posterUrl(actor.profile_path, 'w300')}" alt="${escapeHtml(
                      actor.name
                    )}" loading="lazy" />
                    <div class="cast-info">
                      <div class="cast-name">${escapeHtml(actor.name)}</div>
                      <div class="cast-role">${escapeHtml(actor.character || '')}</div>
                    </div>
                  </a>
                `
                  )
                  .join('')}
              </div>
            </section>
          `
              : ''
          }

          ${
            (similar.results || []).length
              ? `
            <section class="section">
              <div class="section-header">
                <h2 class="section-title">Похожие тайтлы</h2>
              </div>
              <div class="cards-grid">
                ${similar.results.slice(0, 10).map((item) => renderMediaCard(item, mediaType)).join('')}
              </div>
            </section>
          `
              : ''
          }
        </div>
      `;

      document.getElementById('watchTrailerBtn')?.addEventListener('click', () => {
        openTrailer(trailer?.key);
      });
    } catch (err) {
      appEl.innerHTML = `<div class="container"><div class="state-box"><h3>Не удалось загрузить страницу</h3><p>${escapeHtml(
        err.message
      )}</p></div></div>`;
    }
  }

  async function renderPerson(id) {
    appEl.innerHTML = `<div class="container section">${renderSkeletons(6)}</div>`;
    try {
      const [person, credits] = await Promise.all([
        apiGet(`/person/${id}`),
        apiGet(`/person/${id}/combined_credits`)
      ]);

      const knownFor = (credits.cast || [])
        .filter((x) => x.poster_path)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 12);

      appEl.innerHTML = `
        <section class="details-hero">
          <div class="container details-grid">
            <img class="details-poster" src="${posterUrl(person.profile_path)}" alt="${escapeHtml(person.name)}" />
            <div>
              <h1 class="hero-title">${escapeHtml(person.name)}</h1>
              <div class="hero-meta">
                ${person.birthday ? `<span>Дата рождения: ${escapeHtml(person.birthday)}</span>` : ''}
                ${person.place_of_birth ? `<span>${escapeHtml(person.place_of_birth)}</span>` : ''}
              </div>
              <p class="hero-overview" style="-webkit-line-clamp: unset;">${escapeHtml(
                person.biography || 'Биография пока недоступна.'
              )}</p>
            </div>
          </div>
        </section>

        <div class="container section">
          <div class="section-header">
            <h2 class="section-title">Известные работы</h2>
          </div>
          <div class="cards-grid">
            ${knownFor.map((item) => renderMediaCard(item)).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      appEl.innerHTML = `<div class="container"><div class="state-box"><h3>Ошибка загрузки профиля</h3><p>${escapeHtml(
        err.message
      )}</p></div></div>`;
    }
  }

  function renderWatchlist() {
    appEl.innerHTML = `
      <div class="container section">
        <div class="section-header">
          <h1 class="section-title">Мой список избранного (${state.watchlist.length})</h1>
        </div>
        ${
          state.watchlist.length
            ? `<div class="cards-grid">${state.watchlist
                .map((item) => renderMediaCard(item, item.media_type))
                .join('')}</div>`
            : `<div class="state-box"><h3>Список избранного пуст</h3><p>Нажимайте на сердечко ♥ на карточках фильмов и сериалов, чтобы сохранять их сюда.</p></div>`
        }
      </div>
    `;
  }

  function updateActiveNav(pathname) {
    document.querySelectorAll('.nav-link').forEach((link) => {
      const route = link.getAttribute('data-route');
      const active =
        (route === 'home' && pathname === '/') ||
        (route === 'movies' && pathname.startsWith('/movies')) ||
        (route === 'tv' && pathname.startsWith('/tv') && !/^\/tv\/\d+/.test(pathname)) ||
        (route === 'watchlist' && pathname.startsWith('/watchlist'));
      link.classList.toggle('active', Boolean(active));
    });
  }

  function router() {
    const url = new URL(window.location.href);
    const pathname = url.pathname;
    updateActiveNav(pathname);

    if (pathname === '/' || pathname === '/index.html') {
      renderHome();
    } else if (pathname === '/movies') {
      renderCatalog('movie', url.searchParams);
    } else if (pathname === '/tv') {
      renderCatalog('tv', url.searchParams);
    } else if (pathname === '/search') {
      renderSearch(url.searchParams);
    } else if (pathname === '/watchlist') {
      renderWatchlist();
    } else if (/^\/movie\/\d+$/.test(pathname)) {
      renderDetails('movie', pathname.split('/')[2]);
    } else if (/^\/tv\/\d+$/.test(pathname)) {
      renderDetails('tv', pathname.split('/')[2]);
    } else if (/^\/person\/\d+$/.test(pathname)) {
      renderPerson(pathname.split('/')[2]);
    } else {
      appEl.innerHTML = `<div class="container"><div class="state-box"><h3>Страница не найдена</h3><p><a href="/" data-link class="btn btn-primary" style="margin-top:12px;">На главную</a></p></div></div>`;
    }
  }

  function navigate(to) {
    window.history.pushState({}, '', to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    router();
  }

  // Global event delegation
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      navigate(link.getAttribute('href'));
      return;
    }

    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      const item = JSON.parse(decodeURIComponent(favBtn.getAttribute('data-fav')));
      toggleWatchlist(item);
      favBtn.classList.toggle('active', isInWatchlist(item.id, item.media_type));
      if (window.location.pathname === '/watchlist') renderWatchlist();
      return;
    }

    const favDetailBtn = e.target.closest('[data-fav-detail]');
    if (favDetailBtn) {
      const item = JSON.parse(decodeURIComponent(favDetailBtn.getAttribute('data-fav-detail')));
      toggleWatchlist(item);
      const inFav = isInWatchlist(item.id, item.media_type);
      favDetailBtn.classList.toggle('in-watchlist', inFav);
      favDetailBtn.textContent = inFav ? '✓ В избранном' : '+ В избранное';
      return;
    }

    const playHero = e.target.closest('[data-play-hero]');
    if (playHero) {
      const [type, id] = playHero.getAttribute('data-play-hero').split(':');
      try {
        const videosData = await apiGet(`/${type}/${id}/videos`);
        const trailer = pickBestTrailer(videosData.results || []);
        openTrailer(trailer?.key);
      } catch (err) {
        showToast(err.message);
      }
      return;
    }

    if (e.target.closest('[data-close-modal]')) {
      closeTrailer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && trailerModal.classList.contains('open')) {
      closeTrailer();
    }
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  });

  langToggle.textContent = state.lang.startsWith('en') ? 'EN' : 'RU';
  langToggle.addEventListener('click', () => {
    state.lang = state.lang === 'ru-RU' ? 'en-US' : 'ru-RU';
    localStorage.setItem('ibwframe_lang', state.lang);
    langToggle.textContent = state.lang.startsWith('en') ? 'EN' : 'RU';
    router();
  });

  window.addEventListener('popstate', router);

  updateWatchlistBadge();
  router();
})();
