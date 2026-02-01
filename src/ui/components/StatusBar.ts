import { getElementById } from '../utils/dom';
import { pluginBridge } from '../services/pluginBridge';

let refreshBtn: HTMLButtonElement | null = null;

export function initStatusBar(): void {
  refreshBtn = getElementById<HTMLButtonElement>('refreshTranslationsBtn');

  refreshBtn.addEventListener('click', () => {
    if (refreshBtn?.classList.contains('loading')) return;

    refreshBtn?.classList.add('loading');
    setStatus('Fetching from API...');
    pluginBridge.refreshTranslations();

    // Remove loading state after a timeout (in case response doesn't come back)
    setTimeout(() => {
      refreshBtn?.classList.remove('loading');
    }, 60000); // 60 seconds for large fetches
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
