// Type definitions for the multilan:search API format
// These types represent the structure of data coming from the search endpoint

import { MultilanStatus } from "../../shared/types";

/**
 * Language ID to language code mapping
 */
export const LANGUAGE_ID_MAP: Record<number, string> = {
  1: 'nl',  // Dutch
  2: 'fr',  // French
  3: 'en',  // English
  4: 'de',  // German
};

/**
 * Tag entry in multilanTextList
 */
export interface SearchApiTag {
  id: number;
  tagValue: string;
  createdAt?: string;
  createdBy?: string;
  modifiedAt?: string;
  modifiedBy?: string;
}

/**
 * Text entry within a multilan (one translation)
 */
export interface SearchApiMultilanText {
  id: number;
  languageId: number;
  wording: string;
  status?: MultilanStatus;
  sourceLanguageId?: number;
  modifiedAt?: string;
  modifiedBy?: string;
  createdAt?: string;
  createdBy?: string;
  tagList?: SearchApiTag[];
}

/**
 * Context entry
 */
export interface SearchApiContext {
  id?: number;
  createdAt?: string;
  createdBy?: string;
  modifiedAt?: string;
  modifiedBy?: string;
}

/**
 * The multilan object containing all translations
 */
export interface SearchApiMultilan {
  id: number;
  multilanTextList: SearchApiMultilanText[];
  bucketIdList?: number[];
  contextList?: SearchApiContext[];
  description?: string;
  lockVersion?: number;
  createdAt?: string;
  createdBy?: string;
  modifiedAt?: string;
  modifiedBy?: string;
}

/**
 * Single result item in the search response
 */
export interface SearchApiResultItem {
  multilan: SearchApiMultilan;
  mostRelevantTextId?: number;
}

/**
 * The full search API response
 */
export interface SearchApiResponse {
  resultList: SearchApiResultItem[];
  isLastPage: boolean;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Request body for the search API
 */
export interface SearchApiRequest {
  pagination: {
    page: number;
    pageSize: number;
  };
  sorting: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  searchText?: string;
}

/**
 * Type guard to check if data is in the search API format
 */
export function isSearchApiFormat(data: unknown): data is SearchApiResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    'resultList' in obj &&
    Array.isArray(obj.resultList) &&
    'totalElements' in obj &&
    typeof obj.totalElements === 'number'
  );
}

/**
 * Convert language ID to language code
 */
export function languageIdToCode(languageId: number): string | null {
  return LANGUAGE_ID_MAP[languageId] || null;
}
