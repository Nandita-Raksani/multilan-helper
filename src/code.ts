// Multilan Helper Plugin - Main code
// Runs in Figma's sandbox environment

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
}

interface PluginMessage {
  type: string;
  language?: string;
  scope?: "page" | "selection";
  nodeId?: string;
  multilanId?: string;
  searchQuery?: string;
  placeholders?: { [key: string]: string };
}

// Constants
const PLUGIN_DATA_KEY = "multilanId";
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
    hasOverflow: false // TODO: Implement overflow detection
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
    await figma.loadFontAsync(node.fontName as FontName);

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
function linkTextNode(nodeId: string, multilanId: string): boolean {
  const node = figma.getNodeById(nodeId);
  if (!node || node.type !== "TEXT") return false;

  setMultilanId(node, multilanId);
  return true;
}

// Unlink a text node
function unlinkTextNode(nodeId: string): boolean {
  const node = figma.getNodeById(nodeId);
  if (!node || node.type !== "TEXT") return false;

  node.setPluginData(PLUGIN_DATA_KEY, "");
  return true;
}

// Select a node in the canvas
function selectNode(nodeId: string): void {
  const node = figma.getNodeById(nodeId);
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
    translationCount: Object.keys(translationData).length
  });
}

// Handle selection change
figma.on("selectionchange", () => {
  const selectedNode = getSelectedTextNodeInfo();
  figma.ui.postMessage({
    type: "selection-changed",
    selectedNode
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
        figma.notify(`Switched to ${msg.language.toUpperCase()}: ${result.success} texts updated`);

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
        const success = linkTextNode(msg.nodeId, msg.multilanId);
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
        const success = unlinkTextNode(msg.nodeId);
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
        selectNode(msg.nodeId);
      }
      break;

    case "refresh":
      const textNodes = getAllTextNodesInfo(msg.scope || "page");
      figma.ui.postMessage({ type: "text-nodes-updated", textNodes });
      break;

    case "close":
      figma.closePlugin();
      break;
  }
};

// Start
initialize();
