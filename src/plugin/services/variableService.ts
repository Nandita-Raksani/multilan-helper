/**
 * Variable Service - Manages Figma Variables for translations
 *
 * This enables dev/view seat users to switch languages via Figma's native
 * variable mode switching, without needing edit permissions.
 */

import { Language, SUPPORTED_LANGUAGES, TranslationMap } from "../../shared/types";
import { replaceVariables } from "./translationService";

const COLLECTION_NAME = "Translations";

// Cache for variable collection and mode IDs
let cachedCollection: VariableCollection | null = null;
let cachedModeIds: Record<Language, string> | null = null;

/**
 * Check if Figma Variables API is available
 */
function isVariablesApiAvailable(): boolean {
  return typeof figma !== "undefined" &&
    figma.variables !== undefined &&
    typeof figma.variables.getLocalVariableCollectionsAsync === "function";
}

/**
 * Check if a node has setBoundVariable method
 */
function canBindVariable(node: TextNode): boolean {
  return typeof node.setBoundVariable === "function";
}

/**
 * Get or create the Translations variable collection with language modes
 */
export async function getOrCreateTranslationCollection(): Promise<{
  collection: VariableCollection;
  modeIds: Record<Language, string>;
} | null> {
  if (!isVariablesApiAvailable()) {
    return null;
  }

  // Return cached if available
  if (cachedCollection && cachedModeIds) {
    // Verify it still exists
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const existing = collections.find(c => c.id === cachedCollection!.id);
    if (existing) {
      return { collection: cachedCollection, modeIds: cachedModeIds };
    }
  }

  // Look for existing collection
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let collection = collections.find(c => c.name === COLLECTION_NAME);

  if (!collection) {
    // Create new collection
    collection = figma.variables.createVariableCollection(COLLECTION_NAME);

    // Rename the default mode to first language
    const defaultMode = collection.modes[0];
    collection.renameMode(defaultMode.modeId, SUPPORTED_LANGUAGES[0].toUpperCase());

    // Try to add remaining language modes (may fail on free plan - limited to 1 mode)
    for (let i = 1; i < SUPPORTED_LANGUAGES.length; i++) {
      try {
        collection.addMode(SUPPORTED_LANGUAGES[i].toUpperCase());
      } catch {
        // Free plan only allows 1 mode - that's ok, we'll work with what we have
        console.warn(`Could not add mode ${SUPPORTED_LANGUAGES[i]} - plan may be limited to 1 mode`);
        break;
      }
    }
  }

  // Build mode ID mapping
  const modeIds: Record<string, string> = {};
  for (const mode of collection.modes) {
    const lang = mode.name.toLowerCase() as Language;
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      modeIds[lang] = mode.modeId;
    }
  }

  // Cache for future calls
  cachedCollection = collection;
  cachedModeIds = modeIds as Record<Language, string>;

  return { collection, modeIds: cachedModeIds };
}

/**
 * Get or create a variable for a multilanId
 */
export async function getOrCreateTranslationVariable(
  multilanId: string,
  translations: Record<string, string>
): Promise<Variable | null> {
  const result = await getOrCreateTranslationCollection();
  if (!result) {
    return null;
  }

  const { collection, modeIds } = result;

  // Look for existing variable
  const variables = await figma.variables.getLocalVariablesAsync("STRING");
  let variable = variables.find(
    v => v.variableCollectionId === collection.id && v.name === multilanId
  );

  if (!variable) {
    // Create new variable
    variable = figma.variables.createVariable(multilanId, collection, "STRING");
  }

  // Set values for each available language mode
  for (const lang of SUPPORTED_LANGUAGES) {
    const modeId = modeIds[lang];
    if (!modeId) continue; // Mode not available (free plan limitation)
    const text = translations[lang] || translations["en"] || "";
    if (text) {
      try {
        variable.setValueForMode(modeId, text);
      } catch {
        // Mode might not exist
        console.warn(`Could not set value for mode ${lang}`);
      }
    }
  }

  return variable;
}

/**
 * Bind a text node's content to a translation variable
 */
export async function bindTextToVariable(
  node: TextNode,
  variable: Variable
): Promise<boolean> {
  if (!canBindVariable(node)) {
    return false;
  }
  // Bind the text content to the variable
  node.setBoundVariable("characters", variable);
  return true;
}

/**
 * Unbind a text node from its variable
 */
export function unbindTextFromVariable(node: TextNode): void {
  if (!canBindVariable(node)) {
    return;
  }
  // Remove the variable binding
  node.setBoundVariable("characters", null);
}

/**
 * Set variable mode on a frame/node for the Translations collection
 * This allows per-frame language switching
 */
export async function setFrameVariableMode(
  node: SceneNode,
  language: Language
): Promise<boolean> {
  try {
    if (!isVariablesApiAvailable()) {
      return false;
    }

    const result = await getOrCreateTranslationCollection();
    if (!result) {
      return false;
    }

    const { collection, modeIds } = result;
    const modeId = modeIds[language];

    if (!modeId) {
      console.warn(`Mode not found for language: ${language}`);
      return false;
    }

    // Set explicit variable mode on the node
    node.setExplicitVariableModeForCollection(collection, modeId);
    return true;
  } catch (error) {
    console.error("Failed to set frame variable mode:", error);
    return false;
  }
}

/**
 * Clear explicit variable mode from a frame/node
 */
export async function clearFrameVariableMode(node: SceneNode): Promise<boolean> {
  try {
    if (!isVariablesApiAvailable()) {
      return false;
    }

    const result = await getOrCreateTranslationCollection();
    if (!result) {
      return false;
    }

    const { collection } = result;
    node.clearExplicitVariableModeForCollection(collection);
    return true;
  } catch (error) {
    console.error("Failed to clear frame variable mode:", error);
    return false;
  }
}

/**
 * Check if a text node is bound to a variable
 */
export function isTextBoundToVariable(node: TextNode): boolean {
  const boundVariables = node.boundVariables;
  return boundVariables?.characters !== undefined;
}

/**
 * Create variable and bind for a linked node
 * This is the main function to call when linking a node
 */
export async function setupVariableBinding(
  node: TextNode,
  multilanId: string,
  translationData: TranslationMap
): Promise<boolean> {
  try {
    if (!isVariablesApiAvailable()) {
      console.warn("Variables API not available");
      return false;
    }

    const translations = translationData[multilanId];
    if (!translations) {
      console.warn(`No translations found for ${multilanId}`);
      return false;
    }

    const variable = await getOrCreateTranslationVariable(multilanId, translations);
    if (!variable) {
      console.warn("Failed to create variable");
      return false;
    }

    return await bindTextToVariable(node, variable);
  } catch (error) {
    console.error("Failed to setup variable binding:", error);
    return false;
  }
}

/**
 * Update variable values when translations change
 */
export async function updateVariableValues(
  multilanId: string,
  translations: Record<string, string>
): Promise<void> {
  const result = await getOrCreateTranslationCollection();
  if (!result) {
    return;
  }

  const { collection, modeIds } = result;

  const variables = await figma.variables.getLocalVariablesAsync("STRING");
  const variable = variables.find(
    v => v.variableCollectionId === collection.id && v.name === multilanId
  );

  if (variable) {
    for (const lang of SUPPORTED_LANGUAGES) {
      const modeId = modeIds[lang];
      const text = translations[lang] || translations["en"] || "";
      if (modeId && text) {
        variable.setValueForMode(modeId, text);
      }
    }
  }
}

/**
 * Sync all translation variables with current modes
 * Call this on plugin init to populate any new modes added manually
 */
export async function syncTranslationVariables(
  translationData: TranslationMap
): Promise<{ synced: number; modes: string[] }> {
  if (!isVariablesApiAvailable()) {
    return { synced: 0, modes: [] };
  }

  // Clear cache to re-read modes from collection
  cachedCollection = null;
  cachedModeIds = null;

  const result = await getOrCreateTranslationCollection();
  if (!result) {
    return { synced: 0, modes: [] };
  }

  const { collection, modeIds } = result;
  const availableModes = Object.keys(modeIds);

  // Get all variables in the Translations collection
  const variables = await figma.variables.getLocalVariablesAsync("STRING");
  const translationVariables = variables.filter(
    v => v.variableCollectionId === collection.id
  );

  let syncedCount = 0;

  for (const variable of translationVariables) {
    // Check if this variable name matches a multilanId (not an instance variable with _suffix)
    const multilanId = variable.name;
    const translations = translationData[multilanId];

    if (translations) {
      // Fill in values for all available modes
      for (const lang of SUPPORTED_LANGUAGES) {
        const modeId = modeIds[lang as Language];
        if (!modeId) continue;

        const text = translations[lang] || translations["en"] || "";
        if (text) {
          try {
            variable.setValueForMode(modeId, text);
          } catch {
            // Mode might have issues
          }
        }
      }
      syncedCount++;
    }
  }

  return { synced: syncedCount, modes: availableModes };
}

/**
 * Setup variable binding with custom variable values replaced in all languages
 * Used when linking a node with variables like ###name### = "John"
 */
export async function setupVariableBindingWithValues(
  node: TextNode,
  multilanId: string,
  translationData: TranslationMap,
  variableValues: Record<string, string>
): Promise<boolean> {
  try {
    if (!isVariablesApiAvailable()) {
      console.warn("Variables API not available");
      return false;
    }

    const translations = translationData[multilanId];
    if (!translations) {
      console.warn(`No translations found for ${multilanId}`);
      return false;
    }

    // Replace variables in all language translations
    const replacedTranslations: Record<string, string> = {};
    for (const lang of SUPPORTED_LANGUAGES) {
      const text = translations[lang] || translations["en"] || "";
      if (text) {
        replacedTranslations[lang] = replaceVariables(text, variableValues);
      }
    }

    // Create a unique variable name for this instance (multilanId + node id suffix)
    // This allows multiple instances of the same translation with different values
    const instanceVariableName = `${multilanId}_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const variable = await getOrCreateTranslationVariable(instanceVariableName, replacedTranslations);
    if (!variable) {
      console.warn("Failed to create variable with values");
      return false;
    }

    return await bindTextToVariable(node, variable);
  } catch (error) {
    console.error("Failed to setup variable binding with values:", error);
    return false;
  }
}
