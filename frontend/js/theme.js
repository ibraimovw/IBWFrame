import { loadStoredTheme, saveTheme } from './storage.js';

export function getInitialTheme() {
  return loadStoredTheme() || 'dark';
}

export function applyTheme(theme) {
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', safeTheme);
  saveTheme(safeTheme);
  return safeTheme;
}
