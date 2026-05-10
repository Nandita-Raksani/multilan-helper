import { describe, it, expect, beforeEach } from "vitest";
import { setupFigmaMock } from "../../setup";
import {
  getTextToIdMap,
  exactMatchLookup,
  detectMatchAsync,
  invalidateTextToIdMapCache,
} from "../../../src/plugin/services/translationService";
import type { TranslationMap } from "../../../src/shared/types";

describe("exact-match handling with duplicate text", () => {
  beforeEach(() => {
    setupFigmaMock();
    invalidateTextToIdMapCache();
  });

  describe("buildTextToIdMap (via getTextToIdMap)", () => {
    it("collects every multilanId that maps to the same text", async () => {
      const data: TranslationMap = {
        "M-1": { en: "Submit", fr: "Soumettre" },
        "M-2": { en: "Submit", fr: "Envoyer" },
        "M-3": { en: "Submit", fr: "Valider" },
      };

      const map = await getTextToIdMap(data);
      const ids = map.get("submit");

      expect(ids).toEqual(["M-1", "M-2", "M-3"]);
    });

    it("does not duplicate the same multilanId when it has the same text in multiple languages", async () => {
      const data: TranslationMap = {
        "M-1": { en: "Cancel", fr: "Cancel", nl: "Cancel" },
      };

      const map = await getTextToIdMap(data);
      const ids = map.get("cancel");

      expect(ids).toEqual(["M-1"]); // single entry, single ID
    });

    it("normalizes case so casing differences across entries collapse to one bucket", async () => {
      const data: TranslationMap = {
        "M-1": { en: "Submit" },
        "M-2": { en: "SUBMIT" },
        "M-3": { en: "submit" },
      };

      const map = await getTextToIdMap(data);
      expect(map.get("submit")).toEqual(["M-1", "M-2", "M-3"]);
    });

    it("keeps unique-text entries as singletons", async () => {
      const data: TranslationMap = {
        "M-1": { en: "Hello" },
        "M-2": { en: "World" },
      };

      const map = await getTextToIdMap(data);
      expect(map.get("hello")).toEqual(["M-1"]);
      expect(map.get("world")).toEqual(["M-2"]);
    });
  });

  describe("exactMatchLookup", () => {
    it("returns all matching multilanIds (not just the first)", async () => {
      const data: TranslationMap = {
        "M-1": { en: "OK" },
        "M-2": { en: "OK" },
      };

      const ids = await exactMatchLookup(data, "OK");
      expect(ids).toEqual(["M-1", "M-2"]);
    });

    it("returns an empty array when text is empty", async () => {
      const data: TranslationMap = { "M-1": { en: "Hi" } };
      expect(await exactMatchLookup(data, "")).toEqual([]);
      expect(await exactMatchLookup(data, "   ")).toEqual([]);
    });

    it("returns an empty array when text does not exist in the data", async () => {
      const data: TranslationMap = { "M-1": { en: "Hi" } };
      expect(await exactMatchLookup(data, "Goodbye")).toEqual([]);
    });
  });

  describe("detectMatchAsync", () => {
    it("populates exactMatches with every duplicate, primary fields point at the first", async () => {
      const data: TranslationMap = {
        "M-1": { en: "Submit", fr: "Soumettre" },
        "M-2": { en: "Submit", fr: "Envoyer" },
      };

      const result = await detectMatchAsync(data, "Submit");

      expect(result.status).toBe("exact");
      expect(result.exactMatches).toHaveLength(2);
      expect(result.exactMatches?.map(m => m.multilanId)).toEqual(["M-1", "M-2"]);
      // primary (back-compat) fields point at the first match
      expect(result.multilanId).toBe("M-1");
      expect(result.translations).toEqual(data["M-1"]);
    });

    it("includes per-match translations and metadata", async () => {
      const data: TranslationMap = {
        "M-1": { en: "Submit", fr: "Soumettre" },
        "M-2": { en: "Submit", fr: "Envoyer" },
      };
      const meta = {
        "M-1": { status: "FINAL" as const, modifiedBy: "alice" },
        "M-2": { status: "DRAFT" as const, modifiedBy: "bob" },
      };

      const result = await detectMatchAsync(data, "Submit", meta);

      expect(result.exactMatches?.[0].translations).toEqual(data["M-1"]);
      expect(result.exactMatches?.[0].metadata).toEqual(meta["M-1"]);
      expect(result.exactMatches?.[1].translations).toEqual(data["M-2"]);
      expect(result.exactMatches?.[1].metadata).toEqual(meta["M-2"]);
    });

    it("returns a single-element exactMatches when only one ID matches", async () => {
      const data: TranslationMap = {
        "M-1": { en: "Submit" },
        "M-2": { en: "Cancel" },
      };

      const result = await detectMatchAsync(data, "Submit");

      expect(result.exactMatches).toHaveLength(1);
      expect(result.exactMatches?.[0].multilanId).toBe("M-1");
    });

    it("does not set exactMatches when no exact match exists", async () => {
      const data: TranslationMap = { "M-1": { en: "Submit" } };
      const result = await detectMatchAsync(data, "Totally unrelated");
      // Falls through to fuzzy or none — either way exactMatches must be absent.
      expect(result.exactMatches).toBeUndefined();
    });

    it("matches case-insensitively across duplicates", async () => {
      const data: TranslationMap = {
        "M-1": { en: "OK" },
        "M-2": { en: "ok" },
        "M-3": { en: "Ok" },
      };

      const result = await detectMatchAsync(data, "oK");
      expect(result.status).toBe("exact");
      expect(result.exactMatches?.map(m => m.multilanId).sort()).toEqual(["M-1", "M-2", "M-3"]);
    });
  });
});
