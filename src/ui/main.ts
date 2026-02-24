import type { Language, PluginMessage } from '../shared/types';
import { SUPPORTED_LANGUAGES } from '../shared/types';
import { store } from './state/store';
import { pluginBridge } from './services/pluginBridge';
import {
  initLanguageBar,
  initTabs,
  initSearchPanel,
  initStatusBar,
  renderGlobalSearchResults,
  setStatus,
  setBuildTimestamp,
  setViewMode,
  getCurrentTab,
  triggerSearch,
  clearSearch,
  setActiveLanguage,
  updateSearchHint,
  hideLanguageBar
} from './components';
import { handleUnlinkedQueue, advanceQueue } from './components/SearchPanel';

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
        hideLanguageBar();
      }

      setActiveLanguage(initialLang);
      updateSearchHint();

      setStatus(`${msg.translationCount} translations loaded`);
      if (msg.buildTimestamp) {
        setBuildTimestamp(msg.buildTimestamp);
      }
      renderGlobalSearchResults();
      break;
    }

    case 'text-nodes-updated':
      store.setState({
        textNodes: msg.textNodes || []
      });
      if (msg.selectedNode !== undefined) {
        store.setState({
          selectedNode: msg.selectedNode || null,
          matchResult: msg.matchResult || null
        });
        renderGlobalSearchResults();
      }
      // In highlight mode, after a link/unlink the node list changed — advance queue
      if (store.getState().isHighlightMode) {
        advanceQueue();
      }
      break;

    case 'selection-changed': {
      store.setState({
        selectedNode: msg.selectedNode || null,
        hasSelection: msg.hasSelection || false,
        matchResult: msg.matchResult || null
      });

      // Auto-search when text is selected — search results will re-render with badges
      if (getCurrentTab() === 'search') {
        const state = store.getState();
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
      if (msg.missing && msg.missing.length > 0) {
        setStatus(`${msg.missing.length} missing translations (using English fallback)`);
      } else if (msg.success === 0) {
        setStatus('No linked texts to update');
      }
      break;
    }

    case 'match-detected':
      store.setState({ matchResult: msg.matchResult || null });
      renderGlobalSearchResults();
      break;

    case 'unlinked-queue':
      store.setState({ unlinkedQueue: msg.unlinkedQueue || [] });
      handleUnlinkedQueue();
      break;

    case 'global-search-results':
      store.setState({ globalSearchResults: msg.results || [] });
      renderGlobalSearchResults();
      break;

    case 'text-created':
      setStatus(`Created text node linked to ${msg.multilanId}`);
      pluginBridge.refresh(store.getState().scope);
      break;

  }
}

function init(): void {
  // Initialize all components
  initLanguageBar();
  initTabs();
  initSearchPanel();
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
