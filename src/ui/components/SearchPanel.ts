import type { SearchResult, MultilanStatus } from '../../shared/types';
import { SUPPORTED_LANGUAGES } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { showSearchBar } from './FramePanel';
import { getElementById } from '../utils/dom';
import { escapeHtml, copyToClipboard, debounce } from '../utils/dom';

// Status badge configuration - light bg with colored text (like GitHub labels)
const STATUS_CONFIG: Record<MultilanStatus, { bg: string; text: string; label: string }> = {
  FINAL: { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669', label: 'Final' },
  DRAFT: { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', label: 'Draft' },
  IN_TRANSLATION: { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', label: 'In Translation' },
  FOUR_EYES_CHECK: { bg: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed', label: 'Review' },
  TO_TRANSLATE_INTERNALLY: { bg: 'rgba(249, 115, 22, 0.15)', text: '#ea580c', label: 'To Translate' },
  TO_TRANSLATE_EXTERNALLY: { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626', label: 'To Translate' },
};

function getStatusBadge(status?: MultilanStatus): string {
  if (!status) return '';
  const config = STATUS_CONFIG[status] || { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280', label: status };
  return `<span class="status-badge" style="background: ${config.bg}; color: ${config.text};">${config.label}</span>`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getMetadataJson(result: SearchResult): string {
  if (!result.metadata) return '';
  return JSON.stringify(result.metadata);
}

function buildMetadataContent(metadataJson: string): string {
  if (!metadataJson) return '';

  try {
    const metadata = JSON.parse(metadataJson);
    const rows: string[] = [];

    if (metadata.sourceLanguageId) {
      rows.push(`<tr><td class="meta-label">Source</td><td class="meta-value">${metadata.sourceLanguageId.toUpperCase()}</td></tr>`);
    }
    if (metadata.createdAt) {
      rows.push(`<tr><td class="meta-label">Created</td><td class="meta-value">${formatDate(metadata.createdAt)}</td></tr>`);
    }
    if (metadata.modifiedAt) {
      rows.push(`<tr><td class="meta-label">Modified</td><td class="meta-value">${formatDate(metadata.modifiedAt)}</td></tr>`);
    }
    if (metadata.modifiedBy) {
      const by = metadata.modifiedBy.length > 30 ? metadata.modifiedBy.substring(0, 30) + '...' : metadata.modifiedBy;
      rows.push(`<tr><td class="meta-label">By</td><td class="meta-value">${escapeHtml(by)}</td></tr>`);
    }

    if (rows.length === 0) return '';
    return `<table>${rows.join('')}</table>`;
  } catch {
    return '';
  }
}

const copyIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

// Carousel state for single-node selection results
let singleNodeCarouselIndex = 0;

function autoResizeTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

export function initSearchPanel(): void {
  const globalSearchInput = getElementById<HTMLTextAreaElement>('globalSearchInput');
  const highlightBtn = getElementById<HTMLButtonElement>('highlightUnlinkedBtn');

  // Auto-resize on input
  globalSearchInput.addEventListener('input', () => {
    autoResizeTextarea(globalSearchInput);
  });

  // Prevent Enter from inserting newlines — trigger search instead
  globalSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
    }
  });

  // Global search input
  globalSearchInput.addEventListener('input', debounce(() => {
    const query = globalSearchInput.value.trim();
    if (query.length >= 1) {
      pluginBridge.globalSearch(query);
    } else {
      store.setState({ globalSearchResults: [] });
      renderGlobalSearchResults();
    }
  }, 200));

  // Highlight unlinked toggle
  highlightBtn.addEventListener('click', () => {
    const state = store.getState();
    const newMode = !state.isHighlightMode;
    store.setState({ isHighlightMode: newMode });
    highlightBtn.classList.toggle('active', newMode);
    highlightBtn.innerHTML = newMode ? 'Hide<br>unlinked' : 'Highlight<br>unlinked';

    // Use selection scope when a frame/layer is selected, otherwise full page
    const effectiveScope = state.hasSelection ? 'selection' : 'page';

    if (newMode) {
      pluginBridge.highlightUnlinked(true, effectiveScope);
      pluginBridge.getUnlinkedQueue(effectiveScope);
    } else {
      pluginBridge.highlightUnlinked(false, effectiveScope);
      pluginBridge.clearSelection();
      resetAfterHighlight();
    }
  });

  // Dev mode: hide highlight button
  const state = store.getState();
  if (!state.canEdit) {
    highlightBtn.style.display = 'none';
  }

  updateSearchHint();
}

export function updateSearchHint(): void {
  const state = store.getState();
  const searchHint = document.querySelector('.search-hint');
  if (searchHint) {
    searchHint.textContent = state.canEdit
      ? 'Search translations, then Copy or Link text nodes.'
      : 'Search translations and copy text. Select language to preview.';
  }
}

// --- Highlight Queue ---

export function handleUnlinkedQueue(): void {
  const state = store.getState();
  const queue = state.unlinkedQueue;

  if (queue.length === 0) {
    getElementById('statusText').textContent = 'No unlinked text nodes found';
    return;
  }

  getElementById('statusText').textContent = `${queue.length} unlinked node${queue.length > 1 ? 's' : ''} found`;
  store.setState({ unlinkedQueueIndex: 0 });
}

function selectQueueItem(index: number): void {
  const state = store.getState();
  const queue = state.unlinkedQueue;
  if (index >= queue.length) {
    exitHighlightMode();
    getElementById('statusText').textContent = 'All unlinked nodes processed!';
    return;
  }

  store.setState({ unlinkedQueueIndex: index });
  pluginBridge.selectNode(queue[index].nodeId);
}

export function advanceQueue(): void {
  const state = store.getState();
  if (!state.isHighlightMode) return;

  const nextIndex = state.unlinkedQueueIndex + 1;
  selectQueueItem(nextIndex);
}

function resetAfterHighlight(): void {
  store.setState({
    isHighlightMode: false,
    suppressFrameMode: true,
    unlinkedQueue: [],
    unlinkedQueueIndex: 0,
    selectionTextNodes: [],
    frameMatchResults: [],
    selectedNode: null,
    matchResult: null,
    hasSelection: false,
  });

  const highlightBtn = getElementById<HTMLButtonElement>('highlightUnlinkedBtn');
  highlightBtn.classList.remove('active');
  highlightBtn.innerHTML = 'Highlight<br>unlinked';

  getElementById('statusText').textContent = `${store.getState().translationCount || 0} translations loaded`;
  showSearchBar();
  clearSearch();
}

function exitHighlightMode(): void {
  const state = store.getState();
  pluginBridge.highlightUnlinked(false, state.scope);
  pluginBridge.clearSelection();
  resetAfterHighlight();
}

// --- Global Search Results ---

/**
 * Determine the corner badge for a search result card based on matchResult.
 * Returns { css, label } or null if no badge needed.
 */
function getMatchBadgeForResult(resultId: string): { css: string; label: string } | null {
  const state = store.getState();
  const match = state.matchResult;
  if (!match || !state.selectedNode) return null;

  if (match.status === 'linked' && match.multilanId === resultId) {
    return { css: 'match-badge-linked', label: 'Linked' };
  }
  if (match.status === 'exact' && match.multilanId === resultId) {
    return { css: 'match-badge-exact', label: 'Match' };
  }
  if (match.status === 'close' && match.suggestions) {
    const inSuggestions = match.suggestions.some(s => s.multilanId === resultId);
    if (inSuggestions) {
      return { css: 'match-badge-close', label: 'Close Match' };
    }
  }
  return null;
}

function renderResultCard(
  result: SearchResult,
  options: {
    showCornerBadge: boolean;
    hasSelection: boolean;
    isCurrentLink: boolean;
    canEdit: boolean;
    currentLang: string;
    showTextCopyButtons: boolean;
  }
): string {
  const metadataJson = getMetadataJson(result);
  const matchBadge = getMatchBadgeForResult(result.multilanId);

  let cardClass = 'search-result-card';
  if (options.showCornerBadge && matchBadge) {
    if (matchBadge.label === 'Linked') cardClass += ' search-result-card-linked';
    else if (matchBadge.label === 'Match') cardClass += ' search-result-card-exact';
    else if (matchBadge.label === 'Close Match') cardClass += ' search-result-card-close';
  }

  return `
    <div class="${cardClass}" data-multilan-id="${escapeHtml(result.multilanId)}">
      ${options.showCornerBadge && matchBadge ? `<span class="match-badge ${matchBadge.css} match-badge-corner">${matchBadge.label}</span>` : ''}
      <div class="search-result-header">
        <div class="search-result-id-row">
          <span class="search-result-id">${escapeHtml(result.multilanId)}</span>
          <button class="copy-btn icon-btn" data-text="${escapeHtml(result.multilanId)}" title="Copy ID">${copyIconSvg}</button>
          ${getStatusBadge(result.metadata?.status)}
          ${!options.showCornerBadge && matchBadge ? `<span class="match-badge ${matchBadge.css} match-badge-inline">${matchBadge.label}</span>` : ''}
        </div>
      </div>
      <div class="translations-preview">
        ${SUPPORTED_LANGUAGES.map(lang => {
          const text = result.translations[lang];
          if (text) {
            return `
            <div class="translation-row ${lang === options.currentLang ? 'active' : ''}">
              <span class="translation-lang">${lang.toUpperCase()}</span>
              <span class="translation-text">${escapeHtml(text)}</span>
              ${options.showTextCopyButtons ? `<button class="copy-btn icon-btn" data-text="${escapeHtml(text)}" title="Copy">${copyIconSvg}</button>` : ''}
            </div>`;
          }
          return `
            <div class="translation-row ${lang === options.currentLang ? 'active' : ''} unavailable">
              <span class="translation-lang">${lang.toUpperCase()}</span>
              <span class="translation-text translation-unavailable"><em>Multilan not available</em></span>
            </div>`;
        }).join('')}
      </div>
      <div class="search-result-actions">
        ${options.canEdit && options.hasSelection && !options.isCurrentLink ? `<button class="btn-link-result btn-sm btn-sm-success" data-id="${escapeHtml(result.multilanId)}">Link</button>` : ''}
        ${options.isCurrentLink && options.canEdit ? `<button class="btn-unlink-result btn-sm btn-sm-danger" data-id="${escapeHtml(result.multilanId)}">Unlink</button>` : ''}
        ${metadataJson ? `<button class="btn-info-toggle" title="Show details"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></button>` : ''}
      </div>
      ${metadataJson ? `<div class="metadata-info collapsed">${buildMetadataContent(metadataJson)}</div>` : ''}
    </div>
  `;
}

function renderSelectedNodeBubble(node: { characters: string }): string {
  return `
    <div class="selected-node-bubble">
      <div class="selected-node-bubble-text">"${escapeHtml(node.characters)}"</div>
    </div>
  `;
}

function renderSelectedNodeLayout(
  node: { characters: string; name: string; multilanId: string | null },
  results: SearchResult[],
  state: ReturnType<typeof store.getState>
): string {
  const isAlreadyLinked = node.multilanId;
  const showTextCopyButtons = !state.canEdit;

  // Clamp carousel index
  if (singleNodeCarouselIndex >= results.length) singleNodeCarouselIndex = 0;
  const current = results[singleNodeCarouselIndex];
  const isCurrentLink = isAlreadyLinked && node.multilanId === current.multilanId;

  const cardHtml = renderResultCard(current, {
    showCornerBadge: false,
    hasSelection: true,
    isCurrentLink: !!isCurrentLink,
    canEdit: state.canEdit,
    currentLang: state.currentLang,
    showTextCopyButtons,
  });

  const carouselNav = results.length > 1 ? `
    <div class="frame-carousel-nav">
      <button class="single-carousel-prev btn-sm btn-sm-outline" ${singleNodeCarouselIndex === 0 ? 'disabled' : ''}>&#8249;</button>
      <span class="frame-carousel-dots">
        ${results.map((_, i) =>
          `<span class="frame-carousel-dot single-carousel-dot ${i === singleNodeCarouselIndex ? 'active' : ''}" data-index="${i}"></span>`
        ).join('')}
      </span>
      <button class="single-carousel-next btn-sm btn-sm-outline" ${singleNodeCarouselIndex === results.length - 1 ? 'disabled' : ''}>&#8250;</button>
    </div>` : '';

  return `
    ${renderSelectedNodeBubble(node)}
    <div class="connector-arrow"></div>
    <div class="results-grouped">
      ${cardHtml}
      ${carouselNav}
    </div>
  `;
}

function renderSelectedNodeNoMatch(
  node: { characters: string; name: string },
): string {
  return `
    ${renderSelectedNodeBubble(node)}
    <div class="connector-arrow"></div>
    <div class="results-grouped">
      <div class="no-match-hint">No translations found. Search manually by only selecting this layer.</div>
    </div>
  `;
}

export function renderGlobalSearchResults(): void {
  const state = store.getState();
  let results = [...state.globalSearchResults];
  const hasSelection = state.selectedNode;
  const isAlreadyLinked = state.selectedNode?.multilanId;
  const globalSearchInput = getElementById<HTMLTextAreaElement>('globalSearchInput');
  const searchQuery = globalSearchInput.value.trim();

  const globalSearchResults = getElementById<HTMLDivElement>('globalSearchResults');
  const globalSearchResultsCount = getElementById<HTMLDivElement>('globalSearchResultsCount');
  const searchContainer = globalSearchInput.closest('.search-container') as HTMLElement | null;
  const searchHint = searchContainer?.parentElement?.querySelector('.search-hint') as HTMLElement | null;

  // Hide search bar when a node is selected (text is shown in the bubble)
  if (searchContainer) searchContainer.style.display = hasSelection ? 'none' : '';
  if (searchHint) searchHint.style.display = hasSelection ? 'none' : '';

  // Merge matchResult into search results so detected matches always appear
  const match = state.matchResult;
  if (match && hasSelection) {
    const existingIds = new Set(results.map(r => r.multilanId));

    if (match.status === 'linked' && match.multilanId && match.translations && !existingIds.has(match.multilanId)) {
      results.unshift({ multilanId: match.multilanId, translations: match.translations, metadata: match.metadata });
    } else if (match.status === 'exact' && match.multilanId && match.translations && !existingIds.has(match.multilanId)) {
      results.unshift({ multilanId: match.multilanId, translations: match.translations, metadata: match.metadata });
    } else if (match.status === 'close' && match.suggestions) {
      for (const suggestion of match.suggestions) {
        if (!existingIds.has(suggestion.multilanId)) {
          results.unshift({ multilanId: suggestion.multilanId, translations: suggestion.translations, metadata: suggestion.metadata });
          existingIds.add(suggestion.multilanId);
        }
      }
    }
  }

  if (results.length === 0) {
    globalSearchResultsCount.textContent = '';
    if (hasSelection && !isAlreadyLinked && searchQuery) {
      globalSearchResults.innerHTML = renderSelectedNodeNoMatch(state.selectedNode!);
    } else if (searchQuery) {
      globalSearchResults.innerHTML = '<div class="empty-state">No translations found</div>';
    } else {
      globalSearchResults.innerHTML = '<div class="empty-state">Start typing to search translations</div>';
    }
    return;
  }

  // Sort results: linked translation first, then exact match, then close matches
  const sortedResults = [...results].sort((a, b) => {
    const badgeA = getMatchBadgeForResult(a.multilanId);
    const badgeB = getMatchBadgeForResult(b.multilanId);
    const priorityOrder: Record<string, number> = { 'Linked': 0, 'Match': 1, 'Close Match': 2 };
    const prioA = badgeA ? (priorityOrder[badgeA.label] ?? 3) : 3;
    const prioB = badgeB ? (priorityOrder[badgeB.label] ?? 3) : 3;
    return prioA - prioB;
  });

  globalSearchResultsCount.textContent = `${results.length} result${results.length > 1 ? 's' : ''} found`;

  // Copy buttons for translation text: show for dev seat only
  const showTextCopyButtons = !state.canEdit;

  // When a node is selected, use the grouped layout with bubble
  if (hasSelection && results.length > 0) {
    globalSearchResults.innerHTML = renderSelectedNodeLayout(state.selectedNode!, sortedResults, state);
    attachSearchResultHandlers();
    return;
  }

  // Flat layout (no selection — manual search)
  globalSearchResults.innerHTML = sortedResults.map(result => {
    const isCurrentLink = isAlreadyLinked && state.selectedNode?.multilanId === result.multilanId;
    return renderResultCard(result, {
      showCornerBadge: true,
      hasSelection: !!hasSelection,
      isCurrentLink: !!isCurrentLink,
      canEdit: state.canEdit,
      currentLang: state.currentLang,
      showTextCopyButtons,
    });
  }).join('');

  attachSearchResultHandlers();
}

function attachSearchResultHandlers(): void {
  const globalSearchResults = getElementById<HTMLDivElement>('globalSearchResults');

  // Copy button handlers (ID + translation text)
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.text!;
      if (copyToClipboard(text)) {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1000);
      }
    });
  });

  // Link button handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-link-result').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const multilanId = btn.dataset.id!;
      const currentState = store.getState();
      if (!currentState.selectedNode) return;
      pluginBridge.linkNode(currentState.selectedNode.id, multilanId, currentState.currentLang);
    });
  });

  // Unlink button handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-unlink-result').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentState = store.getState();
      if (currentState.selectedNode) {
        pluginBridge.unlinkNode(currentState.selectedNode.id);
      }
    });
  });

  // Info toggle handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-info-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.search-result-card');
      const metadataInfo = card?.querySelector('.metadata-info');
      if (metadataInfo) {
        metadataInfo.classList.toggle('collapsed');
        btn.classList.toggle('active');
      }
    });
  });

  // Single-node carousel handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.single-carousel-prev').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (singleNodeCarouselIndex > 0) {
        singleNodeCarouselIndex--;
        renderGlobalSearchResults();
      }
    });
  });

  globalSearchResults.querySelectorAll<HTMLButtonElement>('.single-carousel-next').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      singleNodeCarouselIndex++;
      renderGlobalSearchResults();
    });
  });

  globalSearchResults.querySelectorAll<HTMLElement>('.single-carousel-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(dot.dataset.index || '0', 10);
      singleNodeCarouselIndex = index;
      renderGlobalSearchResults();
    });
  });
}

export function setSearchQuery(query: string): void {
  const globalSearchInput = getElementById<HTMLTextAreaElement>('globalSearchInput');
  globalSearchInput.value = query;
  autoResizeTextarea(globalSearchInput);
}

export function clearSearch(): void {
  const globalSearchInput = getElementById<HTMLTextAreaElement>('globalSearchInput');
  globalSearchInput.value = '';
  autoResizeTextarea(globalSearchInput);
  store.setState({ globalSearchResults: [] });
  renderGlobalSearchResults();
}

export function triggerSearch(query: string): void {
  setSearchQuery(query);
  if (query.length >= 1) {
    pluginBridge.globalSearch(query);
  }
}
