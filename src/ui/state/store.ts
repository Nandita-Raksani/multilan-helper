import type { Language, TextNodeInfo, SearchResult, MatchDetectionResult, UnlinkedQueueItem, FrameNodeMatchResult } from '../../shared/types';

export interface UIState {
  canEdit: boolean;
  currentLang: Language;
  scope: 'page' | 'selection';
  textNodes: TextNodeInfo[];
  selectedNode: TextNodeInfo | null;
  hasSelection: boolean;
  matchResult: MatchDetectionResult | null;
  unlinkedQueue: UnlinkedQueueItem[];
  unlinkedQueueIndex: number;
  selectionTextNodes: TextNodeInfo[];
  frameMatchResults: FrameNodeMatchResult[];
  isHighlightMode: boolean;
  suppressFrameMode: boolean;
  globalSearchResults: SearchResult[];
  allTranslations: unknown[];
  translationCount: number;
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
    matchResult: null,
    unlinkedQueue: [],
    unlinkedQueueIndex: 0,
    selectionTextNodes: [],
    frameMatchResults: [],
    isHighlightMode: false,
    suppressFrameMode: false,
    globalSearchResults: [],
    allTranslations: [],
    translationCount: 0
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
