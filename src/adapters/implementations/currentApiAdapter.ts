// Current API Adapter
// Transforms the current backend API format to internal plugin format

import { TranslationDataPort } from "../../ports/translationPort";
import { TranslationMap, MetadataMap } from "../../shared/types";
import {
  CurrentApiMultilan,
  isCurrentApiFormat,
} from "../types/currentApi.types";

/**
 * Adapter for the current backend API format.
 * Transforms CurrentApiMultilan[] to the internal TranslationMap and MetadataMap formats.
 */
export class CurrentApiAdapter implements TranslationDataPort {
  private translationMap: TranslationMap;
  private metadataMap: MetadataMap;
  private readonly sourceIdentifier = "current-api";

  constructor(data: unknown) {
    if (!isCurrentApiFormat(data)) {
      throw new Error(
        "Invalid data format: expected CurrentApiMultilan[] array"
      );
    }
    this.translationMap = this.buildTranslationMap(data);
    this.metadataMap = this.buildMetadataMap(data);
  }

  /**
   * Build a translation map from API format
   */
  private buildTranslationMap(data: CurrentApiMultilan[]): TranslationMap {
    const map: TranslationMap = {};

    for (const item of data) {
      const multilanId = String(item.id);
      map[multilanId] = {};

      for (const text of item.multilanTextList) {
        map[multilanId][text.languageId] = text.wording;
      }
    }

    return map;
  }

  /**
   * Build a metadata map from API format
   */
  private buildMetadataMap(data: CurrentApiMultilan[]): MetadataMap {
    const map: MetadataMap = {};

    for (const item of data) {
      const multilanId = String(item.id);
      // Get source language from first text entry (they all have the same source)
      const sourceLanguageId = item.multilanTextList[0]?.sourceLanguageId;

      map[multilanId] = {
        status: item.status,
        createdAt: item.createdAt,
        modifiedAt: item.modifiedAt,
        modifiedBy: item.modifiedBy,
        sourceLanguageId,
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
