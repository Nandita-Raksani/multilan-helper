// Shared types between plugin and UI

// Supported languages
export const SUPPORTED_LANGUAGES = ["en", "fr", "nl", "de"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const FOLDER_NAMES: readonly string[] = ["EB", "EBB", "PCB"];

// Which side on-canvas multilanId badges are placed: 'auto' picks per node to avoid
// covering content; 'left'/'right' force every badge to that side.
export type AnnotationSide = "auto" | "left" | "right";

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
  // True when the node is linked but its on-canvas text no longer matches the
  // current .tra value for its language (the translation changed since linking).
  outOfDate?: boolean;
}

// Search result
export interface SearchResult {
  multilanId: string;
  translations: TranslationEntry;
  score?: number;
  metadata?: MultilanMetadata;
}

// Match detection types
export type MatchStatus = 'linked' | 'exact' | 'close' | 'none' | 'searching';

export interface MatchDetectionResult {
  status: MatchStatus;
  multilanId?: string;
  suggestions?: Array<SearchResult & { score: number }>;
  translations?: TranslationEntry;
  metadata?: MultilanMetadata;
  // Populated when status === 'exact' and the same text maps to ≥1 multilanId.
  // Always contains the primary match plus any duplicates; UI renders a carousel
  // when length > 1.
  exactMatches?: SearchResult[];
  // Set when status === 'linked' and the node's text is out of date vs the .tra.
  outOfDate?: boolean;
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

// Upload tracking metadata
export interface TraUploadMetadata {
  uploadTimestamp: number;
  fileLastModified: { en: number; fr: number; nl: number; de: number };
  availableLanguages: string[];
  sourceZipName?: string;
  releaseDate?: number;
}

// Folder data status for UI
export interface FolderDataStatus {
  [folder: string]: { hasData: boolean; metadata?: TraUploadMetadata };
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
  | "switch-folder"
  | "find-close-matches"
  | "upload-tra-files"
  | "verify-multilan-id"
  | "update-node-from-tra"
  | "update-all-from-tra"
  | "set-annotation-side"
  | "resize-ui"
  | "close";

// UI message types (Plugin -> UI)
export type UIMessageType =
  | "init"
  | "text-nodes-updated"
  | "node-updated"
  | "selection-changed"
  | "language-switched"
  | "lookup-result"
  | "match-detected"
  | "unlinked-queue"
  | "global-search-results"
  | "search-results"
  | "text-created"
  | "frame-match-result"
  | "tra-upload-needed"
  | "upload-success"
  | "upload-failed"
  | "verify-multilan-id-result"
  | "folder-data-status";

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
  folderName?: string;
  folderNames?: string[];
  traFileData?: { en: string; fr: string; nl: string; de: string };
  traUploadMetadata?: TraUploadMetadata;
  // Plugin -> UI fields
  folderDataStatus?: FolderDataStatus;
  uploadedTranslationCount?: number;
  canEdit?: boolean;
  nodeInfo?: TextNodeInfo;
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
  // verify-multilan-id flow
  found?: boolean;
  translations?: TranslationEntry;
  metadata?: MultilanMetadata;
  // resize-ui flow
  width?: number;
  height?: number;
  /** When true, allow resizing below the normal minimum height (collapse to header). */
  collapsed?: boolean;
  /** Badge side preference (auto/left/right) for the annotation feature. */
  annotationSide?: AnnotationSide;
}

// Constants
export const PLUGIN_DATA_KEY = "multilanId";
export const PLACEHOLDER_KEY = "isPlaceholder";
export const EXPECTED_TEXT_KEY = "expectedText";
// Language the node currently displays; recorded at link/switch time so an
// out-of-date node can be updated back to its original language from the .tra.
export const EXPECTED_LANG_KEY = "expectedLang";
// Marks any plugin-created on-canvas annotation node (badge group/frame/label/line)
// so text scans skip it and cleanup can find it.
export const ANNOTATION_KEY = "mlAnnotation";
// Stored on an annotation group: the id of the frame it annotates, so a re-run
// can refresh in place and "Remove" can target the right group.
export const ANNOTATION_TARGET_KEY = "mlAnnotationFrame";
