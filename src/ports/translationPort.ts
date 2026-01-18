// Port interface for translation data sources
// This defines the contract that all adapters must implement

import { TranslationMap, MetadataMap } from "../shared/types";

/**
 * Port interface for accessing translation data.
 * All adapters must implement this interface to provide translation data
 * in the internal format expected by the plugin.
 */
export interface TranslationDataPort {
  /**
   * Get the translation map containing all translations keyed by multilanId
   */
  getTranslationMap(): TranslationMap;

  /**
   * Get the metadata map containing metadata for each translation entry
   */
  getMetadataMap(): MetadataMap;

  /**
   * Get the total number of translation entries
   */
  getTranslationCount(): number;

  /**
   * Get an identifier for the data source (e.g., "current-api", "future-api")
   */
  getSourceIdentifier(): string;
}
