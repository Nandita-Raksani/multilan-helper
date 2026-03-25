import type { FrameNodeMatchResult, SearchResult } from '../../shared/types';
import { SUPPORTED_LANGUAGES } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { escapeHtml, copyToClipboard } from '../utils/dom';

// Carousel state: tracks current suggestion index per nodeId
const nodeCarouselIndexMap = new Map<string, number>();

// Tracks nodes where close-match search is in progress or completed with no results
const nodeCloseMatchStatus = new Map<string, 'searching' | 'no-results'>();

// Cached sort order — set once on initial frame render, preserved across re-renders
let cachedSortOrder: string[] | null = null;

const copyIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

export function isFrameMode(): boolean {
  return store.getState().selectionTextNodes.length > 1;
}

/**
 * Called when a per-node close-match search completes.
 * Updates the search state so the card renders the correct status.
 */
export function handleFrameMatchResult(nodeId: string, status: string): void {
  if (status === 'none') {
    nodeCloseMatchStatus.set(nodeId, 'no-results');
  } else {
    // Got results (close/exact) — clear search state, card will render differently
    nodeCloseMatchStatus.delete(nodeId);
  }
}

/**
 * Clear close-match search state (e.g. on new selection).
 */
export function clearCloseMatchSearchState(): void {
  nodeCloseMatchStatus.clear();
  cachedSortOrder = null;
}

export function showSearchBar(): void {
  const searchPanel = document.getElementById('searchPanel');
  const framePanel = document.getElementById('framePanel');
  if (searchPanel) searchPanel.style.display = '';
  if (framePanel) framePanel.style.display = 'none';
}

function renderTranslations(translations: Record<string, string>, currentLang: string): string {
  return SUPPORTED_LANGUAGES.map(lang => {
    const text = translations[lang];
    if (text) {
      return `<div class="translation-row ">
        <span class="translation-lang">${lang.toUpperCase()}</span>
        <span class="translation-text">${escapeHtml(text)}</span>
      </div>`;
    }
    return `<div class="translation-row ">
      <span class="translation-lang">${lang.toUpperCase()}</span>
      <span class="translation-text translation-unavailable"><em>N/A</em></span>
    </div>`;
  }).join('');
}

function renderNodeBubble(characters: string): string {
  return `
    <div class="selected-node-bubble">
      <div class="selected-node-bubble-text">"${escapeHtml(characters)}"</div>
    </div>
    <div class="connector-arrow"></div>`;
}

function renderLinkedCard(item: FrameNodeMatchResult, currentLang: string, canEdit: boolean): string {
  const mr = item.matchResult;
  return `
    <div class="frame-node-group" data-node-id="${escapeHtml(item.nodeId)}">
      ${renderNodeBubble(item.characters)}
      <div class="results-grouped">
        <div class="frame-node-card frame-node-card-linked">
          <div class="frame-node-id-row">
            <span class="frame-node-id">${escapeHtml(mr.multilanId || '')}</span>
            <button class="copy-btn icon-btn" data-text="${escapeHtml(mr.multilanId || '')}" title="Copy ID">${copyIconSvg}</button>
            <span class="match-badge match-badge-linked">Linked</span>
          </div>
          ${mr.translations ? `<div class="translations-preview">${renderTranslations(mr.translations, currentLang)}</div>` : ''}
          ${canEdit ? `<div class="frame-node-actions"><button class="btn-sm btn-sm-danger btn-frame-unlink" data-node-id="${escapeHtml(item.nodeId)}">Unlink</button></div>` : ''}
        </div>
      </div>
    </div>`;
}

function renderExactCard(item: FrameNodeMatchResult, currentLang: string, canEdit: boolean): string {
  const mr = item.matchResult;
  return `
    <div class="frame-node-group" data-node-id="${escapeHtml(item.nodeId)}">
      ${renderNodeBubble(item.characters)}
      <div class="results-grouped">
        <div class="frame-node-card frame-node-card-exact">
          <div class="frame-node-id-row">
            <span class="frame-node-id">${escapeHtml(mr.multilanId || '')}</span>
            <button class="copy-btn icon-btn" data-text="${escapeHtml(mr.multilanId || '')}" title="Copy ID">${copyIconSvg}</button>
            <span class="match-badge match-badge-exact">Match</span>
          </div>
          ${mr.translations ? `<div class="translations-preview">${renderTranslations(mr.translations, currentLang)}</div>` : ''}
          ${canEdit ? `<div class="frame-node-actions"><button class="btn-sm btn-sm-success btn-frame-link" data-node-id="${escapeHtml(item.nodeId)}" data-multilan-id="${escapeHtml(mr.multilanId || '')}">Link</button></div>` : ''}
        </div>
      </div>
    </div>`;
}

function renderCloseCard(item: FrameNodeMatchResult, currentLang: string, canEdit: boolean): string {
  const mr = item.matchResult;
  const suggestions = mr.suggestions || [];
  if (suggestions.length === 0) return renderNoneCard(item);

  const currentIndex = nodeCarouselIndexMap.get(item.nodeId) || 0;
  const suggestion = suggestions[currentIndex];

  return `
    <div class="frame-node-group" data-node-id="${escapeHtml(item.nodeId)}">
      ${renderNodeBubble(item.characters)}
      <div class="results-grouped">
        <div class="frame-node-card frame-node-card-close">
          ${renderSuggestionSlide(item.nodeId, suggestion, currentIndex, suggestions.length, currentLang, canEdit)}
        </div>
      </div>
    </div>`;
}

function renderSuggestionSlide(nodeId: string, suggestion: SearchResult & { score: number }, index: number, total: number, currentLang: string, canEdit: boolean): string {
  const scorePercent = Math.round(suggestion.score * 100);
  return `
    <div class="frame-carousel-slide">
      <div class="frame-node-id-row">
        <span class="frame-node-id">${escapeHtml(suggestion.multilanId)}</span>
        <button class="copy-btn icon-btn" data-text="${escapeHtml(suggestion.multilanId)}" title="Copy ID">${copyIconSvg}</button>
        <span class="frame-score" style="margin-left:auto">${scorePercent}%</span>
        <span class="match-badge match-badge-close" style="margin-left:0">Close Match</span>
      </div>
      <div class="translations-preview">${renderTranslations(suggestion.translations, currentLang)}</div>
      <div class="frame-node-actions">
        ${canEdit ? `<button class="btn-sm btn-sm-success btn-frame-link" data-node-id="${escapeHtml(nodeId)}" data-multilan-id="${escapeHtml(suggestion.multilanId)}">Link</button>` : ''}
      </div>
      ${total > 1 ? `
      <div class="frame-carousel-nav">
        <button class="frame-carousel-prev btn-sm btn-sm-outline" data-node-id="${escapeHtml(nodeId)}" ${index === 0 ? 'disabled' : ''}>&#8249;</button>
        <span class="frame-carousel-dots">
          ${Array.from({ length: total }, (_, i) =>
            `<span class="frame-carousel-dot ${i === index ? 'active' : ''}" data-node-id="${escapeHtml(nodeId)}" data-index="${i}"></span>`
          ).join('')}
        </span>
        <button class="frame-carousel-next btn-sm btn-sm-outline" data-node-id="${escapeHtml(nodeId)}" ${index === total - 1 ? 'disabled' : ''}>&#8250;</button>
      </div>` : ''}
    </div>`;
}

function renderNoneCard(item: FrameNodeMatchResult): string {
  const canEdit = store.getState().canEdit;
  const searchState = nodeCloseMatchStatus.get(item.nodeId);

  // Fuzzy search in progress
  if (searchState === 'searching') {
    return `
      <div class="frame-node-group" data-node-id="${escapeHtml(item.nodeId)}">
        ${renderNodeBubble(item.characters)}
        <div class="results-grouped">
          <div class="frame-node-card frame-node-card-none">
            <div class="frame-node-id-row" style="margin-bottom:0">
              <span class="searching-hint"><span class="searching-spinner"></span> Looking for close matches&hellip;</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  // Fuzzy search completed with no results — single consolidated message
  if (searchState === 'no-results') {
    return `
      <div class="frame-node-group" data-node-id="${escapeHtml(item.nodeId)}">
        ${renderNodeBubble(item.characters)}
        <div class="results-grouped">
          <div class="frame-node-card frame-node-card-none">
            <div class="frame-node-id-row" style="margin-bottom:0">
              <span class="frame-node-hint" style="margin:0">No matching translations found</span>
              <span class="match-badge match-badge-none">No match</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  // Initial state — show button to trigger fuzzy search
  return `
    <div class="frame-node-group" data-node-id="${escapeHtml(item.nodeId)}">
      ${renderNodeBubble(item.characters)}
      <div class="results-grouped">
        <div class="frame-node-card frame-node-card-none">
          <div class="frame-node-id-row" style="margin-bottom:0">
            <span class="frame-node-hint" style="margin:0">No exact match</span>
            ${!canEdit ? '<span class="match-badge match-badge-none">No match</span>' : ''}
          </div>
          ${canEdit ? `<div class="frame-node-actions" style="justify-content:flex-start"><button class="btn-sm btn-sm-brand btn-find-close" data-node-id="${escapeHtml(item.nodeId)}" data-text="${escapeHtml(item.characters)}">Find close match</button></div>` : ''}
        </div>
      </div>
    </div>`;
}

function sortResults(results: FrameNodeMatchResult[]): FrameNodeMatchResult[] {
  const priority: Record<string, number> = { linked: 0, exact: 1, close: 2, none: 3 };
  return [...results].sort((a, b) => {
    const pa = priority[a.matchResult.status] ?? 4;
    const pb = priority[b.matchResult.status] ?? 4;
    return pa - pb;
  });
}

export function renderFramePanel(): void {
  const state = store.getState();
  const results = state.frameMatchResults;
  const nodeCount = state.selectionTextNodes.length;

  // Hide search panel, show frame panel
  const searchPanel = document.getElementById('searchPanel');
  if (searchPanel) searchPanel.style.display = 'none';

  let framePanel = document.getElementById('framePanel');
  if (!framePanel) {
    framePanel = document.createElement('div');
    framePanel.id = 'framePanel';
    framePanel.className = 'panel active';
    // Insert after search panel
    searchPanel?.parentNode?.insertBefore(framePanel, searchPanel.nextSibling);
  }
  framePanel.style.display = 'block';

  // Sort only on first render for this selection, then preserve card positions
  if (!cachedSortOrder || cachedSortOrder.length !== results.length) {
    const initialSort = sortResults(results);
    cachedSortOrder = initialSort.map(r => r.nodeId);
  }
  const orderMap = new Map(cachedSortOrder.map((id, i) => [id, i]));
  const sorted = [...results].sort((a, b) =>
    (orderMap.get(a.nodeId) ?? 0) - (orderMap.get(b.nodeId) ?? 0)
  );
  const linkedCount = results.filter(r => r.matchResult.status === 'linked').length;
  const unmatchedCount = results.filter(r => r.matchResult.status === 'none').length;

  let summaryParts: string[] = [];
  if (linkedCount > 0) summaryParts.push(`${linkedCount} linked`);
  if (unmatchedCount > 0) summaryParts.push(`${unmatchedCount} unmatched`);
  const summaryText = summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : '';

  let html = `
    <div class="frame-header">
      <div class="frame-header-title">Frame selected &ndash; ${nodeCount} text layer${nodeCount !== 1 ? 's' : ''} found</div>
      <div class="frame-header-summary">${summaryText}</div>
    </div>
    <div class="frame-node-list">
  `;

  for (const item of sorted) {
    switch (item.matchResult.status) {
      case 'linked':
        html += renderLinkedCard(item, state.currentLang, state.canEdit);
        break;
      case 'exact':
        html += renderExactCard(item, state.currentLang, state.canEdit);
        break;
      case 'close':
        html += renderCloseCard(item, state.currentLang, state.canEdit);
        break;
      case 'none':
        html += renderNoneCard(item);
        break;
    }
  }

  html += '</div>';
  framePanel.innerHTML = html;

  attachFramePanelHandlers(framePanel);
}

function attachFramePanelHandlers(container: HTMLElement): void {
  const state = store.getState();

  // Card click → select/zoom node on canvas
  container.querySelectorAll<HTMLElement>('.frame-node-group').forEach(group => {
    group.addEventListener('click', (e) => {
      // Don't navigate if clicking a button
      if ((e.target as HTMLElement).closest('button')) return;
      const nodeId = group.dataset.nodeId;
      if (nodeId) pluginBridge.selectNode(nodeId);
    });
  });

  // Copy buttons
  container.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.text!;
      if (copyToClipboard(text)) {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1000);
      }
    });
  });

  // Link buttons
  container.querySelectorAll<HTMLButtonElement>('.btn-frame-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      const multilanId = btn.dataset.multilanId!;
      pluginBridge.linkNode(nodeId, multilanId, state.currentLang);
    });
  });

  // Unlink buttons
  container.querySelectorAll<HTMLButtonElement>('.btn-frame-unlink').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      pluginBridge.unlinkNode(nodeId);
    });
  });

  // Carousel prev buttons
  container.querySelectorAll<HTMLButtonElement>('.frame-carousel-prev').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      const current = nodeCarouselIndexMap.get(nodeId) || 0;
      if (current > 0) {
        nodeCarouselIndexMap.set(nodeId, current - 1);
        renderFramePanel();
      }
    });
  });

  // Carousel next buttons
  container.querySelectorAll<HTMLButtonElement>('.frame-carousel-next').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      const current = nodeCarouselIndexMap.get(nodeId) || 0;
      nodeCarouselIndexMap.set(nodeId, current + 1);
      renderFramePanel();
    });
  });

  // Find close matches buttons (on-demand fuzzy search per node)
  container.querySelectorAll<HTMLButtonElement>('.btn-find-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      const text = btn.dataset.text!;
      nodeCloseMatchStatus.set(nodeId, 'searching');
      renderFramePanel();
      pluginBridge.findCloseMatches(nodeId, text);
    });
  });

  // Carousel dot navigation
  container.querySelectorAll<HTMLElement>('.frame-carousel-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = dot.dataset.nodeId!;
      const index = parseInt(dot.dataset.index || '0', 10);
      nodeCarouselIndexMap.set(nodeId, index);
      renderFramePanel();
    });
  });
}
