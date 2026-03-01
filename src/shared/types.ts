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

// Search result
export interface SearchResult {
  multilanId: string;
  translations: TranslationEntry;
  score?: number;
  metadata?: MultilanMetadata;
}

// Match detection types
export type MatchStatus = 'linked' | 'exact' | 'close' | 'none';

export interface MatchDetectionResult {
  status: MatchStatus;
  multilanId?: string;
  suggestions?: Array<SearchResult & { score: number }>;
  translations?: TranslationEntry;
  metadata?: MultilanMetadata;
}

export interface UnlinkedQueueItem {
  nodeId: string;
  nodeName: string;
  characters: string;
}

export interface FrameNodeMatchResult {
  nodeId: string;
  nodeName: string;
  characters: string;
  matchResult: MatchDetectionResult;
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
  | "detect-match"
  | "get-unlinked-queue"
  | "global-search"
  | "create-linked-text"
  | "highlight-unlinked"
  | "clear-selection"
  | "close";

// UI message types (Plugin -> UI)
export type UIMessageType =
  | "init"
  | "text-nodes-updated"
  | "selection-changed"
  | "language-switched"
  | "lookup-result"
  | "match-detected"
  | "unlinked-queue"
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
  text?: string;
  highlight?: boolean;
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
  matchResult?: MatchDetectionResult;
  frameMatchResults?: FrameNodeMatchResult[];
  unlinkedQueue?: UnlinkedQueueItem[];
  hasSelection?: boolean;
}

// Constants
export const PLUGIN_DATA_KEY = "multilanId";
export const PLACEHOLDER_KEY = "isPlaceholder";
export const EXPECTED_TEXT_KEY = "expectedText";
