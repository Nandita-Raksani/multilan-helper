// Shared types between plugin and UI

// Supported languages
export const SUPPORTED_LANGUAGES = ["en", "fr", "nl", "de"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// API format (from backend)
export interface MultilanText {
  languageId: string;
  wording: string;
  id: number;
}

export interface ApiMultilan {
  id: number;
  multilanTextList: MultilanText[];
}

// Internal translation format
export interface TranslationEntry {
  [lang: string]: string;
}

export interface TranslationMap {
  [multilanId: string]: TranslationEntry;
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

// Search result
export interface SearchResult {
  multilanId: string;
  translations: TranslationEntry;
  score?: number;
}

// Bulk auto-link results
export interface BulkMatchResult {
  exactMatches: Array<{
    nodeId: string;
    nodeName: string;
    text: string;
    multilanId: string;
  }>;
  fuzzyMatches: Array<{
    nodeId: string;
    nodeName: string;
    text: string;
    suggestions: Array<SearchResult & { score: number }>;
  }>;
  unmatched: Array<{
    nodeId: string;
    nodeName: string;
    text: string;
  }>;
}

// Plugin message types
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

export interface PluginMessage {
  type: PluginMessageType;
  language?: string;
  scope?: "page" | "selection";
  nodeId?: string;
  multilanId?: string;
  searchQuery?: string;
  placeholders?: Record<string, string>;
  text?: string;
  confirmations?: Array<{ nodeId: string; multilanId: string }>;
}

// UI message types
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

export interface UIMessage {
  type: UIMessageType;
  [key: string]: unknown;
}

// Constants
export const PLUGIN_DATA_KEY = "multilanId";
export const PLACEHOLDER_KEY = "isPlaceholder";
export const ORIGINAL_FILL_KEY = "originalFill";
export const PLACEHOLDER_COLOR: RGB = { r: 0.96, g: 0.62, b: 0.04 };
