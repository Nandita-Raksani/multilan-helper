// Multilan Helper Plugin - Main entry point
// Runs in Figma's sandbox environment

import bundledApiData from "../translations/api-data.json";
import traFileEn from "../translations/en-BE.tra";
import traFileFr from "../translations/fr-BE.tra";
import traFileNl from "../translations/nl-BE.tra";
import traFileDe from "../translations/de-BE.tra";
import {
  TranslationMap,
  MetadataMap,
  PluginMessage,
  Language,
  SUPPORTED_LANGUAGES,
} from "../shared/types";
import { createAdapter } from "../adapters";
import { TraFileData } from "../adapters/types/traFile.types";
import {
  getAllTranslations,
  isLanguage,
  globalSearchTranslations,
  searchTranslations,
  detectLanguage,
} from "./services/translationService";
import {
  getAllTextNodesInfo,
  getSelectedTextNodeInfo,
  selectNode,
  getTextNodesInScope,
  getMultilanId,
  getExpectedText,
  isTextModified,
  clearMultilanId,
  clearExpectedText,
  removeMultilanIdFromName,
} from "./services/nodeService";
import {
  linkTextNode,
  unlinkTextNode,
  markAsPlaceholder,
  switchLanguage,
  bulkAutoLink,
  createLinkedTextNode,
} from "./services/linkingService";

// Build timestamp - update this when translations are updated
const BUILD_TIMESTAMP = "2026-01-18 12:00";

// Translation data - can be updated from API
let translationData: TranslationMap;
let metadataData: MetadataMap;

// Store original fills for highlighted nodes
const originalFills: Map<string, Paint[] | typeof figma.mixed> = new Map();

// Initialize with .tra files (primary bundled source)
function initializeTraFileData(): boolean {
  try {
    const traData: TraFileData = {
      en: traFileEn,
      fr: traFileFr,
      nl: traFileNl,
      de: traFileDe,
    };
    const adapter = createAdapter(traData, "tra-files");
    translationData = adapter.getTranslationMap();
    metadataData = adapter.getMetadataMap();
    console.log(`Loaded ${Object.keys(translationData).length} translations from .tra files`);
    return true;
  } catch (error) {
    console.error('Failed to parse .tra files:', error);
    return false;
  }
}

// Initialize with bundled JSON data (fallback)
function initializeBundledData(): void {
  const adapter = createAdapter(bundledApiData);
  translationData = adapter.getTranslationMap();
  metadataData = adapter.getMetadataMap();
  console.log(`Loaded ${Object.keys(translationData).length} translations from bundled JSON`);
}

// Initialize with fallback chain: .tra files -> JSON
function initializeWithFallback(): void {
  if (!initializeTraFileData()) {
    initializeBundledData();
  }
}

// Update with API data
function updateWithApiData(apiData: unknown): boolean {
  try {
    const adapter = createAdapter(apiData);
    translationData = adapter.getTranslationMap();
    metadataData = adapter.getMetadataMap();
    return true;
  } catch (error) {
    console.error('Failed to parse API data, falling back to bundled data:', error);
    initializeWithFallback();
    return false;
  }
}

// Initialize with fallback chain: .tra files -> JSON
initializeWithFallback();

// Helper to get translations for a multilanId
const getTranslations = (multilanId: string) => getAllTranslations(translationData, multilanId);

// Show UI
figma.showUI(__html__, {
  width: 360,
  height: 500,
  themeColors: true,
});

// Check if user can edit
function canEdit(): boolean {
  return figma.editorType === "figma";
}

// Auto-unlink nodes that have been modified from their expected text
function autoUnlinkModifiedNodes(scope: "page" | "selection"): number {
  const nodes = getTextNodesInScope(scope);
  let unlinkedCount = 0;

  for (const node of nodes) {
    const multilanId = getMultilanId(node);
    if (!multilanId) continue;

    // Check if text was modified from expected
    if (isTextModified(node)) {
      removeMultilanIdFromName(node);
      clearMultilanId(node);
      clearExpectedText(node);
      unlinkedCount++;
      continue;
    }

    // For nodes without expectedText (linked before this feature),
    // check if current text matches any translation for this multilanId
    const expectedText = getExpectedText(node);
    if (!expectedText) {
      const translations = getTranslations(multilanId);
      if (translations) {
        const currentText = node.characters;
        const matchesAnyTranslation = Object.values(translations).some(
          (text) => text === currentText
        );
        if (!matchesAnyTranslation) {
          // Text doesn't match any translation, unlink it
          removeMultilanIdFromName(node);
          clearMultilanId(node);
          unlinkedCount++;
        }
      }
    }
  }

  return unlinkedCount;
}

// Initialize: send initial data to UI
async function initialize(): Promise<void> {
  // Auto-unlink nodes that have been modified by designers
  const unlinkedCount = autoUnlinkModifiedNodes("page");
  if (unlinkedCount > 0) {
    figma.notify(`Auto-unlinked ${unlinkedCount} modified node${unlinkedCount > 1 ? 's' : ''}`);
  }

  const textNodes = getAllTextNodesInfo("page", getTranslations);
  const selectedNode = getSelectedTextNodeInfo(getTranslations);

  // Detect current language from linked nodes
  const allNodes = getTextNodesInScope("page");
  const linkedNodes = allNodes
    .map((node) => {
      const multilanId = getMultilanId(node);
      return multilanId ? { multilanId, characters: node.characters } : null;
    })
    .filter((n): n is { multilanId: string; characters: string } => n !== null);

  const detectedLanguage = detectLanguage(translationData, linkedNodes);

  figma.ui.postMessage({
    type: "init",
    canEdit: canEdit(),
    languages: SUPPORTED_LANGUAGES,
    textNodes,
    selectedNode,
    translationCount: Object.keys(translationData).length,
    buildTimestamp: BUILD_TIMESTAMP,
    detectedLanguage,
  });
}

// Handle selection change
figma.on("selectionchange", () => {
  const selectedNode = getSelectedTextNodeInfo(getTranslations);
  const selectionTextNodes = getAllTextNodesInfo("selection", getTranslations);
  const hasSelection = figma.currentPage.selection.length > 0;
  figma.ui.postMessage({
    type: "selection-changed",
    selectedNode,
    selectionTextNodes,
    hasSelection,
  });
});

// Handle messages from UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {
    case "init":
      // Request translations from UI (which will fetch from API)
      figma.ui.postMessage({ type: "request-translations" });
      break;

    case "translations-fetched":
      // UI has fetched (or failed to fetch) translations
      if (msg.translationSource === 'api' && msg.translationData) {
        const success = updateWithApiData(msg.translationData);
        if (success) {
          const count = Object.keys(translationData).length;
          figma.notify(`Loaded ${count.toLocaleString()} translations from API`);
          figma.ui.postMessage({ type: 'api-status', status: 'success', count });
        } else {
          figma.notify(`API data parsing failed`, { error: true, timeout: 2000 });
          figma.ui.postMessage({ type: 'api-status', status: 'error', backupDate: BUILD_TIMESTAMP });
        }
      } else {
        figma.notify(`API fetch failed`, { error: true, timeout: 2000 });
        figma.ui.postMessage({ type: 'api-status', status: 'error', backupDate: BUILD_TIMESTAMP });
      }
      // Now initialize with whatever data we have
      await initialize();
      break;

    case "switch-language":
      if (msg.language && isLanguage(msg.language)) {
        const scope = msg.scope || "page";

        if (!canEdit()) {
          figma.notify("You don't have edit permissions", { error: true });
          return;
        }

        const result = await switchLanguage(
          translationData,
          msg.language,
          scope
        );

        if (result.success > 0) {
          figma.notify(`Switched ${result.success} text(s) to ${msg.language.toUpperCase()}`);
        }

        figma.ui.postMessage({
          type: "language-switched",
          ...result,
        });

        // Refresh text nodes list
        const textNodes = getAllTextNodesInfo(scope, getTranslations);
        figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
      }
      break;

    case "search":
      if (msg.searchQuery) {
        const results = searchTranslations(translationData, msg.searchQuery);
        figma.ui.postMessage({
          type: "search-results",
          results,
        });
      }
      break;

    case "link-node":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.nodeId && msg.multilanId) {
        const success = await linkTextNode(
          msg.nodeId,
          msg.multilanId,
          translationData,
          msg.language
        );
        if (success) {
          figma.notify(`Linked to ${msg.multilanId}`);
          // Refresh
          const textNodes = getAllTextNodesInfo("page", getTranslations);
          const selectedNode = getSelectedTextNodeInfo(getTranslations);
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes, selectedNode });
        }
      }
      break;

    case "unlink-node":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.nodeId) {
        const success = await unlinkTextNode(msg.nodeId);
        if (success) {
          figma.notify("Unlinked");
          const textNodes = getAllTextNodesInfo("page", getTranslations);
          const selectedNode = getSelectedTextNodeInfo(getTranslations);
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes, selectedNode });
        }
      }
      break;

    case "select-node":
      if (msg.nodeId) {
        await selectNode(msg.nodeId);
      }
      break;

    case "refresh": {
      // Auto-unlink nodes that have been modified by designers
      const scope = msg.scope || "page";
      const unlinkedCount = autoUnlinkModifiedNodes(scope);
      if (unlinkedCount > 0) {
        figma.notify(`Auto-unlinked ${unlinkedCount} modified node${unlinkedCount > 1 ? 's' : ''}`);
      }
      const textNodes = getAllTextNodesInfo(scope, getTranslations);
      figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
      break;
    }

    case "lookup-multilanId":
      if (msg.multilanId) {
        const translations = getAllTranslations(translationData, msg.multilanId);
        figma.ui.postMessage({
          type: "lookup-result",
          multilanId: msg.multilanId,
          translations,
          found: translations !== null,
        });
      }
      break;

    case "mark-as-placeholder":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      {
        const selection = figma.currentPage.selection;
        if (selection.length !== 1 || selection[0].type !== "TEXT") {
          figma.notify("Please select a single text layer", { error: true });
          return;
        }
        const textNode = selection[0] as TextNode;
        if (msg.text) {
          await markAsPlaceholder(textNode, msg.text);
          figma.notify("Marked as placeholder");
          const textNodes = getAllTextNodesInfo("page", getTranslations);
          const selectedNode = getSelectedTextNodeInfo(getTranslations);
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes, selectedNode });
        }
      }
      break;

    case "bulk-auto-link":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      {
        figma.notify("Scanning for matches...");
        const result = bulkAutoLink(translationData, msg.scope || "page");
        const totalFound = result.exactMatches.length + result.fuzzyMatches.length;
        if (totalFound > 0) {
          figma.notify(
            `Found ${result.exactMatches.length} exact + ${result.fuzzyMatches.length} fuzzy matches`
          );
        } else {
          figma.notify("No matches found for unlinked text nodes");
        }
        figma.ui.postMessage({
          type: "bulk-auto-link-results",
          ...result,
        });
      }
      break;

    case "apply-exact-matches":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.confirmations && msg.confirmations.length > 0) {
        try {
          let successCount = 0;
          let failCount = 0;
          for (const match of msg.confirmations) {
            // Pass translationData to enable variable binding (but no language = don't change text)
            const success = await linkTextNode(match.nodeId, match.multilanId, translationData);
            if (success) {
              successCount++;
            } else {
              failCount++;
            }
          }
          if (failCount > 0) {
            figma.notify(`Linked ${successCount} nodes, ${failCount} failed`, {
              error: failCount > 0,
            });
          } else {
            figma.notify(`Successfully linked ${successCount} text nodes`);
          }
          const textNodes = getAllTextNodesInfo(msg.scope || "page", getTranslations);
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
        } catch (err) {
          figma.notify(`Error linking nodes: ${err}`, { error: true });
        }
      } else {
        figma.notify("No matches to apply");
      }
      break;

    case "confirm-fuzzy-link":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.nodeId && msg.multilanId) {
        // Pass translationData to enable variable binding
        const success = await linkTextNode(msg.nodeId, msg.multilanId, translationData);
        if (success) {
          figma.notify(`Linked to ${msg.multilanId}`);
          // Refresh text nodes list to update UI
          const textNodes = getAllTextNodesInfo(msg.scope || "page", getTranslations);
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
        }
      }
      break;

    case "global-search":
      if (msg.searchQuery) {
        const results = globalSearchTranslations(translationData, msg.searchQuery, 30, metadataData);
        figma.ui.postMessage({
          type: "global-search-results",
          results,
        });
      }
      break;

    case "create-linked-text":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.multilanId && msg.text) {
        const lang = (msg.language as Language) || "en";

        const textNode = await createLinkedTextNode(
          translationData,
          msg.multilanId,
          msg.text,
          lang
        );

        figma.notify(`Created text node: "${textNode.characters}" (${msg.multilanId})`);
        figma.ui.postMessage({
          type: "text-created",
          multilanId: msg.multilanId,
        });
      }
      break;

    case "refresh-translations":
      // Request fresh translations from API via UI
      figma.notify("Fetching from API...");
      figma.ui.postMessage({ type: "request-translations" });
      break;

    case "highlight-unlinked":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      {
        const scope = msg.scope || "page";
        const nodes = getTextNodesInScope(scope);
        const unlinkedNodes = nodes.filter(node => !getMultilanId(node));

        if (msg.highlight) {
          // Highlight: store original fills and apply highlight color
          const highlightFill: SolidPaint = {
            type: "SOLID",
            color: { r: 1, g: 0.8, b: 0.2 }, // Yellow/orange highlight
            opacity: 1
          };

          let count = 0;
          for (const node of unlinkedNodes) {
            // Store original fill
            originalFills.set(node.id, node.fills as Paint[] | typeof figma.mixed);
            // Apply highlight fill
            node.fills = [highlightFill];
            count++;
          }

          if (count > 0) {
            figma.notify(`Highlighted ${count} unlinked text node${count > 1 ? 's' : ''}`);
          } else {
            figma.notify("No unlinked text nodes found");
          }
        } else {
          // Unhighlight: restore original fills
          for (const node of unlinkedNodes) {
            const originalFill = originalFills.get(node.id);
            if (originalFill !== undefined) {
              node.fills = originalFill;
              originalFills.delete(node.id);
            }
          }

          // Also restore any remaining stored fills (in case nodes were linked while highlighted)
          for (const [nodeId, fill] of originalFills.entries()) {
            const node = figma.getNodeById(nodeId);
            if (node && node.type === "TEXT") {
              (node as TextNode).fills = fill;
            }
            originalFills.delete(nodeId);
          }

          figma.notify("Restored original text colors");
        }
      }
      break;

    case "set-translation-source":
      if (msg.translationSource === 'tra') {
        initializeTraFileData();
        figma.notify(`Loaded ${Object.keys(translationData).length} translations from .tra files`);
      } else {
        // Request fresh API data via UI
        figma.notify("Fetching from API...");
        figma.ui.postMessage({ type: "request-translations" });
      }
      // Re-initialize to update UI with new translation count
      initialize();
      break;

    case "close":
      figma.closePlugin();
      break;
  }
};

// Start
initialize();
