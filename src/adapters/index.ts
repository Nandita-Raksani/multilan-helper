// Adapter Registry
// Central module for managing and creating translation data adapters

import { TranslationDataPort } from "../ports/translationPort";
import { CurrentApiAdapter } from "./implementations/currentApiAdapter";
import { SearchApiAdapter } from "./implementations/searchApiAdapter";
import { isCurrentApiFormat } from "./types/currentApi.types";
import { isSearchApiFormat } from "./types/searchApi.types";

// Supported adapter types
export type AdapterType = "current-api" | "search-api";

// Adapter factory function type
type AdapterFactory = (data: unknown) => TranslationDataPort;

// Registry of adapter factories
const adapterRegistry: Map<AdapterType, AdapterFactory> = new Map([
  ["current-api", (data) => new CurrentApiAdapter(data)],
  ["search-api", (data) => new SearchApiAdapter(data)],
]);

/**
 * Detect the appropriate adapter type for the given data
 */
export function detectAdapterType(data: unknown): AdapterType | null {
  // Check search API format first (has resultList with multilan objects)
  // This is the standard format for both API and bundled data
  if (isSearchApiFormat(data)) {
    return "search-api";
  }
  // Legacy: current API format (array of multilans with string languageIds)
  if (isCurrentApiFormat(data)) {
    return "current-api";
  }
  return null;
}

/**
 * Create an adapter for the given data
 * @param data The raw data to adapt
 * @param type Optional adapter type; if not provided, will auto-detect
 * @returns A TranslationDataPort adapter
 * @throws Error if adapter type cannot be determined or is not supported
 */
export function createAdapter(
  data: unknown,
  type?: AdapterType
): TranslationDataPort {
  const adapterType = type ?? detectAdapterType(data);

  if (!adapterType) {
    throw new Error(
      "Unable to detect adapter type for the provided data. " +
        "Please specify the adapter type explicitly."
    );
  }

  const factory = adapterRegistry.get(adapterType);
  if (!factory) {
    throw new Error(`No adapter registered for type: ${adapterType}`);
  }

  return factory(data);
}

/**
 * Register a new adapter factory
 * Allows extending the adapter system with custom adapters
 * @param type The adapter type identifier
 * @param factory The factory function that creates the adapter
 */
export function registerAdapter(
  type: AdapterType,
  factory: AdapterFactory
): void {
  adapterRegistry.set(type, factory);
}

/**
 * Check if an adapter type is registered
 */
export function hasAdapter(type: string): boolean {
  return adapterRegistry.has(type as AdapterType);
}

/**
 * Get all registered adapter types
 */
export function getRegisteredAdapterTypes(): AdapterType[] {
  return Array.from(adapterRegistry.keys());
}

// Re-export adapter implementations for direct use if needed
export { CurrentApiAdapter } from "./implementations/currentApiAdapter";
export { SearchApiAdapter, mergeSearchApiResponses } from "./implementations/searchApiAdapter";

// Re-export types
export { TranslationDataPort } from "../ports/translationPort";
export type {
  CurrentApiMultilan,
  CurrentApiMultilanText,
} from "./types/currentApi.types";
export { isCurrentApiFormat } from "./types/currentApi.types";
export type {
  SearchApiResponse,
  SearchApiResultItem,
  SearchApiMultilan,
  SearchApiRequest,
} from "./types/searchApi.types";
export { isSearchApiFormat } from "./types/searchApi.types";
