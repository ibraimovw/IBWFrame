export function matchRoute(pathname) {
  const clean = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

  if (clean === '/') return { name: 'home' };
  if (clean === '/movies') return { name: 'movies' };
  if (clean === '/series') return { name: 'series' };
  if (clean === '/search') return { name: 'search' };
  if (clean === '/people') return { name: 'people' };
  if (clean === '/explore') return { name: 'explore' };
  if (clean === '/collections') return { name: 'collections' };
  if (clean === '/library') return { name: 'library' };

  const movieMatch = clean.match(/^\/movie\/(\d+)$/);
  if (movieMatch) return { name: 'movie-detail', id: Number(movieMatch[1]) };

  const seriesMatch = clean.match(/^\/series\/(\d+)$/);
  if (seriesMatch) return { name: 'series-detail', id: Number(seriesMatch[1]) };

  const personMatch = clean.match(/^\/person\/(\d+)$/);
  if (personMatch) return { name: 'person-detail', id: Number(personMatch[1]) };

  const customColMatch = clean.match(/^\/collections\/custom\/([a-zA-Z0-9_-]+)$/);
  if (customColMatch) return { name: 'collection-custom', customId: customColMatch[1] };

  const editorialColMatch = clean.match(/^\/collections\/([a-z0-9-]+)$/);
  if (editorialColMatch) return { name: 'collection-editorial', slug: editorialColMatch[1] };

  return { name: 'not-found' };
}

export function createRouter(onRouteChange) {
  function navigate(path) {
    const targetUrl = new URL(path, window.location.origin);
    const current = window.location.pathname + window.location.search;
    const next = targetUrl.pathname + targetUrl.search;
    if (current !== next) {
      window.history.pushState({}, '', next);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    onRouteChange();
  }

  window.addEventListener('popstate', () => {
    onRouteChange();
  });

  return { navigate };
}
