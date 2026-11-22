import { getStore, updateStore } from './storage.js';

export function getTheme() {
  return getStore().preferences.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', normalized);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = normalized === 'dark' ? '☀' : '☾';
}

export function setTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  updateStore((store) => {
    store.preferences.theme = normalized;
    return store;
  });
  applyTheme(normalized);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
