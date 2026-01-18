import { describe, it, expect, beforeEach } from "vitest";
import { setupUIFixture } from "../setup";
import { store } from "../../../src/ui/state/store";
import { initSettingsPanel } from "../../../src/ui/components/SettingsPanel";

describe("SettingsPanel", () => {
  beforeEach(() => {
    setupUIFixture();
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

  describe("initSettingsPanel", () => {
    it("should update username placeholder in store", () => {
      initSettingsPanel();

      const usernameInput = document.querySelector('[data-placeholder="username"]') as HTMLInputElement;
      usernameInput.value = "Alice";
      usernameInput.dispatchEvent(new Event("input"));

      expect(store.getState().placeholders.username).toBe("Alice");
    });

    it("should update count placeholder in store", () => {
      initSettingsPanel();

      const countInput = document.querySelector('[data-placeholder="count"]') as HTMLInputElement;
      countInput.value = "42";
      countInput.dispatchEvent(new Event("input"));

      expect(store.getState().placeholders.count).toBe("42");
    });

    it("should preserve other placeholders when updating one", () => {
      initSettingsPanel();

      const usernameInput = document.querySelector('[data-placeholder="username"]') as HTMLInputElement;
      usernameInput.value = "Bob";
      usernameInput.dispatchEvent(new Event("input"));

      const state = store.getState();
      expect(state.placeholders.username).toBe("Bob");
      expect(state.placeholders.count).toBe("5"); // unchanged
    });
  });
});
