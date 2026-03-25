// Translation service — handles searching, matching, and language detection.
// Translation data parsing is handled by the adapters layer.

import {
  TranslationMap,
  TranslationEntry,
  SearchResult,
  Language,
  SUPPORTED_LANGUAGES,
  MetadataMap,
  MultilanMetadata,
  MatchDetectionResult,
} from "../../shared/types";

// ---- Scoring Constants ----

/** Minimum Levenshtein similarity to count as a match */
const MIN_SIMILARITY_THRESHOLD = 0.4;
/** Maximum Levenshtein distance ratio for early termination (1 - MIN_SIMILARITY_THRESHOLD) */
const MAX_DISTANCE_RATIO = 0.6;
/** Score when query is a substring of the text */
const SUBSTRING_CONTAINS_SCORE = 0.7;
/** Score when text is a substring of the query */
const SUBSTRING_CONTAINED_SCORE = 0.5;
/** Score for exact multilan ID match */
const EXACT_ID_MATCH_SCORE = 1.0;
/** Score for partial multilan ID match (substring) */
const PARTIAL_ID_MATCH_SCORE = 0.9;
/** Score for ID substring match in search results */
const ID_SUBSTRING_MATCH_SCORE = 0.8;
/** Minimum score to qualify as a "close match" in detectMatch */
const CLOSE_MATCH_THRESHOLD = 0.8;
/** Minimum length ratio between query and text to attempt scoring */
const MIN_LENGTH_RATIO = 0.3;

// ---- Async Chunking ----

/** Number of entries to process before yielding to the event loop */
const CHUNK_SIZE = 500;

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ---- Cancellation ----

export interface CancellationToken {
  cancelled: boolean;
  cancel(): void;
}

export function createCancellationToken(): CancellationToken {
  const token: CancellationToken = {
    cancelled: false,
    cancel() { token.cancelled = true; },
  };
  return token;
}

// ---- Basic Lookups ----

export function getMetadata(metadataMap: MetadataMap, multilanId: string): MultilanMetadata | null {
  return metadataMap[multilanId] || null;
}

export function getTranslation(translationData: TranslationMap, multilanId: string, lang: Language): string | null {
  const entry = translationData[multilanId];
  if (!entry) return null;
  return entry[lang] || null;
}

export function getAllTranslations(translationData: TranslationMap, multilanId: string): TranslationEntry | null {
  return translationData[multilanId] || null;
}

export function isLanguage(lang: string | undefined): lang is Language {
  return lang !== undefined && SUPPORTED_LANGUAGES.includes(lang as Language);
}

// ---- Variable Handling ----

/**
 * Extract ###variable### values from text by matching against a template.
 * E.g., template "Hello, ###name###!" + text "Hello, John!" → { name: "John" }
 */
export function extractVariableValues(template: string, text: string): Record<string, string> | null {
  const varPattern = /###([^#]+)###/g;
  const variables: string[] = [];
  let match;
  while ((match = varPattern.exec(template)) !== null) {
    variables.push(match[1]);
  }
  if (variables.length === 0) return null;

  const parts = template.split(/###[^#]+###/);
  let regexStr = '';
  for (let i = 0; i < parts.length; i++) {
    regexStr += parts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (i < variables.length) {
      regexStr += '(.+?)';
    }
  }

  const textMatch = text.match(new RegExp('^' + regexStr + '$'));
  if (!textMatch) return null;

  const result: Record<string, string> = {};
  for (let i = 0; i < variables.length; i++) {
    result[variables[i]] = textMatch[i + 1];
  }
  return result;
}

/** Replace ###variable### placeholders in a template with actual values. */
export function applyVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/###([^#]+)###/g, (_match, name) => {
    return variables[name] !== undefined ? variables[name] : `###${name}###`;
  });
}

// ---- Levenshtein & Scoring ----

/**
 * Levenshtein edit distance between two strings.
 * Uses 2-row approach (O(min(m,n)) space) with optional early termination.
 */
function levenshteinDistance(a: string, b: string, maxDistance?: number): number {
  const m = a.length;
  const n = b.length;

  if (maxDistance !== undefined && Math.abs(m - n) > maxDistance) return maxDistance + 1;
  if (m > n) return levenshteinDistance(b, a, maxDistance);

  let prev = new Uint16Array(m + 1);
  let curr = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      curr[j] = a[j - 1] === b[i - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (maxDistance !== undefined && rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/** Calculate fuzzy match score (0-1) between query and text. */
export function calculateMatchScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText === lowerQuery) return 1;

  const maxLen = Math.max(lowerQuery.length, lowerText.length);
  if (maxLen === 0) return 0;

  const maxDistance = Math.floor(MAX_DISTANCE_RATIO * maxLen);
  const distance = levenshteinDistance(lowerQuery, lowerText, maxDistance);

  if (distance > maxDistance) {
    if (lowerText.includes(lowerQuery)) return SUBSTRING_CONTAINS_SCORE;
    if (lowerQuery.includes(lowerText)) return SUBSTRING_CONTAINED_SCORE;
    return 0;
  }

  const similarity = 1 - distance / maxLen;

  if (lowerText.includes(lowerQuery)) return Math.max(similarity, SUBSTRING_CONTAINS_SCORE);
  if (lowerQuery.includes(lowerText)) return Math.max(similarity, SUBSTRING_CONTAINED_SCORE);

  return similarity >= MIN_SIMILARITY_THRESHOLD ? similarity : 0;
}

/**
 * Quick pre-filter: rejects entries where the length difference alone
 * makes a match impossible, avoiding expensive Levenshtein computation.
 */
function passesLengthPrefilter(queryLen: number, textLen: number): boolean {
  if (textLen === 0) return false;
  const ratio = queryLen > textLen ? textLen / queryLen : queryLen / textLen;
  return ratio >= MIN_LENGTH_RATIO;
}

// ---- Core Search Engine ----

interface SearchOptions {
  /** Include exact/partial multilan ID matching */
  includeIdMatch: boolean;
  /** Attach metadata from metadataMap to results */
  includeMetadata: boolean;
}

/**
 * Shared search core — scores all translation entries against a query.
 * Both searchTranslationsWithScoreAsync and globalSearchTranslationsAsync
 * delegate to this function with different options.
 */
async function scoreEntriesAsync(
  translationData: TranslationMap,
  query: string,
  limit: number,
  options: SearchOptions,
  metadataMap?: MetadataMap,
  cancellationToken?: CancellationToken
): Promise<Array<SearchResult & { score: number }>> {
  const results: Array<SearchResult & { score: number }> = [];
  const lowerQuery = query.toLowerCase();
  const queryLen = lowerQuery.length;
  const entries = Object.entries(translationData);

  for (let i = 0; i < entries.length; i++) {
    if (cancellationToken?.cancelled) return [];

    const [multilanId, langs] = entries[i];
    let bestScore = 0;

    // Score against multilan ID
    if (options.includeIdMatch) {
      if (multilanId === query) {
        bestScore = EXACT_ID_MATCH_SCORE;
      } else if (multilanId.includes(query)) {
        bestScore = Math.max(bestScore, PARTIAL_ID_MATCH_SCORE);
      }
    } else {
      if (multilanId.toLowerCase().includes(lowerQuery)) {
        bestScore = Math.max(bestScore, ID_SUBSTRING_MATCH_SCORE);
      }
    }

    // Score against each language's text
    for (const text of Object.values(langs)) {
      if (!passesLengthPrefilter(queryLen, text.length)) continue;
      const score = calculateMatchScore(query, text);
      bestScore = Math.max(bestScore, score);
      if (bestScore >= 1) break;
    }

    if (bestScore > 0) {
      const metadata = options.includeMetadata && metadataMap ? metadataMap[multilanId] : undefined;
      results.push({ multilanId, translations: langs, score: bestScore, metadata });
    }

    if ((i + 1) % CHUNK_SIZE === 0) {
      await yieldToEventLoop();
    }
  }

  if (cancellationToken?.cancelled) return [];

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ---- Public Search Functions ----

/** Search translations with fuzzy scoring. Returns top results with scores. */
export async function searchTranslationsWithScoreAsync(
  translationData: TranslationMap,
  query: string,
  limit: number = 10,
  cancellationToken?: CancellationToken
): Promise<Array<SearchResult & { score: number }>> {
  return scoreEntriesAsync(
    translationData, query, limit,
    { includeIdMatch: false, includeMetadata: false },
    undefined, cancellationToken
  );
}

/** Global search — searches by multilan ID and text content, includes metadata. */
export async function globalSearchTranslationsAsync(
  translationData: TranslationMap,
  query: string,
  limit: number = 30,
  metadataMap?: MetadataMap,
  cancellationToken?: CancellationToken
): Promise<SearchResult[]> {
  const results = await scoreEntriesAsync(
    translationData, query, limit,
    { includeIdMatch: true, includeMetadata: true },
    metadataMap, cancellationToken
  );
  // Strip scores from public API
  return results.map(({ multilanId, translations, metadata }) => ({
    multilanId, translations, metadata,
  }));
}

/**
 * Detect match for selected text — tries exact match first (O(1)),
 * then falls back to fuzzy search for close matches.
 */
export async function detectMatchAsync(
  translationData: TranslationMap,
  text: string,
  metadataMap?: MetadataMap,
  cancellationToken?: CancellationToken
): Promise<MatchDetectionResult> {
  const trimmed = text.trim();
  if (!trimmed) return { status: 'none' };

  // Pass 1: Exact match (cached, O(1) after first build)
  const textToIdMap = await getTextToIdMap(translationData);
  const exactId = textToIdMap.get(trimmed.toLowerCase());
  if (exactId) {
    const translations = translationData[exactId];
    const metadata = metadataMap ? metadataMap[exactId] : undefined;
    return { status: 'exact', multilanId: exactId, translations, metadata };
  }

  if (cancellationToken?.cancelled) return { status: 'none' };

  // Pass 2: Fuzzy match (chunked, non-blocking)
  const fuzzyResults = await searchTranslationsWithScoreAsync(translationData, trimmed, 5, cancellationToken);
  if (cancellationToken?.cancelled) return { status: 'none' };

  const closeMatches = fuzzyResults.filter(r => r.score >= CLOSE_MATCH_THRESHOLD);
  if (closeMatches.length > 0) {
    const suggestions = closeMatches.map(r => ({
      ...r,
      metadata: metadataMap ? metadataMap[r.multilanId] : undefined,
    }));
    return { status: 'close', suggestions };
  }

  return { status: 'none' };
}

// ---- Text-to-ID Map (Exact Match Cache) ----

async function buildTextToIdMapAsync(translationData: TranslationMap): Promise<Map<string, string>> {
  const textToMultilanId = new Map<string, string>();
  const entries = Object.entries(translationData);

  for (let i = 0; i < entries.length; i++) {
    const [multilanId, langs] = entries[i];
    for (const text of Object.values(langs)) {
      const lower = text.toLowerCase();
      if (!textToMultilanId.has(lower)) {
        textToMultilanId.set(lower, multilanId);
      }
    }
    if ((i + 1) % CHUNK_SIZE === 0) {
      await yieldToEventLoop();
    }
  }

  return textToMultilanId;
}

let cachedTextToIdMap: Map<string, string> | null = null;
let cachedTextToIdMapSource: TranslationMap | null = null;
let textToIdBuildPromise: Promise<Map<string, string>> | null = null;

/** Get or build the text-to-ID map (async, cached, deduplicates concurrent builds). */
export async function getTextToIdMap(translationData: TranslationMap): Promise<Map<string, string>> {
  if (cachedTextToIdMap && cachedTextToIdMapSource === translationData) {
    return cachedTextToIdMap;
  }
  if (textToIdBuildPromise && cachedTextToIdMapSource === translationData) {
    return textToIdBuildPromise;
  }
  cachedTextToIdMapSource = translationData;
  textToIdBuildPromise = buildTextToIdMapAsync(translationData);
  const map = await textToIdBuildPromise;
  textToIdBuildPromise = null;
  cachedTextToIdMap = map;
  return map;
}

/** Invalidate the text-to-ID map cache (call on folder switch / data reload). */
export function invalidateTextToIdMapCache(): void {
  cachedTextToIdMap = null;
  cachedTextToIdMapSource = null;
  textToIdBuildPromise = null;
}

/** Fast exact-match lookup. Returns multilanId or null. */
export async function exactMatchLookup(translationData: TranslationMap, text: string): Promise<string | null> {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  const map = await getTextToIdMap(translationData);
  return map.get(trimmed) || null;
}

// ---- Language Detection ----

/**
 * Detect current language by comparing linked nodes' text with translations.
 * Returns the language that matches the most linked nodes.
 */
export function detectLanguage(
  translationData: TranslationMap,
  linkedNodes: Array<{ multilanId: string; characters: string }>
): Language {
  const languageCounts: Record<Language, number> = { en: 0, fr: 0, nl: 0, de: 0 };

  for (const node of linkedNodes) {
    const translations = translationData[node.multilanId];
    if (!translations) continue;

    for (const lang of SUPPORTED_LANGUAGES) {
      if (translations[lang] === node.characters) {
        languageCounts[lang]++;
        break;
      }
    }
  }

  let bestLang: Language = "en";
  let bestCount = 0;
  for (const lang of SUPPORTED_LANGUAGES) {
    if (languageCounts[lang] > bestCount) {
      bestCount = languageCounts[lang];
      bestLang = lang;
    }
  }

  return bestLang;
}
