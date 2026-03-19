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
  getTranslation,
  isLanguage,
  globalSearchTranslations,
  globalSearchTranslationsAsync,
  searchTranslations,
  detectLanguage,
  detectMatch,
  detectMatchAsync,
  applyVariables,
  invalidateTextToIdMapCache,
  exactMatchLookup,
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
  getTextNodeById,
  updateNodeText,
  setExpectedText,
  buildTextNodeInfo,
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

// Folder names derived from the bundle keys
const FOLDER_NAMES = Object.keys(traFileContents);

// Current active folder and translation data
let currentFolder: string = FOLDER_NAMES[0] || "EB";
let translationData: TranslationMap;
let metadataData: MetadataMap;

// Initialize with .tra files for a specific folder
function initializeTraFileData(folder: string): boolean {
  try {
    const folderFactory = traFileContents[folder];
    if (!folderFactory) {
      console.error(`Folder "${folder}" not found in bundle`);
      return false;
    }
    // Lazy evaluation — folder data is only materialized here
    const folderData = folderFactory();
    const traData: TraFileData = {
      en: folderData.en || '',
      fr: folderData.fr || '',
      nl: folderData.nl || '',
      de: folderData.de || '',
    };
    const adapter = createAdapter(traData, "tra-files");
    translationData = adapter.getTranslationMap();
    metadataData = adapter.getMetadataMap();
    invalidateTextToIdMapCache();
    console.log(`Loaded ${Object.keys(translationData).length} translations from folder "${folder}"`);
    return true;
  } catch (error) {
    console.error(`Failed to parse .tra files for folder "${folder}":`, error);
    return false;
  }
}

// Initialize with bundled JSON data (fallback)
function initializeBundledData(): void {
  const adapter = createAdapter(bundledApiData);
  translationData = adapter.getTranslationMap();
  metadataData = adapter.getMetadataMap();
  invalidateTextToIdMapCache();
  console.log(`Loaded ${Object.keys(translationData).length} translations from bundled JSON`);
}

// Initialize with fallback chain: .tra files -> JSON
async function initializeWithFallback(): Promise<void> {
  // Load saved folder preference
  try {
    const saved = await figma.clientStorage.getAsync('selectedFolder');
    if (saved && FOLDER_NAMES.includes(saved)) {
      currentFolder = saved;
    }
  } catch {
    // Use default folder
  }

  if (!initializeTraFileData(currentFolder)) {
    initializeBundledData();
  }
}

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

// Build per-node match results for frame/multi-selection mode.
// Uses exact-match only (cached O(1) lookup) — no fuzzy/Levenshtein.
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
      // Exact match only for multi-selection — O(1) per node
      const exactId = exactMatchLookup(translationData, node.characters);
      if (exactId) {
        const translations = translationData[exactId];
        const metadata = metadataData ? metadataData[exactId] : undefined;
        matchResult = {
          status: 'exact' as const,
          multilanId: exactId,
          translations,
          metadata,
        };
      } else {
        matchResult = { status: 'none' as const };
      }
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
// Scans the page once and reuses the result for all operations.
async function initialize(): Promise<void> {
  // Single page scan — reused by all steps below
  const allPageNodes = getTextNodesInScope("page");

  // Auto-unlink nodes that have been modified by designers
  let unlinkedCount = 0;
  for (const node of allPageNodes) {
    const multilanId = getMultilanId(node);
    if (!multilanId) continue;

    if (isTextModified(node)) {
      removeMultilanIdFromName(node);
      clearMultilanId(node);
      clearExpectedText(node);
      unlinkedCount++;
      continue;
    }

    const expectedText = getExpectedText(node);
    if (!expectedText) {
      const translations = getTranslations(multilanId);
      if (translations) {
        const currentText = node.characters;
        const matchesAnyTranslation = Object.values(translations).some(
          (text) => text === currentText
        );
        if (!matchesAnyTranslation) {
          removeMultilanIdFromName(node);
          clearMultilanId(node);
          unlinkedCount++;
        }
      }
    }
  }
  if (unlinkedCount > 0) {
    figma.notify(`Auto-unlinked ${unlinkedCount} modified node${unlinkedCount > 1 ? 's' : ''}`);
  }

  // Preload fonts for linked text nodes — parallelized
  const fontPromises: Promise<void>[] = [];
  for (const node of allPageNodes) {
    if (getMultilanId(node)) {
      fontPromises.push(loadNodeFont(node).catch(() => {}));
    }
  }
  await Promise.all(fontPromises);

  // Build text node info from the already-scanned nodes
  const textNodes = allPageNodes.map(n => buildTextNodeInfo(n, getTranslations));
  const selectedNode = getSelectedTextNodeInfo(getTranslations);

  // Detect current language from linked nodes (reusing allPageNodes)
  const linkedNodes = allPageNodes
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
    folderNames: FOLDER_NAMES,
    folderName: currentFolder,
  });
}

// Handle selection change — debounced, with deferred fuzzy matching
let selectionChangeTimer: ReturnType<typeof setTimeout> | null = null;

figma.on("selectionchange", () => {
  if (selectionChangeTimer !== null) {
    clearTimeout(selectionChangeTimer);
  }
  selectionChangeTimer = setTimeout(() => {
    selectionChangeTimer = null;
    handleSelectionChange();
  }, 100);
});

function handleSelectionChange(): void {
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

  // Auto-detect match for selected text node — exact only, fuzzy deferred
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
      // Unlinked — fast exact match only
      const exactId = exactMatchLookup(translationData, selectedNode.characters);
      if (exactId) {
        const translations = translationData[exactId];
        const metadata = metadataData ? metadataData[exactId] : undefined;
        matchResult = {
          status: 'exact' as const,
          multilanId: exactId,
          translations,
          metadata,
        };
      } else {
        // Show 'searching' while deferred fuzzy runs
        matchResult = { status: 'searching' as const };
        const nodeChars = selectedNode.characters;
        const nodeId = selectedNode.id;
        // Chunked async — yields between batches so Figma stays responsive
        detectMatchAsync(translationData, nodeChars, metadataData).then(fuzzyResult => {
          figma.ui.postMessage({
            type: "match-detected",
            matchResult: fuzzyResult,
            nodeId,
          });
        });
      }
    }
  }

  // Build frame match results for multi-selection (exact-match only, no Levenshtein)
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
}

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
        // Check if translation has ###variable### placeholders
        const lang = msg.language || 'en';
        const translation = getTranslation(translationData, msg.multilanId, lang);
        if (translation && translation.includes('###')) {
          const varPattern = /###([^#]+)###/g;
          const variableNames: string[] = [];
          let varMatch;
          while ((varMatch = varPattern.exec(translation)) !== null) {
            if (!variableNames.includes(varMatch[1])) {
              variableNames.push(varMatch[1]);
            }
          }
          if (variableNames.length > 0) {
            // Prompt UI for variable values before linking
            figma.ui.postMessage({
              type: 'prompt-variables',
              nodeId: msg.nodeId,
              multilanId: msg.multilanId,
              language: msg.language,
              variableNames,
              translationTemplate: translation,
            });
            return;
          }
        }

        const success = await linkTextNode(
          msg.nodeId,
          msg.multilanId,
          translationData,
          msg.language
        );
        if (success) {
          // Update node text with translation
          const node = await getTextNodeById(msg.nodeId);
          if (node) {
            if (translation) {
              await updateNodeText(node, translation);
              setExpectedText(node, translation);
            }
            figma.notify(`Linked to ${msg.multilanId}`);
            // Incremental update — only send the changed node + selection context
            const updatedNodeInfo = buildTextNodeInfo(node, getTranslations);
            const selectedNode = getSelectedTextNodeInfo(getTranslations);
            const selectionTextNodes = getAllTextNodesInfo("selection", getTranslations);
            const frameMatchResults = selectionTextNodes.length > 1
              ? buildFrameMatchResults(selectionTextNodes)
              : undefined;
            figma.ui.postMessage({
              type: "node-updated",
              nodeInfo: updatedNodeInfo,
              selectedNode,
              selectionTextNodes,
              frameMatchResults,
            });
          }
        }
      }
      break;

    case "link-node-with-variables":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.nodeId && msg.multilanId && msg.variables) {
        const success = await linkTextNode(
          msg.nodeId,
          msg.multilanId,
          translationData,
          msg.language
        );
        if (success) {
          const lang = msg.language || 'en';
          let translation = getTranslation(translationData, msg.multilanId, lang);
          const node = await getTextNodeById(msg.nodeId);
          if (node) {
            if (translation) {
              translation = applyVariables(translation, msg.variables);
              await updateNodeText(node, translation);
              setExpectedText(node, translation);
            }
            figma.notify(`Linked to ${msg.multilanId}`);
            const updatedNodeInfo = buildTextNodeInfo(node, getTranslations);
            const selectedNode = getSelectedTextNodeInfo(getTranslations);
            const selectionTextNodes = getAllTextNodesInfo("selection", getTranslations);
            const frameMatchResults = selectionTextNodes.length > 1
              ? buildFrameMatchResults(selectionTextNodes)
              : undefined;
            figma.ui.postMessage({
              type: "node-updated",
              nodeInfo: updatedNodeInfo,
              selectedNode,
              selectionTextNodes,
              frameMatchResults,
            });
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
        const node = await getTextNodeById(msg.nodeId);
        const success = await unlinkTextNode(msg.nodeId);
        if (success) {
          figma.notify("Unlinked");
          if (node) {
            const updatedNodeInfo = buildTextNodeInfo(node, getTranslations);
            const selectedNode = getSelectedTextNodeInfo(getTranslations);
            const selectionTextNodes = getAllTextNodesInfo("selection", getTranslations);
            const frameMatchResults = selectionTextNodes.length > 1
              ? buildFrameMatchResults(selectionTextNodes)
              : undefined;
            figma.ui.postMessage({
              type: "node-updated",
              nodeInfo: updatedNodeInfo,
              selectedNode,
              selectionTextNodes,
              frameMatchResults,
            });
          }
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
          const updatedNodeInfo = buildTextNodeInfo(textNode, getTranslations);
          const selectedNode = getSelectedTextNodeInfo(getTranslations);
          figma.ui.postMessage({ type: "node-updated", nodeInfo: updatedNodeInfo, selectedNode });
        }
      }
      break;

    case "detect-match":
      if (msg.text) {
        detectMatchAsync(translationData, msg.text, metadataData).then(matchResult => {
          figma.ui.postMessage({
            type: "match-detected",
            matchResult,
          });
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
        globalSearchTranslationsAsync(translationData, msg.searchQuery, 30, metadataData).then(results => {
          figma.ui.postMessage({
            type: "global-search-results",
            results,
          });
        });
      }
      break;

    case "find-close-matches":
      // On-demand fuzzy match for a single node in frame mode
      if (msg.nodeId && msg.text) {
        const findNodeId = msg.nodeId;
        detectMatchAsync(translationData, msg.text, metadataData).then(matchResult => {
          figma.ui.postMessage({
            type: "frame-match-result",
            nodeId: findNodeId,
            matchResult,
          });
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
          // Select all unlinked text nodes using Figma's native selection
          if (unlinkedNodes.length > 0) {
            figma.currentPage.selection = unlinkedNodes;
            figma.viewport.scrollAndZoomIntoView(unlinkedNodes);
            figma.notify(`Selected ${unlinkedNodes.length} unlinked text node${unlinkedNodes.length > 1 ? 's' : ''}`);
          } else {
            figma.notify("No unlinked text nodes found");
          }
        } else {
          // Clear selection when exiting highlight mode
          figma.currentPage.selection = [];
        }
      }
      break;

    case "clear-selection":
      figma.currentPage.selection = [];
      break;

    case "switch-folder":
      if (msg.folderName && FOLDER_NAMES.includes(msg.folderName)) {
        currentFolder = msg.folderName;
        await figma.clientStorage.setAsync('selectedFolder', currentFolder);
        initializeTraFileData(currentFolder);
        await initialize();
      }
      break;

    case "close":
      figma.closePlugin();
      break;
  }
};

// Start — wait for saved folder to load before initializing
initializeWithFallback().then(() => initialize());
