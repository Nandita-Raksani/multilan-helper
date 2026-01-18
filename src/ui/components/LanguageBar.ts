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

      if (!state.canEdit) {
        // In view mode, just highlight the button to show preview
        langBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        store.setState({ currentLang: lang });
        return;
      }

      store.setState({ currentLang: lang });
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      pluginBridge.switchLanguage(lang, state.scope, state.placeholders);
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
