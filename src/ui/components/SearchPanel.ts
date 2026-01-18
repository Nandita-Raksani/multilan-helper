import type { SearchResult } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById } from '../utils/dom';
import { escapeHtml, copyToClipboard, showButtonFeedback, debounce } from '../utils/dom';

let searchTimeout: ReturnType<typeof setTimeout>;

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
        <div class="search-result-actions">
          ${hasSelection && !isCurrentLink ? `<button class="btn-link-result btn-create-text" data-id="${escapeHtml(result.multilanId)}" style="background: #10b981;">Link</button>` : ''}
          ${isCurrentLink ? `<span style="color: #10b981; font-size: 10px; padding: 6px 0;">✓ Currently linked</span>` : ''}
          <button class="btn-create-result btn-create-text" data-id="${escapeHtml(result.multilanId)}" data-text="${escapeHtml(primaryText)}">Create</button>
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

  // Link button handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-link-result').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const multilanId = btn.dataset.id!;
      if (!state.selectedNode) return;
      pluginBridge.linkNode(state.selectedNode.id, multilanId);
    });
  });

  // Create button handlers
  globalSearchResults.querySelectorAll<HTMLButtonElement>('.btn-create-result').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const multilanId = btn.dataset.id!;
      const text = btn.dataset.text!;
      pluginBridge.createLinkedText(multilanId, text, state.currentLang);
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
