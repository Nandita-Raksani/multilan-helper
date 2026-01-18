import { getElementById } from '../utils/dom';

export function setStatus(text: string): void {
  getElementById('statusText').textContent = text;
}

export function setBuildTimestamp(timestamp: string): void {
  getElementById('buildTimestamp').textContent = `Updated: ${timestamp}`;
}

export function setViewMode(isViewMode: boolean): void {
  const viewModeBanner = getElementById('viewModeBanner');
  viewModeBanner.style.display = isViewMode ? 'block' : 'none';
}
