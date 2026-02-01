// Search API Adapter
// Transforms the multilan:search API format to internal plugin format

import { TranslationDataPort } from "../../ports/translationPort";
import { TranslationMap, MetadataMap, MultilanStatus } from "../../shared/types";
import {
  SearchApiResponse,
  SearchApiMultilan,
  isSearchApiFormat,
  languageIdToCode,
} from "../types/searchApi.types";

/**
 * Adapter for the multilan:search API format.
 * Transforms SearchApiResponse to the internal TranslationMap and MetadataMap formats.
 */
export class SearchApiAdapter implements TranslationDataPort {
  private translationMap: TranslationMap;
  private metadataMap: MetadataMap;
  private readonly sourceIdentifier = "search-api";

  constructor(data: unknown) {
    if (!isSearchApiFormat(data)) {
      throw new Error(
        "Invalid data format: expected SearchApiResponse object"
      );
    }
    this.translationMap = this.buildTranslationMap(data);
    this.metadataMap = this.buildMetadataMap(data);
  }

  /**
   * Build a translation map from Search API format
   */
  private buildTranslationMap(data: SearchApiResponse): TranslationMap {
    const map: TranslationMap = {};

    for (const item of data.resultList) {
      const multilan = item.multilan;
      const multilanId = String(multilan.id);
      map[multilanId] = {};

      for (const text of multilan.multilanTextList) {
        const langCode = languageIdToCode(text.languageId);
        if (langCode && text.wording) {
          map[multilanId][langCode] = text.wording;
        }
      }
    }

    return map;
  }

  /**
   * Build a metadata map from Search API format
   */
  private buildMetadataMap(data: SearchApiResponse): MetadataMap {
    const map: MetadataMap = {};

    for (const item of data.resultList) {
      const multilan = item.multilan;
      const multilanId = String(multilan.id);

      // Get status from the most relevant text or first text entry
      const relevantText = item.mostRelevantTextId
        ? multilan.multilanTextList.find(t => t.id === item.mostRelevantTextId)
        : multilan.multilanTextList[0];

      // Get source language from first text entry
      const sourceLanguageId = relevantText?.sourceLanguageId
        ? languageIdToCode(relevantText.sourceLanguageId)
        : undefined;

      map[multilanId] = {
        status: relevantText?.status as MultilanStatus | undefined,
        createdAt: multilan.createdAt,
        modifiedAt: multilan.modifiedAt || relevantText?.modifiedAt,
        modifiedBy: multilan.modifiedBy || relevantText?.modifiedBy,
        sourceLanguageId: sourceLanguageId || undefined,
      };
    }

    return map;
  }

  getTranslationMap(): TranslationMap {
    return this.translationMap;
  }

  getMetadataMap(): MetadataMap {
    return this.metadataMap;
  }

  getTranslationCount(): number {
    return Object.keys(this.translationMap).length;
  }

  getSourceIdentifier(): string {
    return this.sourceIdentifier;
  }
}

/**
 * Merge multiple SearchApiResponse objects into one
 * Used when fetching all pages
 */
export function mergeSearchApiResponses(responses: SearchApiResponse[]): SearchApiResponse {
  if (responses.length === 0) {
    return {
      resultList: [],
      isLastPage: true,
      numberOfElements: 0,
      totalElements: 0,
      totalPages: 0,
    };
  }

  const merged: SearchApiResponse = {
    resultList: [],
    isLastPage: true,
    numberOfElements: 0,
    totalElements: responses[0].totalElements,
    totalPages: responses[0].totalPages,
  };

  for (const response of responses) {
    merged.resultList.push(...response.resultList);
    merged.numberOfElements += response.numberOfElements;
  }

  return merged;
}
