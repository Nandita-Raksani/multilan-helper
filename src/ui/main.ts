import type { PluginMessage } from '../shared/types';
import { store } from './state/store';
import { pluginBridge } from './services/pluginBridge';
import {
  initLanguageBar,
  initTabs,
  initSearchPanel,
  initLinksPanel,
  initBulkLinkModal,
  initSettingsPanel,
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
  setActiveLanguage
} from './components';

function handlePluginMessage(msg: PluginMessage): void {
  switch (msg.type) {
    case 'init':
      store.setState({
        canEdit: msg.canEdit,
        textNodes: msg.textNodes || [],
        selectedNode: msg.selectedNode || null,
        currentLang: msg.detectedLanguage || 'en'
      });

      if (!msg.canEdit) {
        setViewMode(true);
      }

      // Set the detected language in the UI
      if (msg.detectedLanguage) {
        setActiveLanguage(msg.detectedLanguage);
      }

      setStatus(`${msg.translationCount} translations loaded`);
      if (msg.buildTimestamp) {
        setBuildTimestamp(msg.buildTimestamp);
      }
      renderTextList();
      updateSearchSelectedNode();
      break;

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
      const prevSelectedNode = store.getState().selectedNode;
      store.setState({ selectedNode: msg.selectedNode || null });
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
      let statusMsg = `Updated ${msg.success} texts`;
      if (msg.missing && msg.missing.length > 0) {
        statusMsg += ` (${msg.missing.length} missing translations)`;
      }
      setStatus(statusMsg);
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
  }
}

function init(): void {
  // Initialize all components
  initLanguageBar();
  initTabs();
  initSearchPanel();
  initLinksPanel();
  initBulkLinkModal();
  initSettingsPanel();

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
