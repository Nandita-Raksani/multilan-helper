import type { Language, PluginMessage } from '../shared/types';
import { SUPPORTED_LANGUAGES, FOLDER_NAMES } from '../shared/types';
import { store } from './state/store';
import { pluginBridge } from './services/pluginBridge';
import {
  initLanguageBar,
  initTabs,
  initSearchPanel,
  initStatusBar,
  initFolderSelector,
  renderFolderButtons,
  renderGlobalSearchResults,
  setStatus,
  setViewMode,
  getCurrentTab,
  clearSearch,
  setActiveLanguage,
  updateSearchHint,
  hideLanguageBar,
  renderFramePanel,
  isFrameMode,
  showSearchBar,
  updateLanguageAvailability
} from './components';
import { handleFrameMatchResult, clearCloseMatchSearchState } from './components/FramePanel';
import { handleUnlinkedQueue, advanceQueue, exitHighlightModePublic, resetSingleNodeSearchState, handleSingleNodeFuzzyResult } from './components/SearchPanel';
import { showTraUploadModal, hideTraUploadModal } from './components/TraUploadModal';
import { showToast } from './components/Toast';
import { handleVerifyResult } from './components/ManualLinkWidget';

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

      const folderNames = msg.folderNames || [];
      const currentFolder = msg.folderName || folderNames[0] || 'EB';
      const folderDataStatus = msg.folderDataStatus || {};
      const hasTranslations = (msg.translationCount || 0) > 0;

      store.setState({
        canEdit: msg.canEdit,
        textNodes: msg.textNodes || [],
        selectedNode: msg.selectedNode || null,
        currentLang: initialLang,
        translationCount: msg.translationCount || 0,
        folderNames,
        currentFolder,
        folderDataStatus
      });

      if (!msg.canEdit) {
        setViewMode(true);
        hideLanguageBar();
      }

      // No folder active if no translations loaded
      renderFolderButtons(folderNames, hasTranslations ? currentFolder : null, folderDataStatus);
      const availableLangs = folderDataStatus[currentFolder]?.metadata?.availableLanguages;
      updateLanguageAvailability(hasTranslations ? availableLangs : undefined);
      // If current language not available, switch to first available
      if (availableLangs && availableLangs.length > 0 && !availableLangs.includes(initialLang)) {
        const fallbackLang = availableLangs[0] as Language;
        setActiveLanguage(fallbackLang);
        store.setState({ currentLang: fallbackLang });
      } else {
        setActiveLanguage(initialLang);
      }
      updateSearchHint();

      setStatus(`${msg.translationCount} translations loaded`);
      renderGlobalSearchResults();
      break;
    }

    case 'text-nodes-updated':
      store.batch(() => {
        store.setState({
          textNodes: msg.textNodes || []
        });
        if (!store.getState().suppressFrameMode) {
          if (msg.selectionTextNodes !== undefined) {
            store.setState({
              selectionTextNodes: msg.selectionTextNodes || [],
              frameMatchResults: msg.frameMatchResults || [],
            });
          }
          if (msg.selectedNode !== undefined) {
            store.setState({
              selectedNode: msg.selectedNode || null,
              matchResult: msg.matchResult || null
            });
          }
        }
      });
      if (!store.getState().suppressFrameMode && isFrameMode()) {
        renderFramePanel();
      } else {
        renderGlobalSearchResults();
      }
      if (store.getState().isHighlightMode) {
        advanceQueue();
      }
      break;

    case 'node-updated': {
      // Incremental update — patch the single changed node in the list
      store.batch(() => {
        if (msg.nodeInfo) {
          const state = store.getState();
          const updatedNodes = state.textNodes.map(n =>
            n.id === msg.nodeInfo!.id ? msg.nodeInfo! : n
          );
          store.setState({ textNodes: updatedNodes });
        }
        if (!store.getState().suppressFrameMode) {
          if (msg.selectionTextNodes !== undefined) {
            store.setState({
              selectionTextNodes: msg.selectionTextNodes || [],
              frameMatchResults: msg.frameMatchResults || [],
            });
          }
          if (msg.selectedNode !== undefined) {
            store.setState({
              selectedNode: msg.selectedNode || null,
              matchResult: msg.matchResult || null
            });
          }
        }
      });
      if (!store.getState().suppressFrameMode && isFrameMode()) {
        renderFramePanel();
      } else {
        renderGlobalSearchResults();
      }
      if (store.getState().isHighlightMode) {
        advanceQueue();
      }
      break;
    }

    case 'selection-changed': {
      // Reset per-node close-match search state on new selection
      clearCloseMatchSearchState();
      resetSingleNodeSearchState();

      const highlightUnlinkedBtn = document.getElementById('highlightUnlinkedBtn') as HTMLButtonElement | null;

      // Skip UI updates during highlight mode — the queue controls navigation
      if (store.getState().isHighlightMode) {
        store.setState({
          selectedNode: msg.selectedNode || null,
          hasSelection: msg.hasSelection || false,
          matchResult: msg.matchResult || null
        });
        // If selection is lost during highlight mode, exit it
        if (!msg.hasSelection) {
          exitHighlightModePublic();
        }
        break;
      }

      // After exiting highlight mode, ignore stale messages until selection is cleared
      if (store.getState().suppressFrameMode) {
        if (msg.hasSelection) break;
        store.setState({ suppressFrameMode: false });
      }

      store.setState({
        selectedNode: msg.selectedNode || null,
        selectionTextNodes: msg.selectionTextNodes || [],
        frameMatchResults: msg.frameMatchResults || [],
        hasSelection: msg.hasSelection || false,
        matchResult: msg.matchResult || null
      });

      // Enable/disable highlight button based on selection
      if (highlightUnlinkedBtn) {
        highlightUnlinkedBtn.disabled = !msg.hasSelection;
        // Native title only when enabled; JS tooltip handles disabled state
        if (msg.hasSelection) {
          highlightUnlinkedBtn.title = 'Show unlinked text nodes on canvas';
        } else {
          highlightUnlinkedBtn.removeAttribute('title');
        }
      }

      if (isFrameMode()) {
        renderFramePanel();
      } else {
        showSearchBar();
        // Auto-search when text is selected — search results will re-render with badges
        if (getCurrentTab() === 'search') {
          const state = store.getState();
          if (state.selectedNode) {
            // Show only detectMatch results (exact or top 5 close matches at ≥80%)
            // No auto global search — keeps single-node consistent with multi-node
            store.setState({ globalSearchResults: [] });
            renderGlobalSearchResults();
          } else {
            clearSearch();
          }
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

    case 'match-detected': {
      // Guard: only apply if the result matches the currently selected node
      const currentSelectedNode = store.getState().selectedNode;
      const isRelevant = !msg.nodeId || !currentSelectedNode || currentSelectedNode.id === msg.nodeId;
      if (isRelevant) {
        // Transition fuzzy state before setting store/rendering
        if (msg.matchResult) {
          handleSingleNodeFuzzyResult(msg.matchResult.status);
        }
        store.setState({ matchResult: msg.matchResult || null });
        if (isFrameMode()) {
          renderFramePanel();
        } else {
          showSearchBar();
          renderGlobalSearchResults();
        }
      }
      break;
    }

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

    case 'frame-match-result': {
      // On-demand fuzzy result for a single node in frame mode
      if (msg.nodeId && msg.matchResult) {
        handleFrameMatchResult(msg.nodeId, msg.matchResult.status);
        const state = store.getState();
        const updatedResults = state.frameMatchResults.map(r =>
          r.nodeId === msg.nodeId
            ? { ...r, matchResult: msg.matchResult! }
            : r
        );
        store.setState({ frameMatchResults: updatedResults });
        if (isFrameMode()) {
          renderFramePanel();
        }
      }
      break;
    }

    case 'tra-upload-needed':
      if (msg.folderName) {
        showTraUploadModal(msg.folderName, msg.traUploadMetadata);
      }
      break;

    case 'upload-failed': {
      const submitBtn = document.querySelector<HTMLButtonElement>('.tra-upload-submit');
      if (submitBtn) {
        submitBtn.textContent = 'Upload';
        submitBtn.disabled = false;
      }
      showToast('Upload failed — see plugin console for details');
      break;
    }

    case 'upload-success': {
      const folder = msg.folderName!;
      const count = msg.uploadedTranslationCount || 0;
      const newStatus = msg.folderDataStatus || store.getState().folderDataStatus;

      store.setState({
        folderDataStatus: newStatus,
        translationCount: count,
        currentFolder: folder
      });

      renderFolderButtons(store.getState().folderNames, folder, newStatus);
      // Update language availability for the uploaded folder
      const uploadedLangs = msg.traUploadMetadata?.availableLanguages;
      updateLanguageAvailability(uploadedLangs);
      // Auto-switch language if current one is not available
      const currentLang = store.getState().currentLang;
      if (uploadedLangs && uploadedLangs.length > 0 && !uploadedLangs.includes(currentLang)) {
        const fallback = uploadedLangs[0] as Language;
        setActiveLanguage(fallback);
        store.setState({ currentLang: fallback });
      }
      hideTraUploadModal();
      showToast(`Loaded ${count} translations for ${folder}`);
      setStatus(`${count} translations loaded`);
      break;
    }

    case 'verify-multilan-id-result': {
      if (msg.nodeId && msg.multilanId !== undefined && typeof msg.found === 'boolean') {
        const consumed = handleVerifyResult(
          msg.nodeId,
          msg.multilanId,
          msg.found,
          msg.translations,
        );
        if (consumed) {
          if (isFrameMode()) {
            renderFramePanel();
          } else {
            renderGlobalSearchResults();
          }
        }
      }
      break;
    }

  }
}

function init(): void {
  // Initialize all components
  initFolderSelector();
  initLanguageBar();
  initTabs();
  initSearchPanel();
  initStatusBar();

  // Render folder buttons immediately from the shared constant so the bar is
  // visible from frame one — the init message arrives later (after plugin font
  // preload + clientStorage reads) and just fills in the active/has-data state.
  renderFolderButtons([...FOLDER_NAMES], null);

  // Wire the bottom-right drag handle so the user can resize the plugin window
  // (handy when working across two monitors).
  initResizeHandle();

  // Wire the header collapse toggle so the panel can shrink to just its header
  // without closing the plugin.
  initCollapseToggle();

  // Subscribe to plugin messages
  pluginBridge.subscribe(handlePluginMessage);

  // Request initial data from plugin
  pluginBridge.init();
}

const MIN_UI_WIDTH = 320;
const MIN_UI_HEIGHT = 420;
/** Window height when collapsed — just the header bar (see .app-header in CSS). */
const COLLAPSED_UI_HEIGHT = 33;

/**
 * Collapse toggle: shrinks the plugin window down to just its header bar and
 * restores it, without closing the plugin. The pre-collapse height is remembered
 * so expanding returns to the same size.
 */
function initCollapseToggle(): void {
  const toggle = document.getElementById('collapseToggle');
  const app = document.getElementById('app');
  if (!toggle || !app) return;

  let collapsed = false;
  let expandedHeight = 0;

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    const width = Math.round(window.innerWidth);

    if (collapsed) {
      expandedHeight = Math.round(window.innerHeight);
      app.classList.add('is-collapsed');
      toggle.classList.add('is-collapsed');
      toggle.title = 'Expand';
      toggle.setAttribute('aria-label', 'Expand panel');
      // `collapsed` flag lets the plugin resize below the normal minimum height.
      pluginBridge.resizeUi(width, COLLAPSED_UI_HEIGHT, true);
    } else {
      app.classList.remove('is-collapsed');
      toggle.classList.remove('is-collapsed');
      toggle.title = 'Collapse';
      toggle.setAttribute('aria-label', 'Collapse panel');
      pluginBridge.resizeUi(width, Math.max(MIN_UI_HEIGHT, expandedHeight));
    }
  });
}

function initResizeHandle(): void {
  const handle = document.getElementById('resizeHandle');
  if (!handle) return;

  let resizing = false;
  let pointerId = -1;
  let frame = 0;
  let pendingW = 0;
  let pendingH = 0;

  const flush = (): void => {
    frame = 0;
    pluginBridge.resizeUi(pendingW, pendingH);
  };

  handle.addEventListener('pointerdown', (e) => {
    resizing = true;
    pointerId = e.pointerId;
    handle.setPointerCapture(pointerId);
    handle.classList.add('is-resizing');
    document.body.classList.add('is-resizing');
    e.preventDefault();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    pendingW = Math.max(MIN_UI_WIDTH, Math.round(e.clientX + 4));
    pendingH = Math.max(MIN_UI_HEIGHT, Math.round(e.clientY + 4));
    if (frame === 0) frame = requestAnimationFrame(flush);
  });

  const stop = (): void => {
    if (!resizing) return;
    resizing = false;
    if (pointerId !== -1 && handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    pointerId = -1;
    handle.classList.remove('is-resizing');
    document.body.classList.remove('is-resizing');
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
      pluginBridge.resizeUi(pendingW, pendingH);
    }
  };

  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
