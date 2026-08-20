// Node service - handles Figma node operations

import {
  TextNodeInfo,
  TranslationEntry,
  Language,
  SUPPORTED_LANGUAGES,
  PLUGIN_DATA_KEY,
  PLACEHOLDER_KEY,
  EXPECTED_TEXT_KEY,
  EXPECTED_LANG_KEY,
} from "../../shared/types";
import { extractVariableValues } from "./translationService";

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
 * Wrap text with stars for placeholder display
 */
export function wrapWithStars(text: string): string {
  return `*${text}*`;
}

/**
 * Remove stars from placeholder text
 */
export function unwrapStars(text: string): string {
  return text.replace(/^\*|\*$/g, "");
}

/**
 * Clear placeholder status
 */
export function clearPlaceholderStatus(node: TextNode): void {
  setPlaceholderStatus(node, false);
}

/**
 * Get expected text from a text node
 */
export function getExpectedText(node: TextNode): string | null {
  return node.getPluginData(EXPECTED_TEXT_KEY) || null;
}

/**
 * Set expected text on a text node
 */
export function setExpectedText(node: TextNode, text: string): void {
  node.setPluginData(EXPECTED_TEXT_KEY, text);
}

/**
 * Clear expected text from a text node
 */
export function clearExpectedText(node: TextNode): void {
  node.setPluginData(EXPECTED_TEXT_KEY, "");
}

/**
 * Check if a linked node's text has been modified from expected
 */
export function isTextModified(node: TextNode): boolean {
  const expectedText = getExpectedText(node);
  if (!expectedText) return false;
  return node.characters !== expectedText;
}

/**
 * Get the language a node currently displays (recorded at link/switch time)
 */
export function getExpectedLang(node: TextNode): Language | null {
  const value = node.getPluginData(EXPECTED_LANG_KEY);
  return SUPPORTED_LANGUAGES.includes(value as Language) ? (value as Language) : null;
}

/**
 * Set the language a node currently displays
 */
export function setExpectedLang(node: TextNode, lang: Language): void {
  node.setPluginData(EXPECTED_LANG_KEY, lang);
}

/**
 * Clear the recorded display language
 */
export function clearExpectedLang(node: TextNode): void {
  node.setPluginData(EXPECTED_LANG_KEY, "");
}

/**
 * True when the given .tra value and the node's current text represent the same
 * translation. They match when identical, or when the node shows an interpolated
 * form of a `###variable###` template (e.g. "Hello, John" for "Hello, ###name###").
 */
function textMatchesTranslation(translation: string, text: string): boolean {
  if (translation === text) return true;
  if (translation.includes("###")) {
    const vars = extractVariableValues(translation, text);
    if (vars) return true;
  }
  return false;
}

/**
 * Check if a linked node's on-canvas text is out of date vs the current .tra.
 *
 * A node is out of date when it is linked, was NOT edited by a designer
 * (current text still equals expectedText), yet the current translation for its
 * language differs from what's on canvas. For nodes linked before the
 * expectedLang feature, falls back to "matches none of the languages".
 */
export function isOutOfDate(
  node: TextNode,
  getTranslations: (multilanId: string) => TranslationEntry | null
): boolean {
  const multilanId = getMultilanId(node);
  if (!multilanId) return false;

  // A designer edit (text diverged from the snapshot) is not "out of date" —
  // that's handled by auto-unlink, not by the update-from-tra flow.
  if (isTextModified(node)) return false;

  const translations = getTranslations(multilanId);
  if (!translations) return false;

  const lang = getExpectedLang(node);
  if (lang) {
    const target = translations[lang];
    if (target === undefined || target === "") return false;
    return !textMatchesTranslation(target, node.characters);
  }

  // Legacy node (no recorded language): out of date if the current text matches
  // none of the available translations.
  const values = Object.values(translations).filter((v) => v !== undefined && v !== "");
  if (values.length === 0) return false;
  return !values.some((v) => textMatchesTranslation(v, node.characters));
}

// Separator used to append multilanId to node name
const NAME_SEPARATOR = " • ";

/**
 * Add multilanId to node name for visibility to viewers
 * Format: "Original Name • TXT-1234"
 */
export function addMultilanIdToName(node: TextNode, multilanId: string): void {
  // Remove any existing multilanId first
  const baseName = removeMultilanIdFromNameString(node.name);
  node.name = `${baseName}${NAME_SEPARATOR}${multilanId}`;
}

/**
 * Remove multilanId from node name
 */
export function removeMultilanIdFromName(node: TextNode): void {
  node.name = removeMultilanIdFromNameString(node.name);
}

/**
 * Helper to remove multilanId suffix from a name string
 */
function removeMultilanIdFromNameString(name: string): string {
  const separatorIndex = name.lastIndexOf(NAME_SEPARATOR);
  if (separatorIndex === -1) return name;
  return name.substring(0, separatorIndex);
}

/**
 * True if the node is visible AND every ancestor up to the page is visible.
 * A node hidden via any ancestor is considered hidden on canvas.
 */
export function isEffectivelyVisible(node: SceneNode): boolean {
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if ("visible" in current && current.visible === false) return false;
    current = current.parent;
  }
  return true;
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
    outOfDate: multilanId ? isOutOfDate(node, getTranslations) : false,
  };
}

/**
 * Get all text nodes info for UI. Skips nodes hidden via their own `visible`
 * flag or any ancestor's — those don't render on canvas, so showing them in
 * the frame list / search results / highlight is just noise (and often
 * misleading, since they belong to a different screen/state).
 */
export function getAllTextNodesInfo(
  scope: "page" | "selection",
  getTranslations: (multilanId: string) => TranslationEntry | null
): TextNodeInfo[] {
  const nodes = getTextNodesInScope(scope);
  return nodes
    .filter((node) => isEffectivelyVisible(node))
    .map((node) => buildTextNodeInfo(node, getTranslations));
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
