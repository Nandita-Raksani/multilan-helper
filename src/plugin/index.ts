// Multilan Helper Plugin - Main entry point
// Runs in Figma's sandbox environment

import apiData from "../translations/api-data.json";
import {
  ApiMultilan,
  TranslationMap,
  PluginMessage,
  Language,
  SUPPORTED_LANGUAGES,
} from "../shared/types";
import {
  buildTranslationMap,
  getAllTranslations,
  isLanguage,
  globalSearchTranslations,
  searchTranslations,
  detectLanguage,
  replaceVariables,
} from "./services/translationService";
import {
  getAllTextNodesInfo,
  getSelectedTextNodeInfo,
  selectNode,
  getTextNodesInScope,
  getMultilanId,
  setExpectedText,
  getExpectedText,
  isTextModified,
  clearMultilanId,
  clearExpectedText,
  setVariableValues,
} from "./services/nodeService";
import {
  linkTextNode,
  unlinkTextNode,
  markAsPlaceholder,
  switchLanguage,
  bulkAutoLink,
  applyExactMatches,
  createLinkedTextNode,
} from "./services/linkingService";

// Build timestamp - update this when translations are updated
const BUILD_TIMESTAMP = "2026-01-18 12:00";

// Build translation data from API format
const translationData: TranslationMap = buildTranslationMap(apiData as ApiMultilan[]);

// Helper to get translations for a multilanId
const getTranslations = (multilanId: string) => getAllTranslations(translationData, multilanId);

// Show UI
figma.showUI(__html__, {
  width: 320,
  height: 480,
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
          clearMultilanId(node);
          unlinkedCount++;
        }
      }
    }
  }

  return unlinkedCount;
}

// Initialize: send initial data to UI
function initialize(): void {
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
  figma.ui.postMessage({
    type: "selection-changed",
    selectedNode,
    selectionTextNodes,
  });
});

// Handle messages from UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {
    case "init":
      initialize();
      break;

    case "switch-language":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.language && isLanguage(msg.language)) {
        const result = await switchLanguage(
          translationData,
          msg.language,
          msg.scope || "page",
          msg.placeholders || {}
        );
        figma.ui.postMessage({
          type: "language-switched",
          ...result,
        });

        // Refresh text nodes list
        const textNodes = getAllTextNodesInfo(msg.scope || "page", getTranslations);
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
        // If variables are provided, we need to handle text replacement manually
        if (msg.variables && Object.keys(msg.variables).length > 0) {
          // Link without automatic text update
          const success = await linkTextNode(msg.nodeId, msg.multilanId);
          if (success) {
            // Get translation and replace variables
            const node = figma.getNodeById(msg.nodeId) as TextNode;
            if (node && msg.language) {
              const translation = getAllTranslations(translationData, msg.multilanId);
              if (translation && translation[msg.language]) {
                const replacedText = replaceVariables(translation[msg.language], msg.variables);
                await figma.loadFontAsync(node.fontName as FontName);
                node.characters = replacedText;
                // Store expected text for modification detection
                setExpectedText(node, replacedText);
                // Store variable values for language switching
                setVariableValues(node, msg.variables);
              }
            }
            figma.notify(`Linked to ${msg.multilanId}`);
            const textNodes = getAllTextNodesInfo("page", getTranslations);
            const selectedNode = getSelectedTextNodeInfo(getTranslations);
            figma.ui.postMessage({ type: "text-nodes-updated", textNodes, selectedNode });
          }
        } else {
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
          figma.notify(`Linking ${msg.confirmations.length} nodes...`);
          let successCount = 0;
          let failCount = 0;
          for (const match of msg.confirmations) {
            const success = await linkTextNode(match.nodeId, match.multilanId);
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
        const success = await linkTextNode(msg.nodeId, msg.multilanId);
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
        const results = globalSearchTranslations(translationData, msg.searchQuery);
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
        let textToCreate = msg.text;
        const lang = (msg.language as Language) || "en";

        // If variables are provided, replace them in the translation
        if (msg.variables && Object.keys(msg.variables).length > 0) {
          const translation = getAllTranslations(translationData, msg.multilanId);
          if (translation && translation[lang]) {
            textToCreate = replaceVariables(translation[lang], msg.variables);
          }
        }

        const textNode = await createLinkedTextNode(
          translationData,
          msg.multilanId,
          textToCreate,
          lang
        );

        // If we used variable replacement, update the node text and expected text
        // (createLinkedTextNode uses getTranslation which returns the original)
        if (msg.variables && Object.keys(msg.variables).length > 0) {
          textNode.characters = textToCreate;
          setExpectedText(textNode, textToCreate);
          // Store variable values for language switching
          setVariableValues(textNode, msg.variables);
        }

        figma.notify(`Created text node: "${textNode.characters}" (${msg.multilanId})`);
        figma.ui.postMessage({
          type: "text-created",
          multilanId: msg.multilanId,
        });
      }
      break;

    case "close":
      figma.closePlugin();
      break;
  }
};

// Start
initialize();
