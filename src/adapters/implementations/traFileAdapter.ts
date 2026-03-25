// .tra File Adapter
// Transforms .tra file format to internal plugin format

import { TranslationDataPort } from "../../ports/translationPort";
import { TranslationMap, MetadataMap } from "../../shared/types";
import { TraFileData, parseTraFileAsync, isTraFileData } from "../types/traFile.types";

/**
 * Adapter for .tra file format.
 * Takes the content of all 4 language files and builds TranslationMap.
 * Use TraFileAdapter.createAsync() for non-blocking parsing of large files.
 */
export class TraFileAdapter implements TranslationDataPort {
  private translationMap: TranslationMap;
  private metadataMap: MetadataMap;
  private readonly sourceIdentifier = "tra-files";

  private constructor(translationMap: TranslationMap) {
    this.translationMap = translationMap;
    this.metadataMap = {}; // .tra files don't contain metadata
  }

  /**
   * Async factory — parses .tra files in chunks to avoid blocking the main thread.
   */
  static async createAsync(data: unknown): Promise<TraFileAdapter> {
    if (!isTraFileData(data)) {
      throw new Error(
        "Invalid data format: expected object with en, fr, nl, de string properties"
      );
    }
    const translationMap = await TraFileAdapter.buildTranslationMapAsync(data);
    return new TraFileAdapter(translationMap);
  }

  /**
   * Build a translation map from .tra file contents (async, chunked).
   */
  private static async buildTranslationMapAsync(data: TraFileData): Promise<TranslationMap> {
    const map: TranslationMap = {};

    // Parse all 4 language files in parallel (each yields internally)
    const [enMap, frMap, nlMap, deMap] = await Promise.all([
      parseTraFileAsync(data.en),
      parseTraFileAsync(data.fr),
      parseTraFileAsync(data.nl),
      parseTraFileAsync(data.de),
    ]);

    // Collect all unique multilanIds
    const allIds = new Set<string>();
    [enMap, frMap, nlMap, deMap].forEach(langMap => {
      langMap.forEach((_, id) => allIds.add(id));
    });

    // Build the translation map with chunked yielding
    let count = 0;
    for (const id of allIds) {
      map[id] = {};

      const enText = enMap.get(id);
      const frText = frMap.get(id);
      const nlText = nlMap.get(id);
      const deText = deMap.get(id);

      if (enText !== undefined) map[id]['en'] = enText;
      if (frText !== undefined) map[id]['fr'] = frText;
      if (nlText !== undefined) map[id]['nl'] = nlText;
      if (deText !== undefined) map[id]['de'] = deText;

      count++;
      if (count % 2000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
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
