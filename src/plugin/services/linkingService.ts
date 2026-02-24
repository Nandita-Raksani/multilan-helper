// Linking service - handles linking/unlinking operations

import {
  TranslationMap,
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
  setExpectedText,
  clearExpectedText,
  addMultilanIdToName,
  removeMultilanIdFromName,
} from "./nodeService";
import {
  getTranslation,
  getAllTranslations,
  extractVariableValues,
  applyVariables,
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

  // Store the current text as expected text to detect future modifications
  setExpectedText(node, node.characters);

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
 * Switch language for all linked text nodes in scope.
 * Fonts must be preloaded (via initialize) for this to work synchronously.
 */
export function switchLanguage(
  translationData: TranslationMap,
  lang: Language,
  scope: "page" | "selection"
): { success: number; missing: string[]; overflow: string[] } {
  const nodes = getTextNodesInScope(scope);
  let success = 0;
  const missing: string[] = [];
  const overflow: string[] = [];

  for (const node of nodes) {
    const multilanId = getMultilanId(node);
    if (!multilanId) continue;

    let translation = getTranslation(translationData, multilanId, lang);

    if (!translation) {
      missing.push(node.id);
      translation = "*Multilan not available*";
    }

    // Preserve ###variable### values from the current text
    if (translation.includes('###')) {
      const allTranslations = getAllTranslations(translationData, multilanId);
      if (allTranslations) {
        // Try to extract variable values by matching current text against each language template
        for (const langTemplate of Object.values(allTranslations)) {
          const vars = extractVariableValues(langTemplate, node.characters);
          if (vars && Object.keys(vars).length > 0) {
            translation = applyVariables(translation, vars);
            break;
          }
        }
      }
    }

    try {
      node.characters = translation;
      setExpectedText(node, translation);
      success++;
    } catch (err) {
      console.error(`Failed to switch node ${node.id}:`, err);
    }
  }

  return { success, missing, overflow };
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
