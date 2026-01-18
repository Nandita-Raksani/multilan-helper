// Shared types between plugin and UI

// Supported languages
export const SUPPORTED_LANGUAGES = ["en", "fr", "nl", "de"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Translation status values
export type MultilanStatus =
  | "TO_TRANSLATE_INTERNALLY"
  | "TO_TRANSLATE_EXTERNALLY"
  | "IN_TRANSLATION"
  | "FINAL"
  | "DRAFT"
  | "FOUR_EYES_CHECK";

// Note: API format types (MultilanText, ApiMultilan) have been moved to
// src/adapters/types/currentApi.types.ts as part of the hexagonal architecture

// Metadata for a multilan entry
export interface MultilanMetadata {
  status?: MultilanStatus;
  createdAt?: string;
  modifiedAt?: string;
  modifiedBy?: string;
  sourceLanguageId?: string;
}

// Internal translation format
export interface TranslationEntry {
  [lang: string]: string;
}

export interface TranslationMap {
  [multilanId: string]: TranslationEntry;
}

// Metadata map for storing metadata per multilanId
export interface MetadataMap {
  [multilanId: string]: MultilanMetadata;
}

// Text node information for UI
export interface TextNodeInfo {
  id: string;
  name: string;
  characters: string;
  multilanId: string | null;
  translations: TranslationEntry | null;
  hasOverflow: boolean;
  isPlaceholder: boolean;
}

// Variable occurrence with index for duplicate handling
export interface VariableOccurrence {
  name: string;
  key: string; // Unique key like "amount" or "amount_2" for duplicates
  index: number; // 1-based index for this variable name
  isIndexed: boolean; // True if this variable appears multiple times
}

// Search result
export interface SearchResult {
  multilanId: string;
  translations: TranslationEntry;
  score?: number;
  variableOccurrences?: VariableOccurrence[];
  metadata?: MultilanMetadata;
}

// Bulk auto-link match item types
export interface ExactMatch {
  nodeId: string;
  nodeName: string;
  text: string;
  multilanId: string;
}

export interface FuzzyMatch {
  nodeId: string;
  nodeName: string;
  text: string;
  suggestions: Array<SearchResult & { score: number }>;
}

export interface UnmatchedItem {
  nodeId: string;
  nodeName: string;
  text: string;
}

// Bulk auto-link results
export interface BulkMatchResult {
  exactMatches: ExactMatch[];
  fuzzyMatches: FuzzyMatch[];
  unmatched: UnmatchedItem[];
}

// UI state bulk link results
export interface BulkLinkResults {
  exactMatches: ExactMatch[];
  fuzzyMatches: FuzzyMatch[];
  unmatched: UnmatchedItem[];
}

// Plugin message types (UI -> Plugin)
export type PluginMessageType =
  | "init"
  | "switch-language"
  | "search"
  | "link-node"
  | "unlink-node"
  | "select-node"
  | "refresh"
  | "lookup-multilanId"
  | "mark-as-placeholder"
  | "bulk-auto-link"
  | "apply-exact-matches"
  | "confirm-fuzzy-link"
  | "global-search"
  | "create-linked-text"
  | "close";

// UI message types (Plugin -> UI)
export type UIMessageType =
  | "init"
  | "text-nodes-updated"
  | "selection-changed"
  | "language-switched"
  | "lookup-result"
  | "bulk-auto-link-results"
  | "global-search-results"
  | "search-results"
  | "text-created";

// Combined message type for both directions
export interface PluginMessage {
  type: PluginMessageType | UIMessageType;
  // UI -> Plugin fields
  language?: Language;
  scope?: "page" | "selection";
  nodeId?: string;
  multilanId?: string;
  searchQuery?: string;
  variables?: Record<string, string>;
  text?: string;
  confirmations?: Array<{ nodeId: string; multilanId: string }>;
  // Plugin -> UI fields
  canEdit?: boolean;
  textNodes?: TextNodeInfo[];
  selectedNode?: TextNodeInfo | null;
  selectionTextNodes?: TextNodeInfo[];
  translationCount?: number;
  buildTimestamp?: string;
  detectedLanguage?: Language;
  success?: number;
  missing?: string[];
  results?: SearchResult[];
  exactMatches?: ExactMatch[];
  fuzzyMatches?: FuzzyMatch[];
  unmatched?: UnmatchedItem[];
}

// Constants
export const PLUGIN_DATA_KEY = "multilanId";
export const PLACEHOLDER_KEY = "isPlaceholder";
export const EXPECTED_TEXT_KEY = "expectedText";
export const VARIABLE_VALUES_KEY = "variableValues";
