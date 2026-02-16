// Linking service - handles linking/unlinking operations

import {
  TranslationMap,
  BulkMatchResult,
  Language,
} from "../../shared/types";
import {
  getTextNodeById,
  getTextNodesInScope,
  getMultilanId,
  setMultilanId,
  clearMultilanId,
  isPlaceholder,
  clearPlaceholderStatus,
  setPlaceholderStatus,
  wrapWithStars,
  updateNodeText,
  loadNodeFont,
  setExpectedText,
  clearExpectedText,
  addMultilanIdToName,
  removeMultilanIdFromName,
} from "./nodeService";
import {
  getTranslation,
  buildTextToIdMap,
  searchTranslationsWithScore,
} from "./translationService";

/**
 * Link a text node to a multilanId and optionally update text with translation
 */
export async function linkTextNode(
  nodeId: string,
  multilanId: string,
  translationData?: TranslationMap,
  language?: Language
): Promise<boolean> {
  const node = await getTextNodeById(nodeId);
  if (!node) return false;

  // Clear placeholder status and remove stars if it was a placeholder
  if (isPlaceholder(node)) {
    clearPlaceholderStatus(node);
  }

  setMultilanId(node, multilanId);

  // Add multilanId to node name for visibility to viewers
  addMultilanIdToName(node, multilanId);

  // Update text with translation if both translationData and language are provided
  if (translationData && language) {
    const translation = getTranslation(translationData, multilanId, language);
    if (translation) {
      await updateNodeText(node, translation);
      // Store the expected text to detect modifications
      setExpectedText(node, translation);
    }
  }

  return true;
}

/**
 * Unlink a text node
 */
export async function unlinkTextNode(nodeId: string): Promise<boolean> {
  const node = await getTextNodeById(nodeId);
  if (!node) return false;

  // Also clear placeholder status if present
  if (isPlaceholder(node)) {
    clearPlaceholderStatus(node);
  }

  // Remove multilanId from node name
  removeMultilanIdFromName(node);

  clearMultilanId(node);
  clearExpectedText(node);
  return true;
}

/**
 * Mark a node as placeholder with star markers
 * Unlinks the node first if it was linked to a translation
 */
export async function markAsPlaceholder(
  node: TextNode,
  text: string
): Promise<void> {
  // Clear any existing link - placeholder is not linked to a translation
  clearMultilanId(node);
  setPlaceholderStatus(node, true);

  // Set the text content with stars around it
  await updateNodeText(node, wrapWithStars(text));
}

/**
 * Switch language for all linked text nodes in scope
 */
export async function switchLanguage(
  translationData: TranslationMap,
  lang: Language,
  scope: "page" | "selection"
): Promise<{ success: number; missing: string[]; overflow: string[] }> {
  const nodes = getTextNodesInScope(scope);
  let success = 0;
  const missing: string[] = [];
  const overflow: string[] = [];

  for (const node of nodes) {
    const multilanId = getMultilanId(node);
    if (!multilanId) continue;

    let translation = getTranslation(translationData, multilanId, lang);

    if (!translation) {
      // Fallback to English
      translation = getTranslation(translationData, multilanId, "en");
      if (translation) {
        missing.push(node.id);
      } else {
        continue;
      }
    }

    // Load font before changing text
    try {
      await loadNodeFont(node);
    } catch (fontErr) {
      console.error(`Failed to load font for node ${node.id}:`, fontErr);
      continue;
    }

    const originalWidth = node.width;
    node.characters = translation;

    // Update expected text for modification detection
    setExpectedText(node, translation);

    // Check for overflow (text got wider)
    if (node.width > originalWidth * 1.2) {
      overflow.push(node.id);
    }

    success++;
  }

  return { success, missing, overflow };
}

/**
 * Bulk auto-link: find matches for unlinked text nodes
 */
export function bulkAutoLink(
  translationData: TranslationMap,
  scope: "page" | "selection"
): BulkMatchResult {
  const nodes = getTextNodesInScope(scope);
  const result: BulkMatchResult = {
    exactMatches: [],
    fuzzyMatches: [],
    unmatched: [],
  };

  // Build a reverse lookup for exact matching
  const textToMultilanId = buildTextToIdMap(translationData);

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
        multilanId: exactMatch,
      });
      continue;
    }

    // Pass 2: Fuzzy match
    const fuzzyResults = searchTranslationsWithScore(translationData, text);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score >= 0.3) {
      result.fuzzyMatches.push({
        nodeId: node.id,
        nodeName: node.name,
        text,
        suggestions: fuzzyResults.slice(0, 3),
      });
    } else {
      result.unmatched.push({
        nodeId: node.id,
        nodeName: node.name,
        text,
      });
    }
  }

  return result;
}

/**
 * Apply exact matches from bulk auto-link
 */
export async function applyExactMatches(
  matches: Array<{ nodeId: string; multilanId: string }>
): Promise<number> {
  let count = 0;
  for (const match of matches) {
    if (await linkTextNode(match.nodeId, match.multilanId)) {
      count++;
    }
  }
  return count;
}

/**
 * Create a new text node linked to a multilanId
 */
export async function createLinkedTextNode(
  translationData: TranslationMap,
  multilanId: string,
  text: string,
  lang: Language
): Promise<TextNode> {
  // Get the translation for the specified language
  const translation = getTranslation(translationData, multilanId, lang) || text;

  // Create text node
  const textNode = figma.createText();

  // Load default font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Set text
  textNode.characters = translation;

  // Link to multilanId
  setMultilanId(textNode, multilanId);

  // Add multilanId to node name for visibility to viewers
  addMultilanIdToName(textNode, multilanId);

  // Store expected text for modification detection
  setExpectedText(textNode, translation);

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

  return textNode;
}
