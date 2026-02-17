import { getElementById } from '../utils/dom';
import { pluginBridge } from '../services/pluginBridge';
import { store } from '../state/store';

let refreshBtn: HTMLButtonElement | null = null;
let sourceSelect: HTMLSelectElement | null = null;

export function initStatusBar(): void {
  refreshBtn = getElementById<HTMLButtonElement>('refreshTranslationsBtn');
  sourceSelect = getElementById<HTMLSelectElement>('sourceSelect');

  // Refresh button - reloads from current source
  refreshBtn.addEventListener('click', () => {
    if (refreshBtn?.classList.contains('loading')) return;

    refreshBtn?.classList.add('loading');
    const source = store.getState().translationSource || 'api';
    if (source === 'api') {
      setStatus('Fetching from API...');
      pluginBridge.refreshTranslations();
    } else {
      setStatus('Loading .tra files...');
      pluginBridge.setTranslationSource('tra');
    }

    // Remove loading state after a timeout (in case response doesn't come back)
    setTimeout(() => {
      refreshBtn?.classList.remove('loading');
    }, 60000); // 60 seconds for large fetches
  });

  // Source select - switch between API and .tra files
  sourceSelect.addEventListener('change', () => {
    const source = sourceSelect?.value as 'api' | 'tra';
    store.setState({ translationSource: source });

    refreshBtn?.classList.add('loading');
    if (source === 'api') {
      setStatus('Fetching from API...');
      pluginBridge.refreshTranslations();
    } else {
      setStatus('Loading .tra files...');
      pluginBridge.setTranslationSource('tra');
    }
  });
}

export function setStatus(text: string): void {
  getElementById('statusText').textContent = text;
  // Remove loading state when status updates
  refreshBtn?.classList.remove('loading');
}

export function setBuildTimestamp(timestamp: string): void {
  getElementById('buildTimestamp').textContent = `Updated: ${timestamp}`;
}

export function setViewMode(isViewMode: boolean): void {
  const viewModeBanner = getElementById('viewModeBanner');
  viewModeBanner.style.display = isViewMode ? 'block' : 'none';
}
