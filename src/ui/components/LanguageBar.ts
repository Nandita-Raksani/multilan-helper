import type { Language } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { querySelectorAll } from '../utils/dom';

const LANGUAGES: Language[] = ['en', 'fr', 'nl', 'de'];

export function initLanguageBar(): void {
  const langBtns = querySelectorAll<HTMLButtonElement>('.lang-btn');

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const state = store.getState();
      const lang = btn.dataset.lang as Language;

      // Update UI immediately
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      store.setState({ currentLang: lang });

      if (!state.canEdit) {
        // Dev seat: preview mode only - translations shown in search results
        return;
      }

      // For designers: auto-detect scope based on selection
      // If anything is selected in Figma, use 'selection' scope to only change selected frame/nodes
      const effectiveScope = state.hasSelection ? 'selection' : 'page';
      pluginBridge.switchLanguage(lang, effectiveScope);
    });
  });
}

export function setActiveLanguage(lang: Language): void {
  const langBtns = querySelectorAll<HTMLButtonElement>('.lang-btn');
  langBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

export function renderLanguageBar(): string {
  return LANGUAGES.map(lang =>
    `<button class="lang-btn" data-lang="${lang}">${lang.toUpperCase()}</button>`
  ).join('');
}
