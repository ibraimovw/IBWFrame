import { getStore, updateStore } from './storage.js';
import { getLang, setLang, applyStaticTranslations, t } from './i18n.js';
import { getTheme, applyTheme, toggleTheme, setTheme } from './theme.js';
import { navigate, renderCurrentRoute } from './router.js';
import { initHeaderSearch } from './search.js';
import { openModal, closeModal, bindGlobalCardActions, showToast, escapeHtml } from './ui.js';

function syncProfileBadge() {
  const name = getStore().profile.name || 'Guest';
  const avatar = document.getElementById('profile-avatar');
  const label = document.getElementById('profile-name-label');
  if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
  if (label) label.textContent = name;
}

function openWelcomeOrProfileModal(isFirstVisit = false) {
  const store = getStore();
  const currentLang = getLang();
  const currentTheme = getTheme();

  openModal(`
    <h2 style="margin-top:0;">${isFirstVisit ? t('welcome.title') : t('profile.title')}</h2>
    <p style="color:var(--text-secondary);margin-bottom:20px;">${t('welcome.subtitle')}</p>
    <form id="profile-setup-form">
      <div class="form-group">
        <label for="user-name-input">${t('welcome.nameLabel')}</label>
        <input type="text" id="user-name-input" class="form-input" required maxlength="32"
               value="${escapeHtml(store.profile.name)}" placeholder="${t('welcome.namePlaceholder')}" />
      </div>

      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div class="form-group" style="flex:1;margin:0;">
          <label>Language</label>
          <select id="modal-lang-select" class="form-input">
            <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English (EN)</option>
            <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>Русский (RU)</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;margin:0;">
          <label>Theme</label>
          <select id="modal-theme-select" class="form-input">
            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
          </select>
        </div>
      </div>

      <button type="submit" class="btn btn-primary" style="width:100%;">
        ${isFirstVisit ? t('welcome.continue') : t('profile.save')}
      </button>
    </form>
  `, { locked: isFirstVisit });

  document.getElementById('profile-setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('user-name-input').value.trim() || 'Guest';
    const lang = document.getElementById('modal-lang-select').value;
    const theme = document.getElementById('modal-theme-select').value;

    updateStore((s) => {
      s.profile.name = name;
      s.profile.onboarded = true;
      return s;
    });
    setLang(lang);
    setTheme(theme);
    syncProfileBadge();

    const backdrop = document.getElementById('modal-backdrop');
    backdrop.dataset.locked = '0';
    closeModal();
    renderCurrentRoute();
    if (!isFirstVisit) showToast(t('toast.saved'));
  });
}

function initApp() {
  // 1. Тема и язык
  applyTheme(getTheme());
  setLang(getLang());
  syncProfileBadge();

  // 2. SPA ссылки (History API)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(link.getAttribute('href'));
  });

  window.addEventListener('popstate', renderCurrentRoute);

  // 3. Переключатели в Header
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    setLang(getLang() === 'en' ? 'ru' : 'en');
    renderCurrentRoute();
  });

  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('profile-btn')?.addEventListener('click', () => openWelcomeOrProfileModal(false));

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-drawer')?.classList.toggle('hidden');
  });

  // 4. Модальное окно и Back to Top
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  const backTopBtn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => {
    backTopBtn?.classList.toggle('hidden', window.scrollY < 450);
  }, { passive: true });
  backTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // 5. Глобальные действия карточек и поиск
  bindGlobalCardActions();
  initHeaderSearch(navigate);

  // 6. Welcome Modal при первом посещении
  if (!getStore().profile.onboarded) {
    openWelcomeOrProfileModal(true);
  }

  applyStaticTranslations();
  renderCurrentRoute();
}

document.addEventListener('DOMContentLoaded', initApp);
