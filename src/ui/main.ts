import type { Language, PluginMessage } from '../shared/types';
import { SUPPORTED_LANGUAGES } from '../shared/types';
import { store } from './state/store';
import { pluginBridge } from './services/pluginBridge';
import { fetchTranslations, setFetchProgressCallback } from './services/translationFetcher';
import {
  initLanguageBar,
  initTabs,
  initSearchPanel,
  initLinksPanel,
  initBulkLinkModal,
  initStatusBar,
  updateSearchSelectedNode,
  renderGlobalSearchResults,
  renderTextList,
  showBulkLinkModal,
  renderBulkLinkResults,
  setStatus,
  setBuildTimestamp,
  setViewMode,
  getCurrentTab,
  triggerSearch,
  clearSearch,
  setActiveLanguage,
  updateSearchHint,
  hideAutoLinkTab
} from './components';

/**
 * Get user's preferred language from browser settings
 * Maps browser locale to our supported languages
 */
function getBrowserLanguage(): Language {
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';
  const langCode = browserLang.split('-')[0].toLowerCase();

  if (SUPPORTED_LANGUAGES.includes(langCode as Language)) {
    return langCode as Language;
  }
  return 'en';
}

function handlePluginMessage(msg: PluginMessage): void {
  switch (msg.type) {
    case 'init': {
      // Use detected language if nodes exist, otherwise use browser preference
      const browserLang = getBrowserLanguage();
      const hasLinkedNodes = msg.textNodes?.some(n => n.multilanId) || false;
      const initialLang = hasLinkedNodes && msg.detectedLanguage
        ? msg.detectedLanguage
        : browserLang;

      store.setState({
        canEdit: msg.canEdit,
        textNodes: msg.textNodes || [],
        selectedNode: msg.selectedNode || null,
        currentLang: initialLang,
        translationCount: msg.translationCount || 0
      });

      if (!msg.canEdit) {
        setViewMode(true);
        hideAutoLinkTab();
      }

      setActiveLanguage(initialLang);
      updateSearchHint();

      setStatus(`${msg.translationCount} translations loaded`);
      if (msg.buildTimestamp) {
        setBuildTimestamp(msg.buildTimestamp);
      }
      renderTextList();
      updateSearchSelectedNode();
      break;
    }

    case 'text-nodes-updated':
      store.setState({
        textNodes: msg.textNodes || []
      });
      if (msg.selectedNode !== undefined) {
        store.setState({ selectedNode: msg.selectedNode || null });
        updateSearchSelectedNode();
      }
      renderTextList();
      break;

    case 'selection-changed': {
      store.setState({
        selectedNode: msg.selectedNode || null,
        hasSelection: msg.hasSelection || false
      });
      updateSearchSelectedNode();

      // Update text list if in selection mode
      const state = store.getState();
      if (state.scope === 'selection' && msg.selectionTextNodes) {
        store.setState({ textNodes: msg.selectionTextNodes });
        renderTextList();
      }

      // Auto-search when text is selected and Search tab is active
      if (getCurrentTab() === 'search') {
        if (state.selectedNode) {
          const text = state.selectedNode.characters.slice(0, 30);
          triggerSearch(text);
        } else {
          clearSearch();
        }
      }
      break;
    }

    case 'language-switched': {
      // Only show status when there's something noteworthy
      if (msg.missing && msg.missing.length > 0) {
        setStatus(`${msg.missing.length} missing translations (using English fallback)`);
      } else if (msg.success === 0) {
        setStatus('No linked texts to update');
      }
      break;
    }

    case 'bulk-auto-link-results':
      store.setState({
        bulkLinkResults: {
          exactMatches: msg.exactMatches || [],
          fuzzyMatches: msg.fuzzyMatches || [],
          unmatched: msg.unmatched || []
        }
      });
      renderBulkLinkResults();
      showBulkLinkModal();
      break;

    case 'global-search-results':
      store.setState({ globalSearchResults: msg.results || [] });
      renderGlobalSearchResults();
      break;

    case 'text-created':
      setStatus(`Created text node linked to ${msg.multilanId}`);
      pluginBridge.refresh(store.getState().scope);
      break;

    case 'request-translations':
      // Plugin is requesting translations - fetch from API
      handleTranslationFetch();
      break;

    case 'api-status':
      // Update status bar with API result
      if (msg.status === 'success' && msg.count) {
        setStatus(`${msg.count.toLocaleString()} translations loaded`);
      } else if (msg.status === 'error' && msg.backupDate) {
        setStatus(`Using backup from ${msg.backupDate}`);
      }
      break;
  }
}

async function handleTranslationFetch(): Promise<void> {
  setStatus('Fetching from API...');

  // Set up progress callback
  setFetchProgressCallback((loaded, total) => {
    const percent = Math.round((loaded / total) * 100);
    setStatus(`Fetching from API: ${loaded.toLocaleString()} / ${total.toLocaleString()} (${percent}%)`);
  });

  const result = await fetchTranslations();

  // Clear progress callback
  setFetchProgressCallback(null);

  if (result.success && result.data) {
    const stats = result.stats;
    const countText = stats ? `${stats.totalElements.toLocaleString()} translations` : 'translations';
    setStatus(`Loaded ${countText} from API`);
    pluginBridge.send({
      type: 'translations-fetched',
      translationData: result.data,
      translationSource: 'api',
    });
  } else {
    setStatus('API fetch failed - using backup');
    pluginBridge.send({
      type: 'translations-fetched',
      translationSource: 'bundled',
    });
  }
}

function init(): void {
  // Initialize all components
  initLanguageBar();
  initTabs();
  initSearchPanel();
  initLinksPanel();
  initBulkLinkModal();
  initStatusBar();

  // Subscribe to plugin messages
  pluginBridge.subscribe(handlePluginMessage);

  // Request initial data from plugin
  pluginBridge.init();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
