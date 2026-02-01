import type { Language, TextNodeInfo, SearchResult, BulkLinkResults } from '../../shared/types';

export interface UIState {
  canEdit: boolean;
  currentLang: Language;
  scope: 'page' | 'selection';
  textNodes: TextNodeInfo[];
  selectedNode: TextNodeInfo | null;
  hasSelection: boolean;
  bulkLinkResults: BulkLinkResults | null;
  globalSearchResults: SearchResult[];
  allTranslations: unknown[];
}

type StateListener = (state: UIState) => void;

class Store {
  private state: UIState = {
    canEdit: true,
    currentLang: 'en',
    scope: 'page',
    textNodes: [],
    selectedNode: null,
    hasSelection: false,
    bulkLinkResults: null,
    globalSearchResults: [],
    allTranslations: []
  };

  private listeners: Set<StateListener> = new Set();

  getState(): UIState {
    return this.state;
  }

  setState(partial: Partial<UIState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const store = new Store();
