export type TabId = 'search';

export function initTabs(): void {
  // Single tab — no tab switching needed
}

export function getCurrentTab(): TabId {
  return 'search';
}
