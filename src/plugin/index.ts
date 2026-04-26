// Multilan Helper Plugin - Main entry point
// Runs in Figma's sandbox environment
//
// Architecture: Plugin sandbox receives messages from the UI iframe,
// processes them using translation services and Figma's node API,
// and responds with results. Translation data is loaded from .tra files
// uploaded by the user and cached in clientStorage.

import {
  TranslationMap,
  MetadataMap,
  PluginMessage,
  Language,
  SUPPORTED_LANGUAGES,
  FrameNodeMatchResult,
  TextNodeInfo,
  FolderDataStatus,
  TraUploadMetadata,
} from "../shared/types";
import { createAdapter } from "../adapters";
import { TraFileData } from "../adapters/types/traFile.types";
import { deflateSync, inflateSync, strToU8, strFromU8 } from "fflate";

import {
  getAllTranslations,
  getTranslation,
  isLanguage,
  globalSearchTranslationsAsync,
  searchTranslationsWithScoreAsync,
  detectLanguage,
  detectMatchAsync,
  applyVariables,
  invalidateTextToIdMapCache,
  getTextToIdMap,
  createCancellationToken,
} from "./services/translationService";
import type { CancellationToken } from "./services/translationService";
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

// ---- Constants ----

declare const __BUILD_TIMESTAMP__: string;
const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : new Date().toISOString();
const FOLDER_NAMES = ['EB', 'EBB', 'PCB'];

// ---- Compression helpers for clientStorage ----

function compressText(text: string): string {
  if (!text) return "";
  const compressed = deflateSync(strToU8(text), { level: 9 });
  return figma.base64Encode(compressed);
}

function decompressText(b64: string): string {
  if (!b64) return "";
  const bytes = figma.base64Decode(b64);
  return strFromU8(inflateSync(bytes));
}

function compressTraData(data: TraFileData): TraFileData {
  return {
    en: compressText(data.en),
    fr: compressText(data.fr),
    nl: compressText(data.nl),
    de: compressText(data.de),
  };
}

function decompressTraData(data: TraFileData): TraFileData {
  return {
    en: decompressText(data.en),
    fr: decompressText(data.fr),
    nl: decompressText(data.nl),
    de: decompressText(data.de),
  };
}

// ---- Plugin State ----

let currentFolder: string = FOLDER_NAMES[0] || "EB";
let translationData: TranslationMap = {};
let metadataData: MetadataMap = {};
let lastSelectionTextNodes: TextNodeInfo[] = [];
let lastFrameMatchResults: FrameNodeMatchResult[] | undefined = undefined;
let selectionChangeTimer: ReturnType<typeof setTimeout> | null = null;
let selectionFuzzyToken: CancellationToken | null = null;
let globalSearchToken: CancellationToken | null = null;

// Page scan cache — avoids redundant findAll() calls (1-3s each)
let pageNodeCache: TextNode[] | null = null;
let pageNodeCacheTimestamp = 0;
const PAGE_SCAN_TTL_MS = 5000;

// ---- Helper Functions ----

const getTranslations = (multilanId: string) => getAllTranslations(translationData, multilanId);

function hasEditPermission(): boolean {
  return figma.editorType === "figma";
}

function requireEditPermission(): boolean {
  if (!hasEditPermission()) {
    figma.notify("You don't have edit permissions", { error: true });
    return false;
  }
  return true;
}

function getCachedPageNodes(): TextNode[] {
  const now = Date.now();
  if (pageNodeCache && (now - pageNodeCacheTimestamp) < PAGE_SCAN_TTL_MS) {
    return pageNodeCache;
  }
  pageNodeCache = getTextNodesInScope("page");
  pageNodeCacheTimestamp = now;
  return pageNodeCache;
}

// ---- Translation Data Management ----

async function initializeTraFileData(traData: TraFileData): Promise<boolean> {
  try {
    const adapter = await createAdapter(traData, "tra-files");
    translationData = adapter.getTranslationMap();
    metadataData = adapter.getMetadataMap();
    invalidateTextToIdMapCache();
    console.log(`Loaded ${Object.keys(translationData).length} translations`);
    return true;
  } catch (error) {
    console.error(`Failed to parse .tra files:`, error);
    return false;
  }
}

async function buildFolderDataStatus(): Promise<FolderDataStatus> {
  const status: FolderDataStatus = {};
  const results = await Promise.all(
    FOLDER_NAMES.map(async (folder) => {
      const [cached, meta] = await Promise.all([
        figma.clientStorage.getAsync('traData_' + folder).catch(() => null),
        figma.clientStorage.getAsync('traMetadata_' + folder).catch(() => null),
      ]);
      return { folder, hasData: !!cached, metadata: meta as TraUploadMetadata | undefined };
    })
  );
  for (const { folder, hasData, metadata } of results) {
    status[folder] = { hasData, metadata };
  }
  return status;
}

async function loadTraDataForFolder(folder: string): Promise<TraFileData | null> {
  try {
    const cached = await figma.clientStorage.getAsync('traData_' + folder);
    if (!cached) return null;
    const data = cached as TraFileData;
    // Detect if data is compressed (base64 doesn't start with a digit like raw .tra lines)
    const sample = data.en || data.fr || data.nl || data.de;
    if (sample && !sample.match(/^\d/)) {
      return decompressTraData(data);
    }
    return data;
  } catch {
    return null;
  }
}

async function initializeWithFolder(): Promise<void> {
  try {
    const saved = await figma.clientStorage.getAsync('selectedFolder');
    if (saved && FOLDER_NAMES.includes(saved)) {
      currentFolder = saved;
    }
  } catch {
    // Use default folder
  }

  const traData = await loadTraDataForFolder(currentFolder);
  if (traData) {
    await initializeTraFileData(traData);
  } else {
    translationData = {};
    metadataData = {};
  }
}

// ---- Auto-Unlink Modified Nodes ----

function autoUnlinkModifiedNodes(nodes: TextNode[]): number {
  let unlinkedCount = 0;

  for (const node of nodes) {
    const multilanId = getMultilanId(node);
    if (!multilanId) continue;

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
        const matchesAnyTranslation = Object.values(translations).some(
          (text) => text === node.characters
        );
        if (!matchesAnyTranslation) {
          removeMultilanIdFromName(node);
          clearMultilanId(node);
          unlinkedCount++;
        }
      }
    }
  }

  return unlinkedCount;
}

// ---- Frame Match Results ----

function buildSingleFrameMatchResult(node: TextNodeInfo, textToIdMap: Map<string, string>): FrameNodeMatchResult {
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
    const trimmed = node.characters.trim().toLowerCase();
    const exactId = trimmed ? (textToIdMap.get(trimmed) || null) : null;
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
}

function buildFrameMatchResults(nodes: TextNodeInfo[], textToIdMap: Map<string, string>): FrameNodeMatchResult[] {
  return nodes.map(n => buildSingleFrameMatchResult(n, textToIdMap));
}

async function patchNodeInSelection(
  changedNode: TextNode,
  previousSelectionTextNodes: TextNodeInfo[],
  previousFrameMatchResults: FrameNodeMatchResult[] | undefined
): Promise<{ selectionTextNodes: TextNodeInfo[]; frameMatchResults: FrameNodeMatchResult[] | undefined }> {
  const updatedInfo = buildTextNodeInfo(changedNode, getTranslations);

  const selectionTextNodes = previousSelectionTextNodes.map(n =>
    n.id === changedNode.id ? updatedInfo : n
  );

  let frameMatchResults = previousFrameMatchResults;
  if (previousFrameMatchResults && previousFrameMatchResults.length > 1) {
    const textToIdMap = await getTextToIdMap(translationData);
    const updatedMatch = buildSingleFrameMatchResult(updatedInfo, textToIdMap);
    frameMatchResults = previousFrameMatchResults.map(r =>
      r.nodeId === changedNode.id ? updatedMatch : r
    );
  }

  return { selectionTextNodes, frameMatchResults };
}

/** Send incremental node update to UI after link/unlink. */
async function sendNodeUpdate(node: TextNode): Promise<void> {
  const updatedNodeInfo = buildTextNodeInfo(node, getTranslations);
  const selectedNode = getSelectedTextNodeInfo(getTranslations);
  const patched = await patchNodeInSelection(node, lastSelectionTextNodes, lastFrameMatchResults);
  lastSelectionTextNodes = patched.selectionTextNodes;
  lastFrameMatchResults = patched.frameMatchResults;
  figma.ui.postMessage({
    type: "node-updated",
    nodeInfo: updatedNodeInfo,
    selectedNode,
    selectionTextNodes: patched.selectionTextNodes,
    frameMatchResults: patched.frameMatchResults,
  });
}

// ---- Initialize ----

async function initialize(): Promise<void> {
  const allPageNodes = getCachedPageNodes();

  // Auto-unlink nodes that have been modified by designers
  const unlinkedCount = autoUnlinkModifiedNodes(allPageNodes);
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

  const textNodes = allPageNodes.map(n => buildTextNodeInfo(n, getTranslations));
  const selectedNode = getSelectedTextNodeInfo(getTranslations);

  // Detect current language from linked nodes
  const linkedNodes = allPageNodes
    .map((node) => {
      const multilanId = getMultilanId(node);
      return multilanId ? { multilanId, characters: node.characters } : null;
    })
    .filter((n): n is { multilanId: string; characters: string } => n !== null);

  const detectedLanguage = detectLanguage(translationData, linkedNodes);

  figma.ui.postMessage({
    type: "init",
    canEdit: hasEditPermission(),
    languages: SUPPORTED_LANGUAGES,
    textNodes,
    selectedNode,
    translationCount: Object.keys(translationData).length,
    buildTimestamp: BUILD_TIMESTAMP,
    detectedLanguage,
    folderNames: FOLDER_NAMES,
    folderName: currentFolder,
    folderDataStatus: await buildFolderDataStatus(),
  });
}

// ---- Selection Change Handler ----

async function handleSelectionChange(): Promise<void> {
  let selectedNode = getSelectedTextNodeInfo(getTranslations);
  const hasSelection = figma.currentPage.selection.length > 0;

  const selectionTextNodes = hasSelection
    ? getAllTextNodesInfo("selection", getTranslations)
    : [];

  if (!selectedNode && selectionTextNodes.length > 0) {
    selectedNode = selectionTextNodes[0];
  }

  if (selectionFuzzyToken) {
    selectionFuzzyToken.cancel();
    selectionFuzzyToken = null;
  }

  const textToIdMap = await getTextToIdMap(translationData);

  let matchResult = undefined;
  if (selectedNode) {
    if (selectedNode.multilanId) {
      const metadata = metadataData ? metadataData[selectedNode.multilanId] : undefined;
      matchResult = {
        status: 'linked' as const,
        multilanId: selectedNode.multilanId,
        translations: selectedNode.translations || undefined,
        metadata,
      };
    } else {
      const trimmed = selectedNode.characters.trim().toLowerCase();
      const exactId = trimmed ? (textToIdMap.get(trimmed) || null) : null;
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
  }

  const frameMatchResults = selectionTextNodes.length > 1
    ? buildFrameMatchResults(selectionTextNodes, textToIdMap)
    : undefined;

  lastSelectionTextNodes = selectionTextNodes;
  lastFrameMatchResults = frameMatchResults;

  figma.ui.postMessage({
    type: "selection-changed",
    selectedNode,
    selectionTextNodes,
    hasSelection,
    matchResult,
    frameMatchResults,
  });
}

// ---- Message Handlers (one per message type) ----

async function handleSwitchLanguage(msg: PluginMessage): Promise<void> {
  if (!msg.language || !isLanguage(msg.language)) return;
  if (!requireEditPermission()) return;

  const scope = msg.scope || "page";
  const result = switchLanguage(translationData, msg.language, scope);

  if (result.success > 0) {
    figma.notify(`Switched ${result.success} text(s) to ${msg.language.toUpperCase()}`);
  }

  figma.ui.postMessage({ type: "language-switched", ...result });

  const textNodes = getAllTextNodesInfo(scope, getTranslations);
  figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
}

async function handleSearch(msg: PluginMessage): Promise<void> {
  if (!msg.searchQuery) return;
  const results = await searchTranslationsWithScoreAsync(translationData, msg.searchQuery, 20);
  figma.ui.postMessage({ type: "search-results", results });
}

async function handleLinkNode(msg: PluginMessage): Promise<void> {
  if (!requireEditPermission()) return;
  if (!msg.nodeId || !msg.multilanId) return;

  const lang = msg.language || 'en';
  const translation = getTranslation(translationData, msg.multilanId, lang);

  // Check for ###variable### placeholders — prompt UI before linking
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

  const success = await linkTextNode(msg.nodeId, msg.multilanId, translationData, msg.language);
  if (!success) return;

  const node = await getTextNodeById(msg.nodeId);
  if (node) {
    if (translation) {
      await updateNodeText(node, translation);
      setExpectedText(node, translation);
    }
    figma.notify(`Linked to ${msg.multilanId}`);
    await sendNodeUpdate(node);
  }
}

async function handleLinkNodeWithVariables(msg: PluginMessage): Promise<void> {
  if (!requireEditPermission()) return;
  if (!msg.nodeId || !msg.multilanId || !msg.variables) return;

  const success = await linkTextNode(msg.nodeId, msg.multilanId, translationData, msg.language);
  if (!success) return;

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
    await sendNodeUpdate(node);
  }
}

async function handleUnlinkNode(msg: PluginMessage): Promise<void> {
  if (!requireEditPermission()) return;
  if (!msg.nodeId) return;

  const node = await getTextNodeById(msg.nodeId);
  const success = await unlinkTextNode(msg.nodeId);
  if (success) {
    figma.notify("Unlinked");
    if (node) {
      await sendNodeUpdate(node);
    }
  }
}

async function handleRefresh(msg: PluginMessage): Promise<void> {
  const scope = msg.scope || "page";
  const nodes = getTextNodesInScope(scope);
  const unlinkedCount = autoUnlinkModifiedNodes(nodes);
  if (unlinkedCount > 0) {
    figma.notify(`Auto-unlinked ${unlinkedCount} modified node${unlinkedCount > 1 ? 's' : ''}`);
  }
  const textNodes = getAllTextNodesInfo(scope, getTranslations);
  figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
}

async function handleMarkAsPlaceholder(msg: PluginMessage): Promise<void> {
  if (!requireEditPermission()) return;

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

function handleDetectMatch(msg: PluginMessage): void {
  if (!msg.text) return;

  if (selectionFuzzyToken) {
    selectionFuzzyToken.cancel();
  }
  const token = createCancellationToken();
  selectionFuzzyToken = token;

  detectMatchAsync(translationData, msg.text, metadataData, token).then(matchResult => {
    if (!token.cancelled) {
      selectionFuzzyToken = null;
      figma.ui.postMessage({ type: "match-detected", matchResult });
    }
  });
}

function handleGlobalSearch(msg: PluginMessage): void {
  if (!msg.searchQuery) return;

  if (globalSearchToken) {
    globalSearchToken.cancel();
  }
  const token = createCancellationToken();
  globalSearchToken = token;

  globalSearchTranslationsAsync(translationData, msg.searchQuery, 30, metadataData, token).then(results => {
    if (!token.cancelled) {
      globalSearchToken = null;
      figma.ui.postMessage({ type: "global-search-results", results });
    }
  });
}

function handleFindCloseMatches(msg: PluginMessage): void {
  if (!msg.nodeId || !msg.text) return;

  const targetNodeId = msg.nodeId;
  const token = createCancellationToken();

  detectMatchAsync(translationData, msg.text, metadataData, token).then(matchResult => {
    if (!token.cancelled) {
      figma.ui.postMessage({ type: "frame-match-result", nodeId: targetNodeId, matchResult });
    }
  });
}

async function handleHighlightUnlinked(msg: PluginMessage): Promise<void> {
  if (!requireEditPermission()) return;

  const scope = msg.scope || "page";
  const nodes = getTextNodesInScope(scope);
  const unlinkedNodes = nodes.filter(node => !getMultilanId(node));

  if (msg.highlight) {
    if (unlinkedNodes.length > 0) {
      figma.currentPage.selection = unlinkedNodes;
      figma.viewport.scrollAndZoomIntoView(unlinkedNodes);
      figma.notify(`Selected ${unlinkedNodes.length} unlinked text node${unlinkedNodes.length > 1 ? 's' : ''}`);
    } else {
      figma.notify("No unlinked text nodes found");
    }
  } else {
    figma.currentPage.selection = [];
  }
}

async function handleSwitchFolder(msg: PluginMessage): Promise<void> {
  if (!msg.folderName || !FOLDER_NAMES.includes(msg.folderName)) return;

  currentFolder = msg.folderName;
  await figma.clientStorage.setAsync('selectedFolder', currentFolder);

  const traData = await loadTraDataForFolder(currentFolder);
  if (traData) {
    await initializeTraFileData(traData);
    await initialize();
  } else {
    translationData = {};
    metadataData = {};
    figma.ui.postMessage({ type: 'tra-upload-needed', folderName: currentFolder });
  }
}

async function handleUploadTraFiles(msg: PluginMessage): Promise<void> {
  if (!msg.folderName || !msg.traFileData) return;

  try {
    const newData = msg.traFileData as TraFileData;

    // Merge with existing data — only overwrite languages that were uploaded (non-empty)
    const existing = await loadTraDataForFolder(msg.folderName);
    const merged: TraFileData = {
      en: newData.en || (existing?.en ?? ''),
      fr: newData.fr || (existing?.fr ?? ''),
      nl: newData.nl || (existing?.nl ?? ''),
      de: newData.de || (existing?.de ?? ''),
    };

    // Merge available languages from previous + new upload
    let mergedLanguages: string[] = [];
    if (msg.traUploadMetadata) {
      const existingMeta = await figma.clientStorage.getAsync('traMetadata_' + msg.folderName) as TraUploadMetadata | undefined;
      const previousLanguages = existingMeta?.availableLanguages || [];
      const newLanguages = msg.traUploadMetadata.availableLanguages || [];
      mergedLanguages = [...new Set([...previousLanguages, ...newLanguages])];
    }

    // Compress and store merged data
    await figma.clientStorage.setAsync('traData_' + msg.folderName, compressTraData(merged));
    const mergedMetadata = msg.traUploadMetadata
      ? { ...msg.traUploadMetadata, availableLanguages: mergedLanguages }
      : undefined;
    if (mergedMetadata) {
      await figma.clientStorage.setAsync('traMetadata_' + msg.folderName, mergedMetadata);
    }

    currentFolder = msg.folderName;
    await figma.clientStorage.setAsync('selectedFolder', currentFolder);
    await initializeTraFileData(merged);

    const translationCount = Object.keys(translationData).length;
    await initialize();

    figma.ui.postMessage({
      type: 'upload-success',
      folderName: msg.folderName,
      uploadedTranslationCount: translationCount,
      traUploadMetadata: mergedMetadata,
      folderDataStatus: await buildFolderDataStatus(),
    });
  } catch (err) {
    console.error('handleUploadTraFiles failed:', err);
    figma.notify('Upload failed: ' + (err instanceof Error ? err.message : String(err)), { error: true });
    figma.ui.postMessage({ type: 'upload-failed', folderName: msg.folderName });
  }
}

// ---- UI Setup & Event Wiring ----

figma.showUI(__html__, {
  width: 360,
  height: 500,
  themeColors: true,
});

figma.on("selectionchange", () => {
  if (selectionChangeTimer !== null) {
    clearTimeout(selectionChangeTimer);
  }
  selectionChangeTimer = setTimeout(() => {
    selectionChangeTimer = null;
    handleSelectionChange();
  }, 100);
});

// ---- Message Router ----

figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {
    case "init":              await initialize(); break;
    case "switch-language":   await handleSwitchLanguage(msg); break;
    case "search":            await handleSearch(msg); break;
    case "link-node":         await handleLinkNode(msg); break;
    case "link-node-with-variables": await handleLinkNodeWithVariables(msg); break;
    case "unlink-node":       await handleUnlinkNode(msg); break;
    case "select-node":       if (msg.nodeId) await selectNode(msg.nodeId); break;
    case "refresh":           await handleRefresh(msg); break;
    case "lookup-multilanId":
      if (msg.multilanId) {
        const translations = getAllTranslations(translationData, msg.multilanId);
        figma.ui.postMessage({ type: "lookup-result", multilanId: msg.multilanId, translations, found: translations !== null });
      }
      break;
    case "mark-as-placeholder": await handleMarkAsPlaceholder(msg); break;
    case "detect-match":      handleDetectMatch(msg); break;
    case "get-unlinked-queue": {
      const scope = msg.scope || "page";
      const nodes = getTextNodesInScope(scope);
      const unlinkedQueue = nodes
        .filter(node => !getMultilanId(node) && node.characters.trim())
        .map(node => ({ nodeId: node.id, nodeName: node.name, characters: node.characters }));
      figma.ui.postMessage({ type: "unlinked-queue", unlinkedQueue });
      break;
    }
    case "global-search":     handleGlobalSearch(msg); break;
    case "find-close-matches": handleFindCloseMatches(msg); break;
    case "create-linked-text":
      if (!requireEditPermission()) return;
      if (msg.multilanId && msg.text) {
        const lang = (msg.language as Language) || "en";
        const textNode = await createLinkedTextNode(translationData, msg.multilanId, msg.text, lang);
        figma.notify(`Created text node: "${textNode.characters}" (${msg.multilanId})`);
        figma.ui.postMessage({ type: "text-created", multilanId: msg.multilanId });
      }
      break;
    case "highlight-unlinked": await handleHighlightUnlinked(msg); break;
    case "clear-selection":   figma.currentPage.selection = []; break;
    case "switch-folder":     await handleSwitchFolder(msg); break;
    case "upload-tra-files":  await handleUploadTraFiles(msg); break;
    case "close":             figma.closePlugin(); break;
  }
};

// ---- Startup ----

initializeWithFolder().then(() => initialize());
