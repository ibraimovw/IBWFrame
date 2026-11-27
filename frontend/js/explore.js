import { getImageUrl, getMediaTitle, getMediaYear, tmdbApi } from './api.js';
import { EXPLORE_COUNTRIES, EXPLORE_DECADES, EXPLORE_MOODS } from './editorial.js';
import { icons } from './icons.js';
import { ensureGenresLoaded, state, t } from './store.js';
import { createMediaRail, escapeHtml, navigateTo } from './ui.js';

// Страница «Обзор»: случайный выбор фильма, настроения, десятилетия и страны
export function renderExplorePage(container, outerSignal) {
  const dict = t();
  let activeMoodId = EXPLORE_MOODS[0].id;
  let randMovie = null;
  let randLoading = false;
  let randError = false;

  container.innerHTML = `
    <div class="container page-stack page-enter">
      <div>
        <h1 class="page-title">${escapeHtml(dict.explore.title)}</h1>
        <p class="page-subtitle">${escapeHtml(dict.explore.subtitle)}</p>
      </div>

      <section class="explore-picker-card">
        <div style="max-width:560px;flex:1;">
          <div style="font-size:0.75rem;font-weight:700;color:var(--accent-red);text-transform:uppercase;letter-spacing:0.06em;">IBWFrame Picker</div>
          <h2 class="section-title" style="margin-top:6px;">${escapeHtml(dict.explore.randomTitle)}</h2>
          <p class="page-subtitle" style="margin-bottom:16px;">${escapeHtml(dict.explore.randomSubtitle)}</p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;">
            <select id="rand-genre" class="select-control" aria-label="${escapeHtml(dict.explore.randomGenre)}">
              <option value="">${escapeHtml(dict.catalog.filters.allGenres)}</option>
            </select>
            <select id="rand-rating" class="select-control" aria-label="${escapeHtml(dict.explore.randomRating)}">
              <option value="">${escapeHtml(dict.catalog.filters.anyRating)}</option>
              <option value="8">8.0+</option>
              <option value="7" selected>7.0+</option>
              <option value="6">6.0+</option>
            </select>
            <select id="rand-decade" class="select-control" aria-label="${escapeHtml(dict.explore.randomDecade)}">
              <option value="">${escapeHtml(dict.explore.anyDecade)}</option>
              ${EXPLORE_DECADES.map(
                (d) =>
                  `<option value="${d.id}">${escapeHtml(state.lang === 'ru' ? d.labelRu : d.labelEn)}</option>`
              ).join('')}
            </select>
          </div>

          <button type="button" id="rand-btn" class="btn btn-primary">
            ${icons.shuffle}
            <span id="rand-btn-text">${escapeHtml(dict.explore.randomAction)}</span>
          </button>
          <p id="rand-error" style="margin:10px 0 0;font-size:0.8rem;color:var(--accent-red);display:none;">${escapeHtml(dict.search.noResultsTitle)}</p>
        </div>

        <div id="rand-result-slot"></div>
      </section>

      <section>
        <h2 class="section-title" style="margin-bottom:14px;">${escapeHtml(dict.explore.moodsTitle)}</h2>
        <div class="cards-grid-4" id="mood-buttons" style="margin-bottom:24px;"></div>
        <div id="mood-rail-slot"></div>
      </section>

      <section>
        <h2 class="section-title" style="margin-bottom:14px;">${escapeHtml(dict.explore.decadesTitle)}</h2>
        <div class="genre-tiles-grid" id="decades-grid"></div>
      </section>

      <section>
        <h2 class="section-title" style="margin-bottom:14px;">${escapeHtml(dict.explore.countriesTitle)}</h2>
        <div class="cards-grid-4" id="countries-grid"></div>
      </section>

      <section id="explore-genres-sec" style="display:none;">
        <h2 class="section-title" style="margin-bottom:14px;">${escapeHtml(dict.explore.genresTitle)}</h2>
        <div class="genre-tiles-grid" id="explore-genres-grid"></div>
      </section>

      <div id="cult-rail-slot"></div>
    </div>
  `;

  const genreSelect = container.querySelector('#rand-genre');
  const ratingSelect = container.querySelector('#rand-rating');
  const decadeSelect = container.querySelector('#rand-decade');
  const randBtn = container.querySelector('#rand-btn');
  const randBtnText = container.querySelector('#rand-btn-text');
  const randErrEl = container.querySelector('#rand-error');
  const randSlot = container.querySelector('#rand-result-slot');
  const moodBtnsEl = container.querySelector('#mood-buttons');
  const moodRailSlot = container.querySelector('#mood-rail-slot');
  const cultRailSlot = container.querySelector('#cult-rail-slot');

  // Отрисовка карточки случайно выбранного фильма
  function renderRandomResult() {
    randErrEl.style.display = randError ? 'block' : 'none';
    randBtnText.textContent = randMovie ? dict.explore.randomAgain : dict.explore.randomAction;
    randSlot.innerHTML = '';
    if (!randMovie) return;

    const title = getMediaTitle(randMovie);
    const year = getMediaYear(randMovie);
    const poster = getImageUrl(randMovie.poster_path, 'w342');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'random-result-card';
    card.innerHTML = `
      <div class="random-result-poster">
        ${
          poster
            ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}" referrerpolicy="no-referrer" />`
            : `<div class="media-poster-fallback">${icons.film}</div>`
        }
      </div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="font-size:0.75rem;color:var(--text-muted);" class="tabular-nums">
            ${escapeHtml(year || '—')}
            ${randMovie.vote_average > 0 ? ` · ★ ${randMovie.vote_average.toFixed(1)}` : ''}
          </div>
          <h3 style="margin:4px 0 0;font-size:1rem;font-weight:800;color:var(--text-primary);">${escapeHtml(title)}</h3>
          ${
            randMovie.overview
              ? `<p style="margin:6px 0 0;font-size:0.78rem;color:var(--text-muted);line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(randMovie.overview)}</p>`
              : ''
          }
        </div>
        <div class="random-result-more">
          ${icons.info}
          <span>${escapeHtml(dict.home.moreDetails)}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => navigateTo(`/movie/${randMovie.id}`));
    randSlot.appendChild(card);
  }

  randBtn?.addEventListener('click', async () => {
    if (randLoading) return;
    randLoading = true;
    randError = false;
    randBtn.disabled = true;
    try {
      const params = { sort_by: 'popularity.desc', 'vote_count.gte': 150 };
      if (genreSelect.value) params.with_genres = genreSelect.value;
      if (ratingSelect.value) params['vote_average.gte'] = ratingSelect.value;
      if (decadeSelect.value) {
        const dec = EXPLORE_DECADES.find((d) => d.id === decadeSelect.value);
        if (dec) {
          params['primary_release_date.gte'] = dec.gte;
          params['primary_release_date.lte'] = dec.lte;
        }
      }
      const firstPage = await tmdbApi.discover('movie', { ...params, page: 1 }, state.lang);
      const maxPages = Math.min(firstPage.total_pages || 1, 15);
      const randPage = Math.max(1, Math.floor(Math.random() * maxPages) + 1);
      const res =
        randPage === 1
          ? firstPage
          : await tmdbApi.discover('movie', { ...params, page: randPage }, state.lang);
      const pool = res.results || [];
      if (pool.length === 0) {
        randMovie = null;
        randError = true;
      } else {
        randMovie = pool[Math.floor(Math.random() * pool.length)];
      }
    } catch {
      randError = true;
    } finally {
      randLoading = false;
      randBtn.disabled = false;
      renderRandomResult();
    }
  });

  // Переключатели подборок по настроению
  function renderMoodButtons() {
    moodBtnsEl.innerHTML = '';
    for (const mood of EXPLORE_MOODS) {
      const active = mood.id === activeMoodId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'genre-tile';
      btn.style.cssText = `flex-direction:column;align-items:flex-start;gap:4px;${
        active ? 'background:var(--accent-brand-gradient);border-color:transparent;color:#fff;' : ''
      }`;
      btn.innerHTML = `
        <div style="font-size:0.9rem;font-weight:800;">${escapeHtml(state.lang === 'ru' ? mood.titleRu : mood.titleEn)}</div>
        <div style="font-size:0.75rem;font-weight:500;opacity:0.8;">${escapeHtml(state.lang === 'ru' ? mood.descRu : mood.descEn)}</div>
      `;
      btn.addEventListener('click', () => {
        activeMoodId = mood.id;
        renderMoodButtons();
        loadMoodRail();
      });
      moodBtnsEl.appendChild(btn);
    }
  }

  async function loadMoodRail() {
    const mood = EXPLORE_MOODS.find((m) => m.id === activeMoodId) || EXPLORE_MOODS[0];
    moodRailSlot.innerHTML = '';
    moodRailSlot.appendChild(
      createMediaRail({
        title: state.lang === 'ru' ? mood.titleRu : mood.titleEn,
        loading: true,
      })
    );
    try {
      const res = await tmdbApi.discover('movie', mood.params, state.lang, outerSignal);
      if (outerSignal.aborted) return;
      moodRailSlot.innerHTML = '';
      moodRailSlot.appendChild(
        createMediaRail({
          title: state.lang === 'ru' ? mood.titleRu : mood.titleEn,
          items: res.results || [],
          explicitType: 'movie',
        })
      );
    } catch {
      // Оставляем слот пустым, если лента настроения не загрузилась
    }
  }

  // Культовые фильмы прошлых лет
  async function loadCultRail() {
    try {
      const res = await tmdbApi.discover(
        'movie',
        {
          sort_by: 'vote_average.desc',
          'vote_count.gte': 3500,
          'primary_release_date.lte': '2005-12-31',
        },
        state.lang,
        outerSignal
      );
      if (outerSignal.aborted) return;
      cultRailSlot.innerHTML = '';
      cultRailSlot.appendChild(
        createMediaRail({
          title: dict.explore.cultTitle,
          items: res.results || [],
          explicitType: 'movie',
        })
      );
    } catch {
      // Игнорируем ошибку, чтобы не ломать остальную страницу
    }
  }

  // Плитки десятилетий
  const decadesEl = container.querySelector('#decades-grid');
  for (const d of EXPLORE_DECADES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'genre-tile';
    btn.innerHTML = `<span>${escapeHtml(state.lang === 'ru' ? d.labelRu : d.labelEn)}</span>${icons.arrowRight}`;
    btn.addEventListener('click', () => navigateTo(`/movies?tab=all&year=${d.gte.slice(0, 4)}`));
    decadesEl.appendChild(btn);
  }

  // Плитки стран
  const countriesEl = container.querySelector('#countries-grid');
  for (const c of EXPLORE_COUNTRIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'genre-tile';
    btn.innerHTML = `<span>${escapeHtml(state.lang === 'ru' ? c.nameRu : c.nameEn)}</span><span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${c.code}</span>`;
    btn.addEventListener('click', () => navigateTo(`/movies?tab=all&country=${c.code}`));
    countriesEl.appendChild(btn);
  }

  ensureGenresLoaded(outerSignal).then(() => {
    if (outerSignal.aborted || state.movieGenres.length === 0) return;
    for (const g of state.movieGenres) {
      const opt = document.createElement('option');
      opt.value = String(g.id);
      opt.textContent = g.name;
      genreSelect.appendChild(opt);
    }
    const gSec = container.querySelector('#explore-genres-sec');
    const gGrid = container.querySelector('#explore-genres-grid');
    if (gSec && gGrid) {
      gSec.style.display = 'block';
      for (const g of state.movieGenres) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'genre-tile';
        btn.innerHTML = `<span>${escapeHtml(g.name)}</span>${icons.arrowRight}`;
        btn.addEventListener('click', () => navigateTo(`/movies?tab=all&genre=${g.id}`));
        gGrid.appendChild(btn);
      }
    }
  });

  renderMoodButtons();
  loadMoodRail();
  loadCultRail();
}
