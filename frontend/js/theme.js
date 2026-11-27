import { loadStoredTheme, saveTheme } from './storage.js';

// Возвращает сохранённую тему или тёмную по умолчанию
export function getInitialTheme() {
  return loadStoredTheme() || 'dark';
}

// Применяет тему к html-элементу и сохраняет выбор
export function applyTheme(theme) {
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', safeTheme);
  saveTheme(safeTheme);
  return safeTheme;
}
