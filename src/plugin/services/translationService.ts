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

/**
 * Normalize text for exact-match keying. Applies Unicode NFC so that
 * canonically-equivalent strings compare equal — e.g. "é" stored as a single
 * codepoint (U+00E9) vs "e" + combining accent (U+0065 U+0301), which look
 * identical but are different byte sequences. Without this, an exact match can
 * silently miss even though the text appears the same on screen.
 *
 * Case is intentionally preserved: exact matching stays case-sensitive so
 * "Private" does not match "private" (see the text-to-ID map).
 */
export function normalizeExactKey(text: string): string {
  return text.normalize('NFC');
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

// ---- Levenshtein & Scoring ----

/**
 * Levenshtein edit distance between two strings, clamped to `maxDistance`.
 * Returns `maxDistance + 1` if the true distance exceeds it.
 *
 * When `maxDistance` is given we compute only the diagonal band of cells with
 * |row - col| <= maxDistance: any cell with distance <= k necessarily has
 * |i - j| <= k (you need at least |i - j| insert/deletes to reach it), so cells
 * outside the band can never lie on an admissible path and are treated as
 * infinity. This turns the cost from O(m*n) into O(n * maxDistance), which is
 * what keeps close-match detection fast on long text.
 */
function levenshteinDistance(a: string, b: string, maxDistance?: number): number {
  let m = a.length;
  let n = b.length;

  if (maxDistance !== undefined && Math.abs(m - n) > maxDistance) return maxDistance + 1;
  if (m > n) { [a, b] = [b, a]; [m, n] = [n, m]; }  // ensure a is the shorter string

  const k = maxDistance ?? n;              // band half-width (full matrix if unbounded)
  const INF = (maxDistance ?? (m + n)) + 1; // any value strictly above the clamp

  let prev = new Uint16Array(m + 1);
  let curr = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j <= k ? j : INF;

  for (let i = 1; i <= n; i++) {
    const jFrom = Math.max(1, i - k);
    const jTo = Math.min(m, i + k);

    curr[0] = i <= k ? i : INF;
    if (jFrom > 1) curr[jFrom - 1] = INF;   // sentinel so the left neighbour reads as infinity
    let rowMin = curr[0];

    for (let j = jFrom; j <= jTo; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      let v = prev[j - 1] + cost;           // substitute / match (diagonal)
      const del = prev[j] + 1;              // delete from b (above)
      const ins = curr[j - 1] + 1;          // insert into b (left)
      if (del < v) v = del;
      if (ins < v) v = ins;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (jTo < m) curr[jTo + 1] = INF;       // sentinel for the next row's "above" read

    if (maxDistance !== undefined && rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }

  const result = prev[m];
  if (maxDistance !== undefined && result > maxDistance) return maxDistance + 1;
  return result;
}

/**
 * Calculate fuzzy match score (0-1) between query and text.
 *
 * `minScore` lets a caller that will discard anything below it opt into cheaper
 * scoring: we only need to distinguish "at least minScore" from "below", so we
 * can bound the edit distance more tightly. This makes Levenshtein bail far
 * sooner on long text — the dominant cost when detecting close matches.
 */
export function calculateMatchScore(query: string, text: string, minScore: number = 0): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText === lowerQuery) return 1;

  const maxLen = Math.max(lowerQuery.length, lowerText.length);
  if (maxLen === 0) return 0;

  // Tighten the edit-distance ceiling to the strictest bound the caller cares
  // about. similarity >= s  ⇔  distance <= (1 - s) * maxLen.
  const minSimilarity = Math.max(MIN_SIMILARITY_THRESHOLD, minScore);
  const maxDistance = Math.floor((1 - minSimilarity) * maxLen);
  const distance = levenshteinDistance(lowerQuery, lowerText, maxDistance);

  let score = distance <= maxDistance ? 1 - distance / maxLen : 0;

  // Substring relationships are weaker signals — only surface them when the
  // caller's threshold can actually admit them (avoids wasted work + noise).
  if (SUBSTRING_CONTAINS_SCORE >= minScore && lowerText.includes(lowerQuery)) {
    score = Math.max(score, SUBSTRING_CONTAINS_SCORE);
  } else if (SUBSTRING_CONTAINED_SCORE >= minScore && lowerQuery.includes(lowerText)) {
    score = Math.max(score, SUBSTRING_CONTAINED_SCORE);
  }

  return score >= minSimilarity ? score : 0;
}

/**
 * Quick pre-filter: rejects entries where the length difference alone
 * makes a match impossible, avoiding expensive Levenshtein computation.
 *
 * A score of `minScore` needs distance <= (1 - minScore) * maxLen, and distance
 * is at least the length difference, so the shorter/longer length ratio must be
 * >= minScore. For long text this prunes almost everything before scoring.
 */
function passesLengthPrefilter(queryLen: number, textLen: number, minScore: number = 0): boolean {
  if (textLen === 0) return false;
  const requiredRatio = Math.max(MIN_LENGTH_RATIO, minScore);
  const ratio = queryLen > textLen ? textLen / queryLen : queryLen / textLen;
  return ratio >= requiredRatio;
}

// ---- Core Search Engine ----

interface SearchOptions {
  /** Include exact/partial multilan ID matching */
  includeIdMatch: boolean;
  /** Attach metadata from metadataMap to results */
  includeMetadata: boolean;
  /**
   * Discard results below this score. Lets scoring skip length-mismatched
   * entries and use a tighter edit-distance bound — a big speedup on long text.
   */
  minScore?: number;
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
  const minScore = options.minScore ?? 0;
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
      if (!passesLengthPrefilter(queryLen, text.length, minScore)) continue;
      const score = calculateMatchScore(query, text, minScore);
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

/**
 * Search translations with fuzzy scoring. Returns top results with scores.
 * Pass `minScore` when you will discard lower scores anyway — it makes scoring
 * skip length-mismatched entries and bound Levenshtein tighter (faster on long text).
 */
export async function searchTranslationsWithScoreAsync(
  translationData: TranslationMap,
  query: string,
  limit: number = 10,
  cancellationToken?: CancellationToken,
  minScore: number = 0
): Promise<Array<SearchResult & { score: number }>> {
  return scoreEntriesAsync(
    translationData, query, limit,
    { includeIdMatch: false, includeMetadata: false, minScore },
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
  const exactIds = textToIdMap.get(normalizeExactKey(trimmed));
  if (exactIds && exactIds.length > 0) {
    const exactMatches = exactIds.map(id => ({
      multilanId: id,
      translations: translationData[id],
      metadata: metadataMap ? metadataMap[id] : undefined,
    }));
    const primary = exactMatches[0];
    return {
      status: 'exact',
      multilanId: primary.multilanId,
      translations: primary.translations,
      metadata: primary.metadata,
      exactMatches,
    };
  }

  if (cancellationToken?.cancelled) return { status: 'none' };

  // Pass 2: Fuzzy match (chunked, non-blocking). We only surface results at or
  // above CLOSE_MATCH_THRESHOLD, so scope the scorer to that bound up front.
  const fuzzyResults = await searchTranslationsWithScoreAsync(
    translationData, trimmed, 5, cancellationToken, CLOSE_MATCH_THRESHOLD
  );
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

async function buildTextToIdMapAsync(translationData: TranslationMap): Promise<Map<string, string[]>> {
  const textToMultilanIds = new Map<string, string[]>();
  const entries = Object.entries(translationData);

  for (let i = 0; i < entries.length; i++) {
    const [multilanId, langs] = entries[i];
    // Dedupe IDs *within a single multilan entry* (same text in en + fr would
    // otherwise add the ID twice), but keep duplicates *across multilan entries*.
    const seenForThisEntry = new Set<string>();
    for (const text of Object.values(langs)) {
      // Key by the normalized text (case-sensitive, NFC) so "Private" only
      // exact-matches an entry translated as "Private", not "private", while
      // canonically-equivalent accents still match. Case-insensitive matches
      // still surface via the fuzzy/close-match pass.
      const key = normalizeExactKey(text);
      if (seenForThisEntry.has(key)) continue;
      seenForThisEntry.add(key);
      const existing = textToMultilanIds.get(key);
      if (existing) {
        existing.push(multilanId);
      } else {
        textToMultilanIds.set(key, [multilanId]);
      }
    }
    if ((i + 1) % CHUNK_SIZE === 0) {
      await yieldToEventLoop();
    }
  }

  return textToMultilanIds;
}

let cachedTextToIdMap: Map<string, string[]> | null = null;
let cachedTextToIdMapSource: TranslationMap | null = null;
let textToIdBuildPromise: Promise<Map<string, string[]>> | null = null;

/** Get or build the text-to-IDs map (async, cached, deduplicates concurrent builds). */
export async function getTextToIdMap(translationData: TranslationMap): Promise<Map<string, string[]>> {
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

/** Fast exact-match lookup. Returns all multilanIds whose text equals `text`. */
export async function exactMatchLookup(translationData: TranslationMap, text: string): Promise<string[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const map = await getTextToIdMap(translationData);
  return map.get(normalizeExactKey(trimmed)) ?? [];
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
