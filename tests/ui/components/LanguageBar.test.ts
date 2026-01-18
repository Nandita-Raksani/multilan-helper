import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupUIFixture, mockParentPostMessage } from "../setup";
import { store } from "../../../src/ui/state/store";
import { initLanguageBar, setActiveLanguage } from "../../../src/ui/components/LanguageBar";

describe("LanguageBar", () => {
  let postMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupUIFixture();
    postMessageMock = mockParentPostMessage();
    // Reset store
    store.setState({
      canEdit: true,
      currentLang: "en",
      scope: "page",
      textNodes: [],
      selectedNode: null,
      placeholders: { username: "John", count: "5" },
      bulkLinkResults: null,
      globalSearchResults: [],
      allTranslations: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initLanguageBar", () => {
    it("should set up language button click handlers", () => {
      initLanguageBar();

      const frBtn = document.querySelector('[data-lang="fr"]') as HTMLButtonElement;
      frBtn.click();

      expect(store.getState().currentLang).toBe("fr");
    });

    it("should send switch-language message when button clicked", () => {
      initLanguageBar();

      const frBtn = document.querySelector('[data-lang="fr"]') as HTMLButtonElement;
      frBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "switch-language",
            language: "fr",
          }),
        }),
        "*"
      );
    });

    it("should update active class on clicked button", () => {
      initLanguageBar();

      const enBtn = document.querySelector('[data-lang="en"]') as HTMLButtonElement;
      const frBtn = document.querySelector('[data-lang="fr"]') as HTMLButtonElement;

      frBtn.click();

      expect(frBtn.classList.contains("active")).toBe(true);
      expect(enBtn.classList.contains("active")).toBe(false);
    });

    it("should only update UI in view mode (canEdit=false)", () => {
      store.setState({ canEdit: false });
      initLanguageBar();

      const frBtn = document.querySelector('[data-lang="fr"]') as HTMLButtonElement;
      frBtn.click();

      // Should update state and UI
      expect(store.getState().currentLang).toBe("fr");
      expect(frBtn.classList.contains("active")).toBe(true);

      // Should NOT send message to plugin
      expect(postMessageMock).not.toHaveBeenCalled();
    });
  });

  describe("setActiveLanguage", () => {
    it("should set active class on correct button", () => {
      setActiveLanguage("de");

      const deBtn = document.querySelector('[data-lang="de"]');
      const enBtn = document.querySelector('[data-lang="en"]');

      expect(deBtn?.classList.contains("active")).toBe(true);
      expect(enBtn?.classList.contains("active")).toBe(false);
    });

    it("should work for all supported languages", () => {
      const languages = ["en", "fr", "nl", "de"] as const;

      for (const lang of languages) {
        setActiveLanguage(lang);
        const btn = document.querySelector(`[data-lang="${lang}"]`);
        expect(btn?.classList.contains("active")).toBe(true);
      }
    });
  });
});
