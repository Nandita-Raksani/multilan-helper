// .tra File Adapter
// Transforms .tra file format to internal plugin format

import { TranslationDataPort } from "../../ports/translationPort";
import { TranslationMap, MetadataMap } from "../../shared/types";
import { TraFileData, parseTraFile, isTraFileData } from "../types/traFile.types";

/**
 * Adapter for .tra file format.
 * Takes the content of all 4 language files and builds TranslationMap.
 */
export class TraFileAdapter implements TranslationDataPort {
  private translationMap: TranslationMap;
  private metadataMap: MetadataMap;
  private readonly sourceIdentifier = "tra-files";

  constructor(data: unknown) {
    if (!isTraFileData(data)) {
      throw new Error(
        "Invalid data format: expected object with en, fr, nl, de string properties"
      );
    }
    this.translationMap = this.buildTranslationMap(data);
    this.metadataMap = {}; // .tra files don't contain metadata
  }

  /**
   * Build a translation map from .tra file contents
   */
  private buildTranslationMap(data: TraFileData): TranslationMap {
    const map: TranslationMap = {};

    // Parse each language file
    const enMap = parseTraFile(data.en);
    const frMap = parseTraFile(data.fr);
    const nlMap = parseTraFile(data.nl);
    const deMap = parseTraFile(data.de);

    // Collect all unique multilanIds
    const allIds = new Set<string>();
    [enMap, frMap, nlMap, deMap].forEach(langMap => {
      langMap.forEach((_, id) => allIds.add(id));
    });

    // Build the translation map
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
