import { renderCollectionsPage, renderLibraryPage } from './collections.js';
import { renderDetailPage } from './detail.js';
import { initInteractiveEffects } from './effects.js';
import { renderExplorePage } from './explore.js';
import { renderHomePage } from './home.js';
import { icons } from './icons.js';
import { renderCatalogPage } from './movies.js';
import { renderPeoplePage, renderPersonDetailPage } from './people.js';
import { createRouter, matchRoute } from './router.js';
import { attachHeaderSearchBehavior, renderSearchPage } from './search.js';
import { setLang, state, subscribe, t, toggleTheme } from './store.js';
import {
  escapeHtml,
  initToastSystem,
  openProfileModal,
  openWelcomeModal,
  renderLogoHtml,
  setNavigator,
} from './ui.js';

let currentRouteController = null;
let routerInstance = null;

function isNavActive(path) {
  const cur = window.location.pathname;
  if (path === '/') return cur === '/';
  return cur.startsWith(path);
}

function getNavItems(dict) {
  return [
    { path: '/', label: dict.nav.home },
    { path: '/movies', label: dict.nav.movies },
    { path: '/series', label: dict.nav.series },
    { path: '/explore', label: dict.nav.explore },
    { path: '/collections', label: dict.nav.collections },
    { path: '/people', label: dict.nav.people },
    { path: '/library', label: dict.nav.library },
  ];
}

function renderHeader() {
  const headerEl = document.getElementById('site-header');
  if (!headerEl) return;
  const dict = t();
  const navItems = getNavItems(dict);
  const nextLang = state.lang === 'en' ? 'ru' : 'en';

  headerEl.innerHTML = `
    <div class="container header-top">
      <a href="/" class="brand-link" data-nav="/">
        ${renderLogoHtml()}
      </a>

      <nav class="header-nav" aria-label="Main navigation">
        ${navItems
          .map(
            (item) =>
              `<a href="${item.path}" class="nav-link ${isNavActive(item.path) ? 'is-active' : ''}" data-nav="${item.path}">${escapeHtml(item.label)}</a>`
          )
          .join('')}
      </nav>

      <div class="header-controls">
        <button
          type="button"
          id="lang-toggle-btn"
          class="square-toggle-btn"
          aria-label="Switch language to ${nextLang.toUpperCase()}"
          title="${state.lang.toUpperCase()} → ${nextLang.toUpperCase()}"
        >
          ${state.lang.toUpperCase()}
        </button>

        <button
          type="button"
          id="theme-toggle-btn"
          class="square-toggle-btn"
          aria-label="${escapeHtml(state.theme === 'dark' ? dict.theme.toggleToLight : dict.theme.toggleToDark)}"
          title="${escapeHtml(state.theme === 'dark' ? dict.theme.toggleToLight : dict.theme.toggleToDark)}"
        >
          ${state.theme === 'dark' ? icons.sun : icons.moon}
        </button>

        <button type="button" id="profile-open-btn" class="profile-btn" aria-label="${escapeHtml(dict.profile.title)}">
          ${icons.user}
          <span class="profile-btn-name">${escapeHtml(state.profile.name || dict.welcome.guestName)}</span>
        </button>
      </div>
    </div>

    <div class="tablet-nav no-scrollbar">
      ${navItems
        .map(
          (item) =>
            `<a href="${item.path}" class="nav-link ${isNavActive(item.path) ? 'is-active' : ''}" data-nav="${item.path}">${escapeHtml(item.label)}</a>`
        )
        .join('')}
    </div>

    <div class="header-search-tier">
      <div class="container">
        <div id="header-search-wrap" class="header-search-wrap">
          <form id="header-search-form" class="header-search-form">
            <span class="header-search-icon">${icons.search}</span>
            <input
              id="header-search-input"
              type="text"
              class="header-search-input"
              placeholder="${escapeHtml(dict.search.placeholder)}"
              aria-label="${escapeHtml(dict.nav.search)}"
              autocomplete="off"
            />
            <button type="button" id="header-search-clear" class="header-search-clear" style="display:none;" aria-label="Clear search">
              ${icons.x}
            </button>
            <button type="submit" class="header-search-submit">${escapeHtml(dict.nav.search)}</button>
          </form>
          <div id="header-search-dropdown" class="search-suggestions-dropdown" hidden></div>
        </div>
      </div>
    </div>
  `;

  headerEl.querySelectorAll('[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      routerInstance?.navigate(a.getAttribute('data-nav'));
    });
  });

  headerEl.querySelector('#lang-toggle-btn')?.addEventListener('click', () => {
    setLang(state.lang === 'en' ? 'ru' : 'en');
  });

  headerEl.querySelector('#theme-toggle-btn')?.addEventListener('click', () => {
    toggleTheme();
  });

  headerEl.querySelector('#profile-open-btn')?.addEventListener('click', () => {
    openProfileModal();
  });

  attachHeaderSearchBehavior(headerEl);
}

function renderMobileNav() {
  const navEl = document.getElementById('mobile-nav');
  if (!navEl) return;
  const dict = t();
  const items = [
    { path: '/', label: dict.nav.home, icon: icons.home },
    { path: '/movies', label: dict.nav.movies, icon: icons.film },
    { path: '/series', label: dict.nav.series, icon: icons.tv },
    { path: '/explore', label: dict.nav.explore, icon: icons.compass },
    { path: '/collections', label: dict.nav.collections, icon: icons.layers },
    { path: '/library', label: dict.nav.library, icon: icons.bookmark },
  ];

  navEl.innerHTML = items
    .map(
      (i) => `
      <button type="button" class="mobile-nav-btn ${isNavActive(i.path) ? 'is-active' : ''}" data-nav="${i.path}">
        ${i.icon}
        <span>${escapeHtml(i.label)}</span>
      </button>
    `
    )
    .join('');

  navEl.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => routerInstance?.navigate(btn.getAttribute('data-nav')));
  });
}

function renderFooter() {
  const footerEl = document.getElementById('site-footer');
  if (!footerEl) return;
  const dict = t();
  const navItems = getNavItems(dict);

  footerEl.innerHTML = `
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand-block">
          ${renderLogoHtml()}
          <p class="footer-tagline">${escapeHtml(dict.footer.tagline)}</p>
          <p class="footer-rights">${escapeHtml(dict.footer.rights)}</p>
        </div>

        <nav class="footer-links" aria-label="Footer navigation">
          ${navItems
            .map(
              (item) =>
                `<a href="${item.path}" data-nav="${item.path}">${escapeHtml(item.label)}</a>`
            )
            .join('')}
        </nav>
      </div>

      <div class="footer-bottom">
        <div class="footer-tmdb">
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" aria-label="The Movie Database (TMDB)">
            <svg width="78" height="22" viewBox="0 0 156 44" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TMDB">
              <rect width="156" height="44" rx="8" fill="#032541" />
              <text x="16" y="29" fill="#90CEA1" font-family="sans-serif" font-weight="800" font-size="20" letter-spacing="1.5">TMDB</text>
              <rect x="92" y="15" width="46" height="14" rx="7" fill="#01B4E4" />
            </svg>
          </a>
          <p class="footer-tmdb-notice">${escapeHtml(dict.footer.tmdbNotice)}</p>
        </div>
        <p class="footer-copy">IBWFrame · ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;

  footerEl.querySelectorAll('[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      routerInstance?.navigate(a.getAttribute('data-nav'));
    });
  });
}

function renderNotFoundPage(container) {
  const dict = t();
  container.innerHTML = `
    <div class="container page-enter" style="padding:80px 16px;text-align:center;">
      <div class="state-icon">${icons.film}</div>
      <div style="font-family:var(--font-mono);font-size:0.75rem;font-weight:700;color:var(--accent-red);margin-bottom:8px;">404</div>
      <h1 class="page-title">${escapeHtml(dict.errors.notFoundTitle)}</h1>
      <p class="state-desc">${escapeHtml(dict.errors.notFoundDesc)}</p>
      <div class="state-actions">
        <button type="button" class="btn btn-primary" data-go-home>${icons.home}<span>${escapeHtml(dict.errors.goHome)}</span></button>
        <button type="button" class="btn btn-secondary" data-go-search>${icons.search}<span>${escapeHtml(dict.nav.search)}</span></button>
      </div>
    </div>
  `;
  container.querySelector('[data-go-home]')?.addEventListener('click', () => routerInstance?.navigate('/'));
  container.querySelector('[data-go-search]')?.addEventListener('click', () => routerInstance?.navigate('/search'));
}

function renderCurrentRoute() {
  if (currentRouteController) {
    currentRouteController.abort();
  }
  currentRouteController = new AbortController();
  const signal = currentRouteController.signal;

  renderHeader();
  renderMobileNav();
  renderFooter();

  const mainEl = document.getElementById('main-content');
  if (!mainEl) return;

  const route = matchRoute(window.location.pathname);

  switch (route.name) {
    case 'home':
      renderHomePage(mainEl, signal);
      break;
    case 'movies':
      renderCatalogPage(mainEl, 'movie', signal);
      break;
    case 'series':
      renderCatalogPage(mainEl, 'tv', signal);
      break;
    case 'search':
      renderSearchPage(mainEl, signal);
      break;
    case 'movie-detail':
      renderDetailPage(mainEl, 'movie', route.id, signal);
      break;
    case 'series-detail':
      renderDetailPage(mainEl, 'tv', route.id, signal);
      break;
    case 'people':
      renderPeoplePage(mainEl, signal);
      break;
    case 'person-detail':
      renderPersonDetailPage(mainEl, route.id, signal);
      break;
    case 'explore':
      renderExplorePage(mainEl, signal);
      break;
    case 'collections':
      renderCollectionsPage(mainEl, {}, signal);
      break;
    case 'collection-editorial':
      renderCollectionsPage(mainEl, { editorialSlug: route.slug }, signal);
      break;
    case 'collection-custom':
      renderCollectionsPage(mainEl, { customId: route.customId }, signal);
      break;
    case 'library':
      renderLibraryPage(mainEl);
      break;
    default:
      renderNotFoundPage(mainEl);
      break;
  }
}

function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  btn.innerHTML = icons.arrowUp;
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const onScroll = () => {
    btn.hidden = window.scrollY <= 380;
    btn.setAttribute('aria-label', t().errors.backToTop);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function bootstrap() {
  initToastSystem();
  initBackToTop();
  initInteractiveEffects();

  routerInstance = createRouter(renderCurrentRoute);
  setNavigator((path) => routerInstance.navigate(path));

  subscribe((_s, reason) => {
    if (reason === 'lang' || reason === 'profile' || reason === 'theme') {
      renderCurrentRoute();
    }
  });

  renderCurrentRoute();

  if (!state.profile.onboarded) {
    openWelcomeModal();
  }
}

bootstrap();
