import { getElementById } from '../utils/dom';

export function initStatusBar(): void {
  // Status bar is passive — just displays status text
}

export function setStatus(text: string): void {
  getElementById('statusText').textContent = text;
}

export function setViewMode(isViewMode: boolean): void {
  const viewModeBanner = getElementById('viewModeBanner');
  viewModeBanner.style.display = isViewMode ? 'block' : 'none';
}
