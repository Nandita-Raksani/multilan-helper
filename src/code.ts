// Multilan Helper Plugin - Main code
// Runs in Figma's sandbox environment

declare const __html__: string;

// Build timestamp - update this when translations are updated
const BUILD_TIMESTAMP = "2026-01-18 12:00";

import apiData from "./translations/api-data.json";

// Types - API format
interface MultilanText {
  languageId: string;
  wording: string;
  id: number;
}

interface ApiMultilan {
  id: number;
  multilanTextList: MultilanText[];
}

// Internal format
interface TranslationMap {
  [multilanId: string]: {
    [lang: string]: string;
  };
}

interface TextNodeInfo {
  id: string;
  name: string;
  characters: string;
  multilanId: string | null;
  translations: { [lang: string]: string } | null;
  hasOverflow: boolean;
  isPlaceholder: boolean;
}

interface PluginMessage {
  type: string;
  language?: string;
  scope?: "page" | "selection";
  nodeId?: string;
  multilanId?: string;
  searchQuery?: string;
  placeholders?: { [key: string]: string };
  text?: string;
  confirmations?: Array<{ nodeId: string; multilanId: string }>;
}

// Type guard for language
function isLanguage(lang: string | undefined): lang is Language {
  return lang !== undefined && SUPPORTED_LANGUAGES.includes(lang as Language);
}

// Constants
const PLUGIN_DATA_KEY = "multilanId";
const PLACEHOLDER_KEY = "isPlaceholder";
const ORIGINAL_FILL_KEY = "originalFill";
const PLACEHOLDER_COLOR: RGB = { r: 0.96, g: 0.62, b: 0.04 }; // #f59e0b (orange/amber)
const SUPPORTED_LANGUAGES = ["en", "fr", "nl", "de"] as const;
type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Build translation map from API format
function buildTranslationMap(data: ApiMultilan[]): TranslationMap {
  const map: TranslationMap = {};

  for (const item of data) {
    const multilanId = String(item.id);
    map[multilanId] = {};

    for (const text of item.multilanTextList) {
      map[multilanId][text.languageId] = text.wording;
    }
  }

  return map;
}

const translationData: TranslationMap = buildTranslationMap(apiData as ApiMultilan[]);

// Show UI
figma.showUI(__html__, {
  width: 320,
  height: 480,
  themeColors: true
});

// Check if user can edit
function canEdit(): boolean {
  return figma.editorType === "figma";
}

// Get all text nodes in scope
function getTextNodesInScope(scope: "page" | "selection"): TextNode[] {
  const nodes: TextNode[] = [];

  if (scope === "selection" && figma.currentPage.selection.length > 0) {
    for (const node of figma.currentPage.selection) {
      if (node.type === "TEXT") {
        nodes.push(node);
      } else if ("findAll" in node) {
        const textNodes = node.findAll((n) => n.type === "TEXT") as TextNode[];
        nodes.push(...textNodes);
      }
    }
  } else {
    const textNodes = figma.currentPage.findAll((n) => n.type === "TEXT") as TextNode[];
    nodes.push(...textNodes);
  }

  return nodes;
}

// Get multilanId from a text node
function getMultilanId(node: TextNode): string | null {
  return node.getPluginData(PLUGIN_DATA_KEY) || null;
}

// Set multilanId on a text node
function setMultilanId(node: TextNode, multilanId: string): void {
  node.setPluginData(PLUGIN_DATA_KEY, multilanId);
}

// Get translation for a multilanId and language
function getTranslation(multilanId: string, lang: Language): string | null {
  const entry = translationData[multilanId];
  if (!entry) return null;
  return entry[lang] || null;
}

// Get all translations for a multilanId
function getAllTranslations(multilanId: string): { [lang: string]: string } | null {
  return translationData[multilanId] || null;
}

// Check if a node is marked as placeholder
function isPlaceholder(node: TextNode): boolean {
  return node.getPluginData(PLACEHOLDER_KEY) === "true";
}

// Mark a node as placeholder with visual indicator
async function markAsPlaceholder(node: TextNode, multilanId: string, text: string): Promise<void> {
  // Store the multilanId and placeholder flag
  node.setPluginData(PLUGIN_DATA_KEY, multilanId);
  node.setPluginData(PLACEHOLDER_KEY, "true");

  // Store original fill color for later restoration
  const fills = node.fills;
  if (Array.isArray(fills) && fills.length > 0) {
    node.setPluginData(ORIGINAL_FILL_KEY, JSON.stringify(fills));
  }

  // Apply placeholder color (orange)
  node.fills = [{ type: "SOLID", color: PLACEHOLDER_COLOR }];

  // Set the text content
  await figma.loadFontAsync(node.fontName as FontName);
  node.characters = text;
}

// Clear placeholder status and restore original styling
function clearPlaceholderStatus(node: TextNode): void {
  node.setPluginData(PLACEHOLDER_KEY, "");

  // Restore original fill if stored
  const originalFill = node.getPluginData(ORIGINAL_FILL_KEY);
  if (originalFill) {
    try {
      node.fills = JSON.parse(originalFill);
    } catch {
      // If parsing fails, leave current fill
    }
    node.setPluginData(ORIGINAL_FILL_KEY, "");
  }
}

// Replace placeholders with sample values
function replacePlaceholders(text: string, placeholders: { [key: string]: string }): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return placeholders[key] || match;
  });
}

// Build text node info for UI
function buildTextNodeInfo(node: TextNode): TextNodeInfo {
  const multilanId = getMultilanId(node);
  const translations = multilanId ? getAllTranslations(multilanId) : null;

  return {
    id: node.id,
    name: node.name,
    characters: node.characters,
    multilanId,
    translations,
    hasOverflow: false, // TODO: Implement overflow detection
    isPlaceholder: isPlaceholder(node)
  };
}

// Get all text nodes info for UI
function getAllTextNodesInfo(scope: "page" | "selection"): TextNodeInfo[] {
  const nodes = getTextNodesInScope(scope);
  return nodes.map(buildTextNodeInfo);
}

// Switch language for all linked text nodes
async function switchLanguage(
  lang: Language,
  scope: "page" | "selection",
  placeholders: { [key: string]: string }
): Promise<{ success: number; missing: string[]; overflow: string[] }> {
  const nodes = getTextNodesInScope(scope);
  let success = 0;
  const missing: string[] = [];
  const overflow: string[] = [];

  for (const node of nodes) {
    const multilanId = getMultilanId(node);
    if (!multilanId) continue;

    let translation = getTranslation(multilanId, lang);

    if (!translation) {
      // Fallback to English
      translation = getTranslation(multilanId, "en");
      if (translation) {
        missing.push(node.id);
      } else {
        continue;
      }
    }

    // Replace placeholders
    translation = replacePlaceholders(translation, placeholders);

    // Load font before changing text
    // Handle mixed fonts by loading all unique fonts used in the node
    try {
      if (node.fontName === figma.mixed) {
        // Collect unique fonts to avoid loading duplicates
        const fontsToLoad = new Set<string>();
        const len = node.characters.length;
        for (let i = 0; i < len; i++) {
          const fontName = node.getRangeFontName(i, i + 1) as FontName;
          fontsToLoad.add(JSON.stringify(fontName));
        }
        // Load each unique font
        for (const fontStr of fontsToLoad) {
          await figma.loadFontAsync(JSON.parse(fontStr) as FontName);
        }
      } else {
        await figma.loadFontAsync(node.fontName as FontName);
      }
    } catch (fontErr) {
      console.error(`Failed to load font for node ${node.id}:`, fontErr);
      continue; // Skip this node if font loading fails
    }

    const originalWidth = node.width;
    node.characters = translation;

    // Check for overflow (text got wider)
    if (node.width > originalWidth * 1.2) {
      overflow.push(node.id);
    }

    success++;
  }

  return { success, missing, overflow };
}

// Search translations by text (fuzzy)
function searchTranslations(query: string): Array<{ multilanId: string; translations: { [lang: string]: string } }> {
  const results: Array<{ multilanId: string; translations: { [lang: string]: string }; score: number }> = [];
  const lowerQuery = query.toLowerCase();

  for (const [multilanId, langs] of Object.entries(translationData)) {
    let bestScore = 0;

    // Check multilanId match
    if (multilanId.toLowerCase().includes(lowerQuery)) {
      bestScore = Math.max(bestScore, 0.8);
    }

    // Check translation text match in any language
    for (const text of Object.values(langs)) {
      const lowerText = text.toLowerCase();
      if (lowerText === lowerQuery) {
        bestScore = 1;
      } else if (lowerText.includes(lowerQuery)) {
        bestScore = Math.max(bestScore, 0.6);
      } else if (lowerQuery.split(" ").some((word) => lowerText.includes(word))) {
        bestScore = Math.max(bestScore, 0.3);
      }
    }

    if (bestScore > 0) {
      results.push({ multilanId, translations: langs, score: bestScore });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Return top 20 results
  return results.slice(0, 20).map(({ multilanId, translations }) => ({ multilanId, translations }));
}

// Link a text node to a multilanId
async function linkTextNode(nodeId: string, multilanId: string): Promise<boolean> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") return false;

  // Clear placeholder status if it was a placeholder (restores original styling)
  if (isPlaceholder(node)) {
    clearPlaceholderStatus(node);
  }

  setMultilanId(node, multilanId);
  return true;
}

// Unlink a text node
async function unlinkTextNode(nodeId: string): Promise<boolean> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") return false;

  // Also clear placeholder status if present
  if (isPlaceholder(node)) {
    clearPlaceholderStatus(node);
  }

  node.setPluginData(PLUGIN_DATA_KEY, "");
  return true;
}

// Bulk auto-link: find matches for unlinked text nodes
interface BulkMatchResult {
  exactMatches: Array<{ nodeId: string; nodeName: string; text: string; multilanId: string }>;
  fuzzyMatches: Array<{
    nodeId: string;
    nodeName: string;
    text: string;
    suggestions: Array<{ multilanId: string; translations: { [lang: string]: string }; score: number }>;
  }>;
  unmatched: Array<{ nodeId: string; nodeName: string; text: string }>;
}

function bulkAutoLink(scope: "page" | "selection"): BulkMatchResult {
  const nodes = getTextNodesInScope(scope);
  const result: BulkMatchResult = {
    exactMatches: [],
    fuzzyMatches: [],
    unmatched: []
  };

  // Build a reverse lookup: text -> multilanId for exact matching
  const textToMultilanId: Map<string, string> = new Map();
  for (const [multilanId, langs] of Object.entries(translationData)) {
    for (const text of Object.values(langs)) {
      if (!textToMultilanId.has(text)) {
        textToMultilanId.set(text, multilanId);
      }
    }
  }

  for (const node of nodes) {
    // Skip already linked nodes (unless they're placeholders)
    const currentId = getMultilanId(node);
    if (currentId && !isPlaceholder(node)) continue;

    const text = node.characters.trim();
    if (!text) continue;

    // Pass 1: Exact match
    const exactMatch = textToMultilanId.get(text);
    if (exactMatch) {
      result.exactMatches.push({
        nodeId: node.id,
        nodeName: node.name,
        text,
        multilanId: exactMatch
      });
      continue;
    }

    // Pass 2: Fuzzy match
    const fuzzyResults = searchTranslationsWithScore(text);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score >= 0.3) {
      result.fuzzyMatches.push({
        nodeId: node.id,
        nodeName: node.name,
        text,
        suggestions: fuzzyResults.slice(0, 3)
      });
    } else {
      result.unmatched.push({
        nodeId: node.id,
        nodeName: node.name,
        text
      });
    }
  }

  return result;
}

// Search translations with score (for fuzzy matching)
function searchTranslationsWithScore(
  query: string
): Array<{ multilanId: string; translations: { [lang: string]: string }; score: number }> {
  const results: Array<{ multilanId: string; translations: { [lang: string]: string }; score: number }> = [];
  const lowerQuery = query.toLowerCase();

  for (const [multilanId, langs] of Object.entries(translationData)) {
    let bestScore = 0;

    // Check multilanId match
    if (multilanId.toLowerCase().includes(lowerQuery)) {
      bestScore = Math.max(bestScore, 0.8);
    }

    // Check translation text match in any language
    for (const text of Object.values(langs)) {
      const lowerText = text.toLowerCase();
      if (lowerText === lowerQuery) {
        bestScore = 1;
      } else if (lowerText.includes(lowerQuery)) {
        bestScore = Math.max(bestScore, 0.6);
      } else if (lowerQuery.includes(lowerText)) {
        bestScore = Math.max(bestScore, 0.5);
      } else if (lowerQuery.split(" ").some((word) => word.length > 2 && lowerText.includes(word))) {
        bestScore = Math.max(bestScore, 0.3);
      }
    }

    if (bestScore > 0) {
      results.push({ multilanId, translations: langs, score: bestScore });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, 10);
}

// Apply exact matches from bulk auto-link
async function applyExactMatches(matches: Array<{ nodeId: string; multilanId: string }>): Promise<number> {
  let count = 0;
  for (const match of matches) {
    if (await linkTextNode(match.nodeId, match.multilanId)) {
      count++;
    }
  }
  return count;
}

// Global search: search by multilanId OR text content
function globalSearchTranslations(query: string): Array<{ multilanId: string; translations: { [lang: string]: string } }> {
  const results: Array<{ multilanId: string; translations: { [lang: string]: string }; score: number }> = [];
  const lowerQuery = query.toLowerCase();

  for (const [multilanId, langs] of Object.entries(translationData)) {
    let bestScore = 0;

    // Check if query matches multilanId (exact or partial)
    if (multilanId === query) {
      bestScore = 1; // Exact ID match
    } else if (multilanId.includes(query)) {
      bestScore = Math.max(bestScore, 0.9); // Partial ID match
    }

    // Check translation text match in any language
    for (const text of Object.values(langs)) {
      const lowerText = text.toLowerCase();
      if (lowerText === lowerQuery) {
        bestScore = Math.max(bestScore, 1); // Exact text match
      } else if (lowerText.includes(lowerQuery)) {
        bestScore = Math.max(bestScore, 0.7); // Text contains query
      } else if (lowerQuery.includes(lowerText)) {
        bestScore = Math.max(bestScore, 0.5); // Query contains text
      } else if (lowerQuery.split(" ").some((word) => word.length > 2 && lowerText.includes(word))) {
        bestScore = Math.max(bestScore, 0.3); // Word match
      }
    }

    if (bestScore > 0) {
      results.push({ multilanId, translations: langs, score: bestScore });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Return top 30 results
  return results.slice(0, 30).map(({ multilanId, translations }) => ({ multilanId, translations }));
}

// Create a new text node linked to a multilanId
async function createLinkedTextNode(multilanId: string, text: string, lang: Language): Promise<void> {
  // Get the translation for the specified language
  const translation = getTranslation(multilanId, lang) || text;

  // Create text node
  const textNode = figma.createText();

  // Load default font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Set text
  textNode.characters = translation;

  // Link to multilanId
  setMultilanId(textNode, multilanId);

  // Position near viewport center or current selection
  const selection = figma.currentPage.selection;
  if (selection.length > 0) {
    const bounds = selection[0];
    textNode.x = bounds.x + bounds.width + 20;
    textNode.y = bounds.y;
  } else {
    textNode.x = figma.viewport.center.x;
    textNode.y = figma.viewport.center.y;
  }

  // Select the new node
  figma.currentPage.selection = [textNode];
  figma.viewport.scrollAndZoomIntoView([textNode]);

  figma.notify(`Created text node: "${translation}" (${multilanId})`);
}

// Select a node in the canvas
async function selectNode(nodeId: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (node && "type" in node) {
    figma.currentPage.selection = [node as SceneNode];
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
  }
}

// Get info for selected text node
function getSelectedTextNodeInfo(): TextNodeInfo | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;

  const node = selection[0];
  if (node.type !== "TEXT") return null;

  return buildTextNodeInfo(node);
}

// Initialize: send initial data to UI
function initialize(): void {
  const textNodes = getAllTextNodesInfo("page");
  const selectedNode = getSelectedTextNodeInfo();

  figma.ui.postMessage({
    type: "init",
    canEdit: canEdit(),
    languages: SUPPORTED_LANGUAGES,
    textNodes,
    selectedNode,
    translationCount: Object.keys(translationData).length,
    buildTimestamp: BUILD_TIMESTAMP
  });
}

// Handle selection change
figma.on("selectionchange", () => {
  const selectedNode = getSelectedTextNodeInfo();
  const selectionTextNodes = getAllTextNodesInfo("selection");
  figma.ui.postMessage({
    type: "selection-changed",
    selectedNode,
    selectionTextNodes
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
      if (msg.language && SUPPORTED_LANGUAGES.includes(msg.language as Language)) {
        const result = await switchLanguage(
          msg.language as Language,
          msg.scope || "page",
          msg.placeholders || {}
        );
        figma.ui.postMessage({
          type: "language-switched",
          ...result
        });

        // Refresh text nodes list
        const textNodes = getAllTextNodesInfo(msg.scope || "page");
        figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
      }
      break;

    case "search":
      if (msg.searchQuery) {
        const results = searchTranslations(msg.searchQuery);
        figma.ui.postMessage({
          type: "search-results",
          results
        });
      }
      break;

    case "link-node":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.nodeId && msg.multilanId) {
        const success = await linkTextNode(msg.nodeId, msg.multilanId);
        if (success) {
          figma.notify(`Linked to ${msg.multilanId}`);
          // Refresh
          const textNodes = getAllTextNodesInfo("page");
          const selectedNode = getSelectedTextNodeInfo();
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
          const textNodes = getAllTextNodesInfo("page");
          const selectedNode = getSelectedTextNodeInfo();
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes, selectedNode });
        }
      }
      break;

    case "select-node":
      if (msg.nodeId) {
        await selectNode(msg.nodeId);
      }
      break;

    case "refresh":
      const textNodes = getAllTextNodesInfo(msg.scope || "page");
      figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
      break;

    case "lookup-multilanId":
      if (msg.multilanId) {
        const translations = getAllTranslations(msg.multilanId);
        figma.ui.postMessage({
          type: "lookup-result",
          multilanId: msg.multilanId,
          translations,
          found: translations !== null
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
        if (msg.multilanId && msg.text) {
          await markAsPlaceholder(textNode, msg.multilanId, msg.text);
          figma.notify(`Marked as placeholder: ${msg.multilanId}`);
          const textNodes = getAllTextNodesInfo("page");
          const selectedNode = getSelectedTextNodeInfo();
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
        const result = bulkAutoLink(msg.scope || "page");
        const totalFound = result.exactMatches.length + result.fuzzyMatches.length;
        if (totalFound > 0) {
          figma.notify(`Found ${result.exactMatches.length} exact + ${result.fuzzyMatches.length} fuzzy matches`);
        } else {
          figma.notify("No matches found for unlinked text nodes");
        }
        figma.ui.postMessage({
          type: "bulk-auto-link-results",
          ...result
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
            figma.notify(`Linked ${successCount} nodes, ${failCount} failed`, { error: failCount > 0 });
          } else {
            figma.notify(`Successfully linked ${successCount} text nodes`);
          }
          const textNodes = getAllTextNodesInfo(msg.scope || "page");
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
          const textNodes = getAllTextNodesInfo(msg.scope || "page");
          figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
        }
      }
      break;

    case "global-search":
      if (msg.searchQuery) {
        const results = globalSearchTranslations(msg.searchQuery);
        figma.ui.postMessage({
          type: "global-search-results",
          results
        });
      }
      break;

    case "create-linked-text":
      if (!canEdit()) {
        figma.notify("You don't have edit permissions", { error: true });
        return;
      }
      if (msg.multilanId && msg.text) {
        await createLinkedTextNode(msg.multilanId, msg.text, (msg.language as Language) || "en");
        figma.ui.postMessage({
          type: "text-created",
          multilanId: msg.multilanId
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
