import type { SearchResult } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById } from '../utils/dom';
import { escapeHtml, copyToClipboard, showButtonFeedback, debounce } from '../utils/dom';

let searchTimeout: ReturnType<typeof setTimeout>;

// Track variable values per multilanId
const variableValues: Map<string, Record<string, string>> = new Map();

export function initSearchPanel(): void {
  const globalSearchInput = getElementById<HTMLInputElement>('globalSearchInput');
  const searchMarkPlaceholderBtn = getElementById<HTMLButtonElement>('searchMarkPlaceholderBtn');

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

  // Mark as placeholder button
  searchMarkPlaceholderBtn.addEventListener('click', () => {
    const searchPlaceholderText = getElementById<HTMLInputElement>('searchPlaceholderText');
    const text = searchPlaceholderText.value.trim();
    const searchQuery = globalSearchInput.value.trim();
    const state = store.getState();

    if (!text) {
      alert('Please enter placeholder text');
      return;
    }
    if (!state.selectedNode) {
      alert('Please select a text layer in Figma first');
      return;
    }

    pluginBridge.markAsPlaceholder(text);
    searchPlaceholderText.value = '';
  });
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
      searchSelectedBadge.style.background = '#10b981';
    } else {
      searchSelectedBadge.textContent = 'Not linked';
      searchSelectedBadge.style.background = '#f59e0b';
    }

    // Show action buttons based on link status
    if (isLinked) {
      searchSelectedActions.innerHTML = `
        <button class="btn btn-secondary" id="searchUnlinkBtn" style="font-size: 10px; padding: 4px 10px;">Unlink</button>
        <button class="btn btn-secondary" id="searchMakePlaceholderBtn" style="font-size: 10px; padding: 4px 10px; background: #f59e0b; color: white;">Make placeholder</button>
      `;

      getElementById('searchUnlinkBtn').addEventListener('click', () => {
        pluginBridge.unlinkNode(state.selectedNode!.id);
      });

      getElementById('searchMakePlaceholderBtn').addEventListener('click', () => {
        pluginBridge.markAsPlaceholder(state.selectedNode!.characters);
      });
    } else {
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
  const searchPlaceholderSection = getElementById<HTMLDivElement>('searchPlaceholderSection');

  if (results.length === 0) {
    globalSearchResultsCount.textContent = '';
    if (searchQuery) {
      globalSearchResults.innerHTML = '<div class="empty-state">No translations found</div>';
      searchPlaceholderSection.style.display = hasSelection ? 'block' : 'none';
    } else {
      globalSearchResults.innerHTML = '<div class="empty-state">Start typing to search translations</div>';
      searchPlaceholderSection.style.display = 'none';
    }
    return;
  }

  searchPlaceholderSection.style.display = 'none';
  globalSearchResultsCount.textContent = `${results.length} result${results.length > 1 ? 's' : ''} found`;

  globalSearchResults.innerHTML = results.map(result => {
    const primaryText = result.translations[state.currentLang] || result.translations['en'] || Object.values(result.translations)[0];
    const isCurrentLink = isAlreadyLinked && state.selectedNode?.multilanId === result.multilanId;
    const hasVariables = result.variables && result.variables.length > 0;

    // Initialize variable values for this result if not exists
    if (hasVariables && !variableValues.has(result.multilanId)) {
      variableValues.set(result.multilanId, {});
    }

    return `
      <div class="search-result-card" data-multilan-id="${escapeHtml(result.multilanId)}">
        <div class="search-result-header">
          <span class="search-result-id">${escapeHtml(result.multilanId)}</span>
          <button class="btn-copy-id" data-id="${escapeHtml(result.multilanId)}">Copy ID</button>
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
          ${result.variables!.map(varName => `
            <div class="variable-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <label style="font-size: 11px; min-width: 60px; color: var(--figma-color-text);">${escapeHtml(varName)}:</label>
              <input type="text"
                class="variable-input"
                data-multilan-id="${escapeHtml(result.multilanId)}"
                data-var-name="${escapeHtml(varName)}"
                placeholder="Enter value"
                style="flex: 1; padding: 4px 8px; font-size: 11px; border: 1px solid var(--figma-color-border); border-radius: 4px; background: var(--figma-color-bg); color: var(--figma-color-text);"
              />
            </div>
          `).join('')}
        </div>
        ` : ''}
        <div class="search-result-actions">
          ${hasSelection && !isCurrentLink ? `<button class="btn-link-result btn-create-text" data-id="${escapeHtml(result.multilanId)}" ${hasVariables ? `data-has-variables="true" data-variable-names="${escapeHtml(result.variables!.join(','))}"` : ''} style="background: #10b981;">${hasVariables ? 'Link with values' : 'Link'}</button>` : ''}
          ${isCurrentLink ? `<span style="color: #10b981; font-size: 10px; padding: 6px 0;">Currently linked</span>` : ''}
          <button class="btn-create-result btn-create-text" data-id="${escapeHtml(result.multilanId)}" data-text="${escapeHtml(primaryText)}" ${hasVariables ? `data-has-variables="true" data-variable-names="${escapeHtml(result.variables!.join(','))}"` : ''}>${hasVariables ? 'Create with values' : 'Create'}</button>
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

  // Copy ID handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-copy-id').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id!;
      if (copyToClipboard(id)) {
        showButtonFeedback(btn, 'Copy ID', 'Copied!');
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
    input.addEventListener('input', (e) => {
      const multilanId = input.dataset.multilanId!;
      const varName = input.dataset.varName!;
      const values = variableValues.get(multilanId) || {};
      values[varName] = input.value;
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
      const variableNames = btn.dataset.variableNames?.split(',') || [];
      const variables = hasVariables ? variableValues.get(multilanId) : undefined;

      // Validate all variables are filled
      if (hasVariables && variableNames.length > 0) {
        const missingVars = variableNames.filter(v => !variables?.[v]?.trim());
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
      const variableNames = btn.dataset.variableNames?.split(',') || [];
      const variables = hasVariables ? variableValues.get(multilanId) : undefined;

      // Validate all variables are filled
      if (hasVariables && variableNames.length > 0) {
        const missingVars = variableNames.filter(v => !variables?.[v]?.trim());
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
