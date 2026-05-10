import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockTextNode, setupFigmaMock } from "../../setup";
import { rewriteInterpolatedNodesToTemplate } from "../../../src/plugin/services/linkingService";
import { setMultilanId, setExpectedText } from "../../../src/plugin/services/nodeService";
import { EXPECTED_TEXT_KEY, type TranslationEntry } from "../../../src/shared/types";

function makeNode(text: string, multilanId: string | null) {
  const node = createMockTextNode({ characters: text });
  if (multilanId) setMultilanId(node, multilanId);
  return node;
}

describe("rewriteInterpolatedNodesToTemplate", () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  it("rewrites an interpolated node to its raw template", async () => {
    const translations: TranslationEntry = {
      en: "Hello, ###username###!",
      fr: "Bonjour, ###username###!",
    };
    const node = makeNode("Hello, John!", "M-1");
    setExpectedText(node, "Hello, John!");

    const count = await rewriteInterpolatedNodesToTemplate(
      [node],
      () => translations,
    );

    expect(count).toBe(1);
    expect(node.characters).toBe("Hello, ###username###!");
  });

  it("uses the language whose template matches the node text", async () => {
    const translations: TranslationEntry = {
      en: "Hello, ###name###!",
      fr: "Bonjour, ###name###!",
    };
    const node = makeNode("Bonjour, Marie!", "M-1");

    await rewriteInterpolatedNodesToTemplate([node], () => translations);

    expect(node.characters).toBe("Bonjour, ###name###!");
  });

  it("leaves a node alone if it is already in raw template form (idempotent)", async () => {
    const translations: TranslationEntry = {
      en: "Hello, ###user###!",
    };
    const node = makeNode("Hello, ###user###!", "M-1");

    const count = await rewriteInterpolatedNodesToTemplate(
      [node],
      () => translations,
    );

    // Already in template form → not counted as rewritten
    expect(count).toBe(0);
    expect(node.characters).toBe("Hello, ###user###!");
  });

  it("does not touch nodes whose multilanId is not templated", async () => {
    const translations: TranslationEntry = {
      en: "Submit",
      fr: "Soumettre",
      nl: "Indienen",
      de: "Einreichen",
    };
    const node = makeNode("Submit", "M-1");

    const count = await rewriteInterpolatedNodesToTemplate(
      [node],
      () => translations,
    );

    expect(count).toBe(0);
    expect(node.characters).toBe("Submit");
  });

  it("skips nodes that have no multilanId", async () => {
    const node = makeNode("Hello, John!", null);
    const getTranslations = vi.fn();

    const count = await rewriteInterpolatedNodesToTemplate(
      [node],
      getTranslations,
    );

    expect(count).toBe(0);
    expect(getTranslations).not.toHaveBeenCalled();
  });

  it("skips nodes whose multilanId has no entry in translation data", async () => {
    const node = makeNode("Hello, John!", "M-MISSING");

    const count = await rewriteInterpolatedNodesToTemplate(
      [node],
      () => null,
    );

    expect(count).toBe(0);
    expect(node.characters).toBe("Hello, John!");
  });

  it("leaves text alone when current text matches no template (genuine drift)", async () => {
    const translations: TranslationEntry = {
      en: "Hello, ###name###!",
    };
    // Designer hand-edited the text to something neither raw nor a valid interpolation
    const node = makeNode("Totally unrelated copy", "M-1");

    const count = await rewriteInterpolatedNodesToTemplate(
      [node],
      () => translations,
    );

    expect(count).toBe(0);
    expect(node.characters).toBe("Totally unrelated copy");
  });

  it("updates expectedText to the raw template after rewrite", async () => {
    const translations: TranslationEntry = {
      en: "Page ###n### of ###total###",
    };
    const node = makeNode("Page 3 of 10", "M-1");
    setExpectedText(node, "Page 3 of 10");

    await rewriteInterpolatedNodesToTemplate([node], () => translations);

    const stored = node.getPluginData(EXPECTED_TEXT_KEY);
    expect(stored).toBe("Page ###n### of ###total###");
  });

  it("processes multiple nodes independently and returns the rewrite count", async () => {
    const translations: Record<string, TranslationEntry> = {
      "M-1": { en: "Hello, ###name###!" },
      "M-2": { en: "Submit" },
      "M-3": { en: "###count### items" },
    };
    const interpolated = makeNode("Hello, John!", "M-1");
    const literal = makeNode("Submit", "M-2");
    const alreadyTemplate = makeNode("###count### items", "M-3");

    const count = await rewriteInterpolatedNodesToTemplate(
      [interpolated, literal, alreadyTemplate],
      (id) => translations[id] || null,
    );

    expect(count).toBe(1); // only the interpolated node was actually rewritten
    expect(interpolated.characters).toBe("Hello, ###name###!");
    expect(literal.characters).toBe("Submit");
    expect(alreadyTemplate.characters).toBe("###count### items");
  });

  it("ignores empty-string templates and matches against the next language", async () => {
    const translations: TranslationEntry = {
      en: "",
      fr: "Bonjour, ###name###!",
    };
    const node = makeNode("Bonjour, Sophie!", "M-1");

    const count = await rewriteInterpolatedNodesToTemplate(
      [node],
      () => translations,
    );

    expect(count).toBe(1);
    expect(node.characters).toBe("Bonjour, ###name###!");
  });
});
