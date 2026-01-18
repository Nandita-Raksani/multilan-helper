import type { SearchResult, MultilanStatus } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById } from '../utils/dom';
import { escapeHtml, copyToClipboard, showButtonFeedback, debounce } from '../utils/dom';

// Track variable values per multilanId
const variableValues: Map<string, Record<string, string>> = new Map();

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
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getMetadataTooltip(result: SearchResult): string {
  if (!result.metadata) return '';
  const { createdAt, modifiedAt, modifiedBy, sourceLanguageId } = result.metadata;
  const lines = [];
  if (sourceLanguageId) lines.push(`Source: ${sourceLanguageId.toUpperCase()}`);
  if (createdAt) lines.push(`Created: ${formatDate(createdAt)}`);
  if (modifiedAt) lines.push(`Modified: ${formatDate(modifiedAt)}`);
  if (modifiedBy) lines.push(`By: ${modifiedBy}`);
  return lines.join('\n');
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

    // Show action buttons based on link status
    if (isLinked) {
      searchSelectedActions.innerHTML = `
        <button class="btn-sm btn-sm-outline" id="searchUnlinkBtn">Unlink</button>
      `;

      getElementById('searchUnlinkBtn').addEventListener('click', () => {
        pluginBridge.unlinkNode(state.selectedNode!.id);
      });

      // Click badge to copy ID
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

  globalSearchResultsCount.textContent = `${results.length} result${results.length > 1 ? 's' : ''} found`;

  globalSearchResults.innerHTML = results.map(result => {
    const primaryText = result.translations[state.currentLang] || result.translations['en'] || Object.values(result.translations)[0];
    const isCurrentLink = isAlreadyLinked && state.selectedNode?.multilanId === result.multilanId;
    const hasVariables = result.variableOccurrences && result.variableOccurrences.length > 0;
    const variableKeys = hasVariables ? result.variableOccurrences!.map(v => v.key) : [];
    const tooltipText = getMetadataTooltip(result);

    // Initialize variable values for this result if not exists
    if (hasVariables && !variableValues.has(result.multilanId)) {
      variableValues.set(result.multilanId, {});
    }

    return `
      <div class="search-result-card" data-multilan-id="${escapeHtml(result.multilanId)}" ${tooltipText ? `data-tooltip="${escapeHtml(tooltipText)}"` : ''}>
        <div class="search-result-header">
          <div class="search-result-id-row">
            ${getStatusBadge(result.metadata?.status)}
            <span class="btn-sm btn-sm-success clickable-id" data-id="${escapeHtml(result.multilanId)}" title="Click to copy">${escapeHtml(result.multilanId)}</span>
          </div>
        </div>
        <div class="translations-preview">
          ${Object.entries(result.translations).map(([lang, text]) => `
            <div class="translation-row">
              <span class="translation-lang">${lang.toUpperCase()}</span>
              <span class="translation-text">${escapeHtml(text)}</span>
              <button class="copy-btn" data-text="${escapeHtml(text)}">Copy</button>
            </div>
          `).join('')}
        </div>
        ${hasVariables ? `
        <div class="variables-section" style="padding: 8px 0; border-top: 1px solid var(--figma-color-border);">
          <div style="font-size: 10px; color: var(--figma-color-text-secondary); margin-bottom: 6px;">Variables:</div>
          ${result.variableOccurrences!.map(varOcc => `
            <div class="variable-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <label style="font-size: 11px; min-width: 80px; color: var(--figma-color-text);">${escapeHtml(varOcc.name)}${varOcc.isIndexed ? ` (${varOcc.index})` : ''}:</label>
              <input type="text"
                class="variable-input"
                data-multilan-id="${escapeHtml(result.multilanId)}"
                data-var-key="${escapeHtml(varOcc.key)}"
                placeholder="Enter value"
                style="flex: 1; padding: 4px 8px; font-size: 11px; border: 1px solid var(--figma-color-border); border-radius: 4px; background: var(--figma-color-bg); color: var(--figma-color-text);"
              />
            </div>
          `).join('')}
        </div>
        ` : ''}
        <div class="search-result-actions">
          ${hasSelection && !isCurrentLink ? `<button class="btn-link-result btn-sm btn-sm-success" data-id="${escapeHtml(result.multilanId)}" ${hasVariables ? `data-has-variables="true" data-variable-keys="${escapeHtml(variableKeys.join(','))}"` : ''}>${hasVariables ? 'Link with values' : 'Link'}</button>` : ''}
          ${isCurrentLink ? `<span class="currently-linked-text">Currently linked</span>` : ''}
          <button class="btn-create-result btn-sm btn-sm-primary" data-id="${escapeHtml(result.multilanId)}" data-text="${escapeHtml(primaryText)}" ${hasVariables ? `data-has-variables="true" data-variable-keys="${escapeHtml(variableKeys.join(','))}"` : ''}>${hasVariables ? 'Create with values' : 'Create'}</button>
        </div>
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
        showButtonFeedback(btn, 'Copy', 'Copied!');
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
