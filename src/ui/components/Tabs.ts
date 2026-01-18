import { querySelectorAll, getElementById } from '../utils/dom';

export type TabId = 'search' | 'texts' | 'settings';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'search', label: 'Search' },
  { id: 'texts', label: 'Links' },
  { id: 'settings', label: 'Settings' }
];

let onTabChangeCallback: ((tab: TabId) => void) | null = null;

export function initTabs(): void {
  const tabs = querySelectorAll<HTMLDivElement>('.tab');
  const panels = querySelectorAll<HTMLDivElement>('.panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab as TabId;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      panels.forEach(p => p.classList.remove('active'));
      getElementById(tabId + 'Panel').classList.add('active');

      if (onTabChangeCallback) {
        onTabChangeCallback(tabId);
      }
    });
  });
}

export function setActiveTab(tabId: TabId): void {
  const tabs = querySelectorAll<HTMLDivElement>('.tab');
  const panels = querySelectorAll<HTMLDivElement>('.panel');

  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  panels.forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId + 'Panel');
  });
}

export function onTabChange(callback: (tab: TabId) => void): void {
  onTabChangeCallback = callback;
}

export function renderTabs(): string {
  return TABS.map(tab =>
    `<div class="tab" data-tab="${tab.id}">${tab.label}</div>`
  ).join('');
}

export function getCurrentTab(): TabId {
  const activeTab = document.querySelector('.tab.active');
  return (activeTab?.getAttribute('data-tab') as TabId) || 'search';
}
