// Node service - handles Figma node operations

import {
  TextNodeInfo,
  TranslationEntry,
  PLUGIN_DATA_KEY,
  PLACEHOLDER_KEY,
  ORIGINAL_FILL_KEY,
  PLACEHOLDER_COLOR,
} from "../../shared/types";

/**
 * Get multilanId from a text node
 */
export function getMultilanId(node: TextNode): string | null {
  return node.getPluginData(PLUGIN_DATA_KEY) || null;
}

/**
 * Set multilanId on a text node
 */
export function setMultilanId(node: TextNode, multilanId: string): void {
  node.setPluginData(PLUGIN_DATA_KEY, multilanId);
}

/**
 * Clear multilanId from a text node
 */
export function clearMultilanId(node: TextNode): void {
  node.setPluginData(PLUGIN_DATA_KEY, "");
}

/**
 * Check if a node is marked as placeholder
 */
export function isPlaceholder(node: TextNode): boolean {
  return node.getPluginData(PLACEHOLDER_KEY) === "true";
}

/**
 * Set placeholder status on a node
 */
export function setPlaceholderStatus(node: TextNode, isPlaceholder: boolean): void {
  node.setPluginData(PLACEHOLDER_KEY, isPlaceholder ? "true" : "");
}

/**
 * Store original fill color for later restoration
 */
export function storeOriginalFill(node: TextNode): void {
  const fills = node.fills;
  if (Array.isArray(fills) && fills.length > 0) {
    node.setPluginData(ORIGINAL_FILL_KEY, JSON.stringify(fills));
  }
}

/**
 * Restore original fill color
 */
export function restoreOriginalFill(node: TextNode): void {
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

/**
 * Apply placeholder styling to a node
 */
export function applyPlaceholderStyle(node: TextNode): void {
  storeOriginalFill(node);
  node.fills = [{ type: "SOLID", color: PLACEHOLDER_COLOR }];
}

/**
 * Clear placeholder status and restore original styling
 */
export function clearPlaceholderStatus(node: TextNode): void {
  setPlaceholderStatus(node, false);
  restoreOriginalFill(node);
}

/**
 * Get all text nodes in scope (page or selection)
 */
export function getTextNodesInScope(scope: "page" | "selection"): TextNode[] {
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

/**
 * Build text node info for UI
 */
export function buildTextNodeInfo(
  node: TextNode,
  getTranslations: (multilanId: string) => TranslationEntry | null
): TextNodeInfo {
  const multilanId = getMultilanId(node);
  const translations = multilanId ? getTranslations(multilanId) : null;

  return {
    id: node.id,
    name: node.name,
    characters: node.characters,
    multilanId,
    translations,
    hasOverflow: false, // TODO: Implement overflow detection
    isPlaceholder: isPlaceholder(node),
  };
}

/**
 * Get all text nodes info for UI
 */
export function getAllTextNodesInfo(
  scope: "page" | "selection",
  getTranslations: (multilanId: string) => TranslationEntry | null
): TextNodeInfo[] {
  const nodes = getTextNodesInScope(scope);
  return nodes.map((node) => buildTextNodeInfo(node, getTranslations));
}

/**
 * Load font for a text node (handles mixed fonts)
 */
export async function loadNodeFont(node: TextNode): Promise<void> {
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
}

/**
 * Update text node content
 */
export async function updateNodeText(node: TextNode, text: string): Promise<void> {
  await loadNodeFont(node);
  node.characters = text;
}

/**
 * Get node by ID with type checking
 */
export async function getTextNodeById(nodeId: string): Promise<TextNode | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") return null;
  return node;
}

/**
 * Select a node in the canvas
 */
export async function selectNode(nodeId: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (node && "type" in node) {
    figma.currentPage.selection = [node as SceneNode];
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
  }
}

/**
 * Get info for currently selected text node
 */
export function getSelectedTextNodeInfo(
  getTranslations: (multilanId: string) => TranslationEntry | null
): TextNodeInfo | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;

  const node = selection[0];
  if (node.type !== "TEXT") return null;

  return buildTextNodeInfo(node, getTranslations);
}

/**
 * Create a new text node with default styling
 */
export async function createTextNode(
  text: string,
  position?: { x: number; y: number }
): Promise<TextNode> {
  const textNode = figma.createText();

  // Load default font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Set text
  textNode.characters = text;

  // Position
  if (position) {
    textNode.x = position.x;
    textNode.y = position.y;
  } else {
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
  }

  return textNode;
}
