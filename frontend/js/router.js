import { renderHomePage } from './home.js';
import { renderCatalogPage } from './catalog.js';
import { renderDetailsPage } from './details.js';
import { renderSearchPage } from './search.js';
import { renderPeoplePage, renderPersonDetailsPage } from './people.js';
import { renderExplorePage } from './explore.js';
import { renderCollectionsPage, renderMyLibraryPage } from './collections.js';
import { t } from './i18n.js';

export function updateActiveNav(pathname) {
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
    link.classList.toggle('active', isActive);
  });
}

export async function renderCurrentRoute() {
  const app = document.getElementById('app');
  const pathname = window.location.pathname;
  updateActiveNav(pathname);
  document.getElementById('mobile-drawer')?.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (pathname === '/') return renderHomePage(app);
  if (pathname === '/movies') return renderCatalogPage(app, 'movie');
  if (pathname === '/series') return renderCatalogPage(app, 'tv');
  if (pathname === '/search') return renderSearchPage(app);
  if (pathname === '/people') return renderPeoplePage(app);
  if (pathname === '/explore') return renderExplorePage(app);
  if (pathname === '/collections') return renderCollectionsPage(app);
  if (pathname === '/my-collection') return renderMyLibraryPage(app);

  const movieMatch = pathname.match(/^\/movie\/(\d+)$/);
  if (movieMatch) return renderDetailsPage(app, 'movie', movieMatch[1]);

  const seriesMatch = pathname.match(/^\/series\/(\d+)$/);
  if (seriesMatch) return renderDetailsPage(app, 'tv', seriesMatch[1]);

  const personMatch = pathname.match(/^\/person\/(\d+)$/);
  if (personMatch) return renderPersonDetailsPage(app, personMatch[1]);

  // 404 Page
  app.innerHTML = `
    <div class="container" style="padding-top:64px;">
      <div class="state-box">
        <h1>${t('notFound.title')}</h1>
        <p>${t('notFound.desc')}</p>
        <a href="/" data-link class="btn btn-primary">${t('notFound.home')}</a>
      </div>
    </div>
  `;
}

export function navigate(to) {
  if (window.location.pathname + window.location.search === to) return;
  window.history.pushState({}, '', to);
  renderCurrentRoute();
}
