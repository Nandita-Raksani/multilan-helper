// Multilan Helper Plugin - Main entry point
// Runs in Figma's sandbox environment

import bundledApiData from "../translations/api-data.json";
import { traFileContents } from "../translations/tra-bundle";
import {
  TranslationMap,
  MetadataMap,
  PluginMessage,
  Language,
  SUPPORTED_LANGUAGES,
  FrameNodeMatchResult,
  TextNodeInfo,
} from "../shared/types";
import { createAdapter } from "../adapters";
import { TraFileData } from "../adapters/types/traFile.types";
import {
  getAllTranslations,
  isLanguage,
  globalSearchTranslations,
  searchTranslations,
  detectLanguage,
  detectMatch,
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
  loadNodeFont,
} from "./services/nodeService";
import {
  linkTextNode,
  unlinkTextNode,
  markAsPlaceholder,
  switchLanguage,
  createLinkedTextNode,
} from "./services/linkingService";

// Build timestamp - update this when translations are updated
const BUILD_TIMESTAMP = "2026-01-18 12:00";

// Translation data loaded from bundled .tra files (with JSON fallback)
let translationData: TranslationMap;
let metadataData: MetadataMap;

// Store highlight rectangle IDs for cleanup
const highlightRects: string[] = [];


// Initialize with .tra files (primary bundled source)
// Uses tra-bundle.ts which has been pre-converted to UTF-8
function initializeTraFileData(): boolean {
  try {
    const traData: TraFileData = {
      en: traFileContents.en,
      fr: traFileContents.fr,
      nl: traFileContents.nl,
      de: traFileContents.de,
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

// Build per-node match results for frame/multi-selection mode
function buildFrameMatchResults(nodes: TextNodeInfo[]): FrameNodeMatchResult[] {
  return nodes.map(node => {
    let matchResult;
    if (node.multilanId) {
      const metadata = metadataData ? metadataData[node.multilanId] : undefined;
      matchResult = {
        status: 'linked' as const,
        multilanId: node.multilanId,
        translations: node.translations || undefined,
        metadata,
      };
    } else {
      matchResult = detectMatch(translationData, node.characters, metadataData);
    }
    return {
      nodeId: node.id,
      nodeName: node.name,
      characters: node.characters,
      matchResult,
    };
  });
}

// Initialize: send initial data to UI
async function initialize(): Promise<void> {
  // Auto-unlink nodes that have been modified by designers
  const unlinkedCount = autoUnlinkModifiedNodes("page");
  if (unlinkedCount > 0) {
    figma.notify(`Auto-unlinked ${unlinkedCount} modified node${unlinkedCount > 1 ? 's' : ''}`);
  }

  // Preload fonts for all linked text nodes so language switching is instant
  const allPageNodes = getTextNodesInScope("page");
  for (const node of allPageNodes) {
    if (getMultilanId(node)) {
      try {
        await loadNodeFont(node);
      } catch {
        // Font load failed, will retry during switch if needed
      }
    }
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

// Handle selection change — auto-detect matches for unlinked nodes
figma.on("selectionchange", () => {
  let selectedNode = getSelectedTextNodeInfo(getTranslations);
  const hasSelection = figma.currentPage.selection.length > 0;

  // Only gather selection text nodes when something is actually selected
  const selectionTextNodes = hasSelection
    ? getAllTextNodesInfo("selection", getTranslations)
    : [];

  // If no single text node selected, use the first text node found in selection
  if (!selectedNode && selectionTextNodes.length > 0) {
    selectedNode = selectionTextNodes[0];
  }

  // Auto-detect match for selected text node
  let matchResult = undefined;
  if (selectedNode) {
    if (selectedNode.multilanId) {
      // Already linked
      const metadata = metadataData ? metadataData[selectedNode.multilanId] : undefined;
      matchResult = {
        status: 'linked' as const,
        multilanId: selectedNode.multilanId,
        translations: selectedNode.translations || undefined,
        metadata,
      };
    } else {
      // Unlinked — run match detection
      matchResult = detectMatch(translationData, selectedNode.characters, metadataData);
    }
  }

  // Build frame match results for multi-selection
  const frameMatchResults = selectionTextNodes.length > 1
    ? buildFrameMatchResults(selectionTextNodes)
    : undefined;

  figma.ui.postMessage({
    type: "selection-changed",
    selectedNode,
    selectionTextNodes,
    hasSelection,
    matchResult,
    frameMatchResults,
  });
});

// Handle messages from UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {
    case "init":
      await initialize();
      break;

    case "switch-language":
      if (msg.language && isLanguage(msg.language)) {
        const scope = msg.scope || "page";

        if (!canEdit()) {
          figma.notify("You don't have edit permissions", { error: true });
          return;
        }

        const result = switchLanguage(
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
          const selectionTextNodes = getAllTextNodesInfo("selection", getTranslations);
          const frameMatchResults = selectionTextNodes.length > 1
            ? buildFrameMatchResults(selectionTextNodes)
            : undefined;
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes, selectedNode, selectionTextNodes, frameMatchResults });
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
          const selectionTextNodes = getAllTextNodesInfo("selection", getTranslations);
          const frameMatchResults = selectionTextNodes.length > 1
            ? buildFrameMatchResults(selectionTextNodes)
            : undefined;
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes, selectedNode, selectionTextNodes, frameMatchResults });
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

    case "detect-match":
      if (msg.text) {
        const matchResult = detectMatch(translationData, msg.text, metadataData);
        figma.ui.postMessage({
          type: "match-detected",
          matchResult,
        });
      }
      break;

    case "get-unlinked-queue": {
      const scope = msg.scope || "page";
      const nodes = getTextNodesInScope(scope);
      const unlinkedQueue = nodes
        .filter(node => !getMultilanId(node) && node.characters.trim())
        .map(node => ({
          nodeId: node.id,
          nodeName: node.name,
          characters: node.characters,
        }));
      figma.ui.postMessage({
        type: "unlinked-queue",
        unlinkedQueue,
      });
      break;
    }

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
          // Highlight: create a rectangle around each unlinked text node
          const highlightStroke: SolidPaint = {
            type: "SOLID",
            color: { r: 0.96, g: 0.62, b: 0.04 }, // Amber (#f59e0b) matching UI button
            opacity: 1
          };

          let count = 0;
          for (const node of unlinkedNodes) {
            const rect = figma.createRectangle();
            rect.name = `__highlight_${node.id}`;
            rect.x = node.absoluteTransform[0][2] - 2;
            rect.y = node.absoluteTransform[1][2] - 2;
            rect.resize(node.width + 4, node.height + 4);
            rect.fills = [];
            rect.strokes = [highlightStroke];
            rect.strokeWeight = 2;
            rect.cornerRadius = 2;
            rect.locked = true;

            highlightRects.push(rect.id);
            count++;
          }

          if (count > 0) {
            figma.notify(`Highlighted ${count} unlinked text node${count > 1 ? 's' : ''}`);
          } else {
            figma.notify("No unlinked text nodes found");
          }
        } else {
          // Unhighlight: find and remove all highlight rectangles by name prefix
          const rects = figma.currentPage.findAll(n =>
            n.type === "RECTANGLE" && n.name.startsWith("__highlight_")
          );
          for (const rect of rects) {
            rect.remove();
          }
          highlightRects.length = 0;

          figma.notify(`Removed ${rects.length} highlight${rects.length !== 1 ? 's' : ''}`);
        }
      }
      break;

    case "clear-selection":
      figma.currentPage.selection = [];
      break;

    case "close":
      figma.closePlugin();
      break;
  }
};

// Start
initialize();
