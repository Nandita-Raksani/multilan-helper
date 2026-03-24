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
  currentFolder: string;
  folderNames: string[];
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
    translationCount: 0,
    currentFolder: 'EB',
    folderNames: []
  };

  private listeners: Set<StateListener> = new Set();
  private batchDepth = 0;
  private batchDirty = false;

  getState(): UIState {
    return this.state;
  }

  setState(partial: Partial<UIState>): void {
    this.state = { ...this.state, ...partial };
    if (this.batchDepth > 0) {
      // Inside a batch — defer notification until batch ends
      this.batchDirty = true;
    } else {
      this.notify();
    }
  }

  /**
   * Batch multiple setState calls into a single notification.
   * Usage: store.batch(() => { store.setState({...}); store.setState({...}); });
   */
  batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.batchDirty) {
        this.batchDirty = false;
        this.notify();
      }
    }
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
