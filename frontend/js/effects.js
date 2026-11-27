// Селекторы карточек с лёгким 3D-наклоном и кнопок с магнитным эффектом
const ACCENT_CARD_SELECTOR =
  '.hero-spotlight, .editorial-card-compact, .collection-card, .random-result-card';
const MAGNETIC_BTN_SELECTOR =
  '.btn-primary:not(:disabled), .header-search-submit, .profile-btn, .back-to-top';

// Сброс наклона у карточки
function resetCard(el) {
  if (!el) return;
  el.classList.remove('is-tilting');
  el.style.removeProperty('--tilt-x');
  el.style.removeProperty('--tilt-y');
  el.style.removeProperty('--mag-x');
  el.style.removeProperty('--mag-y');
}

// Сброс смещения у кнопки
function resetButton(el) {
  if (!el) return;
  el.classList.remove('is-magnetic');
  el.style.removeProperty('--btn-mx');
  el.style.removeProperty('--btn-my');
}

// Подключение интерактивных эффектов курсора только на устройствах с мышью
export function initInteractiveEffects() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!canHover.matches || reducedMotion.matches) return;

  let activeCard = null;
  let activeBtn = null;
  let rafId = 0;
  let lastEvent = null;

  const updateFrame = () => {
    rafId = 0;
    const e = lastEvent;
    if (!e || reducedMotion.matches) return;

    const target = e.target instanceof Element ? e.target : null;
    const card = target ? target.closest(ACCENT_CARD_SELECTOR) : null;
    const btn = target ? target.closest(MAGNETIC_BTN_SELECTOR) : null;

    if (activeCard && activeCard !== card) {
      resetCard(activeCard);
    }
    activeCard = card;

    if (card) {
      const rect = card.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
        const ny = Math.max(-0.5, Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5));
        const isHero = card.classList.contains('hero-spotlight');
        const isRandom = card.classList.contains('random-result-card');
        let maxDeg = 4.5;
        let maxShift = 3;

        if (isHero) {
          maxDeg = 0.65;
          maxShift = 0;
        } else if (isRandom) {
          maxDeg = 1.25;
          maxShift = 1;
        }

        card.classList.add('is-tilting');
        card.style.setProperty('--tilt-x', `${(-ny * 2 * maxDeg).toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${(nx * 2 * maxDeg).toFixed(2)}deg`);
        if (maxShift > 0) {
          card.style.setProperty('--mag-x', `${(nx * 2 * maxShift).toFixed(2)}px`);
          card.style.setProperty('--mag-y', `${(ny * 2 * maxShift).toFixed(2)}px`);
        }
        card.style.setProperty('--spot-x', `${((nx + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--spot-y', `${((ny + 0.5) * 100).toFixed(1)}%`);
      }
    }

    if (activeBtn && activeBtn !== btn) {
      resetButton(activeBtn);
    }
    activeBtn = btn;

    if (btn) {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
        const ny = Math.max(-0.5, Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5));
        const maxPull = 5;

        btn.classList.add('is-magnetic');
        btn.style.setProperty('--btn-mx', `${(nx * 2 * maxPull).toFixed(2)}px`);
        btn.style.setProperty('--btn-my', `${(ny * 2 * maxPull).toFixed(2)}px`);
      }
    }
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      lastEvent = e;
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateFrame);
      }
    },
    { passive: true }
  );

  const clearAll = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    resetCard(activeCard);
    resetButton(activeBtn);
    activeCard = null;
    activeBtn = null;
  };

  document.addEventListener('pointerleave', clearAll);
  window.addEventListener('blur', clearAll);
}
