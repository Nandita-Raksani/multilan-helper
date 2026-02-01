import type { SearchResult, MultilanStatus } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById } from '../utils/dom';
import { escapeHtml, copyToClipboard, debounce } from '../utils/dom';

// Track variable values per multilanId
const variableValues: Map<string, Record<string, string>> = new Map();

// Format translation text with styled variable pills for display
function formatTranslationWithPills(text: string): string {
  return escapeHtml(text).replace(/###(\w+)###/g, '<span class="var-pill">$1</span>');
}


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

export function initSearchPanel(): void {
  const globalSearchInput = getElementById<HTMLInputElement>('globalSearchInput');

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

  // Update hint based on edit permissions
  updateSearchHint();
}

export function updateSearchHint(): void {
  const state = store.getState();
  const searchHint = document.querySelector('.search-hint');
  if (searchHint) {
    searchHint.textContent = state.canEdit
      ? 'Search translations, then Copy, Link, or Create text nodes.'
      : 'Search translations and copy text. Select language to preview.';
  }
}

export function updateSearchSelectedNode(): void {
  const state = store.getState();
  const searchSelectedNode = getElementById<HTMLDivElement>('searchSelectedNode');
  const searchSelectedBadge = getElementById<HTMLSpanElement>('searchSelectedBadge');
  const searchSelectedText = getElementById<HTMLDivElement>('searchSelectedText');
  const searchSelectedActions = getElementById<HTMLDivElement>('searchSelectedActions');

  if (state.selectedNode) {
    searchSelectedNode.style.display = 'block';
    searchSelectedText.textContent = `"${state.selectedNode.characters}"`;

    const isLinked = state.selectedNode.multilanId;
    if (isLinked) {
      searchSelectedBadge.textContent = state.selectedNode.multilanId!;
      searchSelectedBadge.className = 'btn-sm btn-sm-success';
      searchSelectedBadge.style.cursor = 'pointer';
      searchSelectedBadge.title = 'Click to copy';
    } else {
      searchSelectedBadge.textContent = 'Not linked';
      searchSelectedBadge.className = 'status-badge-inline';
      searchSelectedBadge.style.cursor = 'default';
      searchSelectedBadge.title = '';
    }

    // Show action buttons based on link status and edit permissions
    if (isLinked) {
      // Only show Unlink button if user can edit
      if (state.canEdit) {
        searchSelectedActions.innerHTML = `
          <button class="btn-sm btn-sm-outline" id="searchUnlinkBtn">Unlink</button>
        `;
        getElementById('searchUnlinkBtn').addEventListener('click', () => {
          pluginBridge.unlinkNode(state.selectedNode!.id);
        });
      } else {
        searchSelectedActions.innerHTML = '';
      }

      // Click badge to copy ID (available for all users)
      searchSelectedBadge.onclick = () => {
        const id = state.selectedNode!.multilanId!;
        if (copyToClipboard(id)) {
          const originalText = searchSelectedBadge.textContent;
          searchSelectedBadge.textContent = 'Copied!';
          setTimeout(() => {
            searchSelectedBadge.textContent = originalText;
          }, 1000);
        }
      };
    } else {
      searchSelectedBadge.onclick = null;
      searchSelectedActions.innerHTML = '';
    }
  } else {
    searchSelectedNode.style.display = 'none';
  }

  renderGlobalSearchResults();
}

export function renderGlobalSearchResults(): void {
  const state = store.getState();
  const results = state.globalSearchResults;
  const hasSelection = state.selectedNode;
  const isAlreadyLinked = state.selectedNode?.multilanId;
  const globalSearchInput = getElementById<HTMLInputElement>('globalSearchInput');
  const searchQuery = globalSearchInput.value.trim();

  const globalSearchResults = getElementById<HTMLDivElement>('globalSearchResults');
  const globalSearchResultsCount = getElementById<HTMLDivElement>('globalSearchResultsCount');

  if (results.length === 0) {
    globalSearchResultsCount.textContent = '';
    if (searchQuery) {
      globalSearchResults.innerHTML = '<div class="empty-state">No translations found</div>';
    } else {
      globalSearchResults.innerHTML = '<div class="empty-state">Start typing to search translations</div>';
    }
    return;
  }

  // Sort results: linked translation first, then rest in original order
  const sortedResults = isAlreadyLinked
    ? [...results].sort((a, b) => {
        if (a.multilanId === isAlreadyLinked) return -1;
        if (b.multilanId === isAlreadyLinked) return 1;
        return 0;
      })
    : results;

  globalSearchResultsCount.textContent = `${results.length} result${results.length > 1 ? 's' : ''} found`;

  globalSearchResults.innerHTML = sortedResults.map(result => {
    const primaryText = result.translations[state.currentLang] || result.translations['en'] || Object.values(result.translations)[0];
    const isCurrentLink = isAlreadyLinked && state.selectedNode?.multilanId === result.multilanId;
    const hasVariables = result.variableOccurrences && result.variableOccurrences.length > 0;
    const variableKeys = hasVariables ? result.variableOccurrences!.map(v => v.key) : [];
    const metadataJson = getMetadataJson(result);

    // Initialize variable values - use stored values if this is the currently linked result
    if (hasVariables) {
      if (isCurrentLink && state.selectedNode?.variableValues) {
        // Pre-fill with stored values from the linked node
        variableValues.set(result.multilanId, { ...state.selectedNode.variableValues });
      } else if (!variableValues.has(result.multilanId)) {
        variableValues.set(result.multilanId, {});
      }
    }

    // Get current values for pre-filling inputs
    const currentValues = hasVariables ? (variableValues.get(result.multilanId) || {}) : {};

    return `
      <div class="search-result-card" data-multilan-id="${escapeHtml(result.multilanId)}">
        <div class="search-result-header">
          <div class="search-result-id-row">
            <span class="btn-sm btn-sm-success clickable-id" data-id="${escapeHtml(result.multilanId)}" title="Click to copy">${escapeHtml(result.multilanId)}</span>
            ${getStatusBadge(result.metadata?.status)}
          </div>
        </div>
        <div class="translations-preview">
          ${Object.entries(result.translations).map(([lang, text]) => `
            <div class="translation-row">
              <span class="translation-lang">${lang.toUpperCase()}</span>
              <span class="translation-text">${formatTranslationWithPills(text)}</span>
              <button class="copy-btn icon-btn" data-text="${escapeHtml(text)}" title="Copy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
            </div>
          `).join('')}
        </div>
        ${hasVariables ? `
        <div class="variables-section">
          <div class="variables-label">Variables</div>
          <div class="variables-list">
            ${result.variableOccurrences!.map(varOcc => `
            <div class="variable-row">
              <span class="var-name">${escapeHtml(varOcc.name)}${varOcc.isIndexed ? `<span class="var-index">(${varOcc.index})</span>` : ''}</span>
              <input type="text"
                class="variable-input"
                data-multilan-id="${escapeHtml(result.multilanId)}"
                data-var-key="${escapeHtml(varOcc.key)}"
                value="${escapeHtml(currentValues[varOcc.key] || '')}"
              />
            </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        <div class="search-result-actions">
          ${state.canEdit && hasSelection && !isCurrentLink ? `<button class="btn-link-result btn-sm btn-sm-success" data-id="${escapeHtml(result.multilanId)}" ${hasVariables ? `data-has-variables="true" data-variable-keys="${escapeHtml(variableKeys.join(','))}"` : ''}>${hasVariables ? 'Link with values' : 'Link'}</button>` : ''}
          ${state.canEdit && isCurrentLink && hasVariables ? `<button class="btn-link-result btn-sm btn-sm-success" data-id="${escapeHtml(result.multilanId)}" data-has-variables="true" data-variable-keys="${escapeHtml(variableKeys.join(','))}">Update values</button>` : ''}
          ${isCurrentLink && !hasVariables ? `<span class="currently-linked-text">Currently linked</span>` : ''}
          ${state.canEdit ? `<button class="btn-create-result btn-sm btn-sm-primary" data-id="${escapeHtml(result.multilanId)}" data-text="${escapeHtml(primaryText)}" ${hasVariables ? `data-has-variables="true" data-variable-keys="${escapeHtml(variableKeys.join(','))}"` : ''}>${hasVariables ? 'Create with values' : 'Create'}</button>` : ''}
          ${metadataJson ? `<button class="btn-info-toggle" title="Show details"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></button>` : ''}
        </div>
        ${metadataJson ? `<div class="metadata-info collapsed">${buildMetadataContent(metadataJson)}</div>` : ''}
      </div>
    `;
  }).join('');

  // Add event handlers
  attachSearchResultHandlers();
}

function attachSearchResultHandlers(): void {
  const globalSearchResults = getElementById<HTMLDivElement>('globalSearchResults');
  const state = store.getState();

  // Clickable ID handlers
  globalSearchResults.querySelectorAll<HTMLSpanElement>('.clickable-id').forEach(span => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = span.dataset.id!;
      if (copyToClipboard(id)) {
        const originalText = span.textContent;
        span.textContent = 'Copied!';
        setTimeout(() => {
          span.textContent = originalText;
        }, 1000);
      }
    });
  });

  // Copy text handlers
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

  // Variable input handlers
  globalSearchResults.querySelectorAll<HTMLInputElement>('.variable-input').forEach(input => {
    input.addEventListener('input', () => {
      const multilanId = input.dataset.multilanId!;
      const varKey = input.dataset.varKey!;
      const values = variableValues.get(multilanId) || {};
      values[varKey] = input.value;
      variableValues.set(multilanId, values);
    });
  });

  // Link button handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-link-result').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const multilanId = btn.dataset.id!;
      if (!state.selectedNode) return;
      const hasVariables = btn.dataset.hasVariables === 'true';
      const variableKeys = btn.dataset.variableKeys?.split(',') || [];
      const variables = hasVariables ? variableValues.get(multilanId) : undefined;

      // Validate all variables are filled
      if (hasVariables && variableKeys.length > 0) {
        const missingVars = variableKeys.filter(v => !variables?.[v]?.trim());
        if (missingVars.length > 0) {
          alert(`Please fill in all variables: ${missingVars.join(', ')}`);
          return;
        }
      }

      pluginBridge.linkNode(state.selectedNode.id, multilanId, state.currentLang, variables);
    });
  });

  // Create button handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-create-result').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const multilanId = btn.dataset.id!;
      const text = btn.dataset.text!;
      const hasVariables = btn.dataset.hasVariables === 'true';
      const variableKeys = btn.dataset.variableKeys?.split(',') || [];
      const variables = hasVariables ? variableValues.get(multilanId) : undefined;

      // Validate all variables are filled
      if (hasVariables && variableKeys.length > 0) {
        const missingVars = variableKeys.filter(v => !variables?.[v]?.trim());
        if (missingVars.length > 0) {
          alert(`Please fill in all variables: ${missingVars.join(', ')}`);
          return;
        }
      }

      pluginBridge.createLinkedText(multilanId, text, state.currentLang, variables);
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
}

export function setSearchQuery(query: string): void {
  const globalSearchInput = getElementById<HTMLInputElement>('globalSearchInput');
  globalSearchInput.value = query;
}

export function clearSearch(): void {
  const globalSearchInput = getElementById<HTMLInputElement>('globalSearchInput');
  globalSearchInput.value = '';
  store.setState({ globalSearchResults: [] });
  renderGlobalSearchResults();
}

export function triggerSearch(query: string): void {
  setSearchQuery(query);
  if (query.length >= 1) {
    pluginBridge.globalSearch(query);
  }
}
