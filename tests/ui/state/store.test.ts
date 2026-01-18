import { describe, it, expect, vi, beforeEach } from "vitest";
import { store, UIState } from "../../../src/ui/state/store";

describe("store", () => {
  beforeEach(() => {
    // Reset store to default state
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

  describe("getState", () => {
    it("should return current state", () => {
      const state = store.getState();

      expect(state).toBeDefined();
      expect(state.canEdit).toBe(true);
      expect(state.currentLang).toBe("en");
    });
  });

  describe("setState", () => {
    it("should update state with partial values", () => {
      store.setState({ currentLang: "fr" });

      const state = store.getState();
      expect(state.currentLang).toBe("fr");
      expect(state.canEdit).toBe(true); // unchanged
    });

    it("should update multiple values at once", () => {
      store.setState({
        currentLang: "de",
        scope: "selection",
        canEdit: false,
      });

      const state = store.getState();
      expect(state.currentLang).toBe("de");
      expect(state.scope).toBe("selection");
      expect(state.canEdit).toBe(false);
    });

    it("should update textNodes array", () => {
      const textNodes = [
        {
          id: "node-1",
          name: "Test",
          characters: "Hello",
          multilanId: "10001",
          translations: { en: "Hello" },
          hasOverflow: false,
          isPlaceholder: false,
        },
      ];

      store.setState({ textNodes });

      expect(store.getState().textNodes).toEqual(textNodes);
    });

    it("should update selectedNode", () => {
      const selectedNode = {
        id: "node-1",
        name: "Test",
        characters: "Hello",
        multilanId: "10001",
        translations: { en: "Hello" },
        hasOverflow: false,
        isPlaceholder: false,
      };

      store.setState({ selectedNode });

      expect(store.getState().selectedNode).toEqual(selectedNode);
    });

    it("should update globalSearchResults", () => {
      const results = [
        { multilanId: "10001", translations: { en: "Submit" } },
        { multilanId: "10002", translations: { en: "Cancel" } },
      ];

      store.setState({ globalSearchResults: results });

      expect(store.getState().globalSearchResults).toEqual(results);
    });

    it("should update bulkLinkResults", () => {
      const bulkLinkResults = {
        exactMatches: [{ nodeId: "1", nodeName: "Btn", text: "Submit", multilanId: "10001" }],
        fuzzyMatches: [],
        unmatched: [],
      };

      store.setState({ bulkLinkResults });

      expect(store.getState().bulkLinkResults).toEqual(bulkLinkResults);
    });
  });

  describe("subscribe", () => {
    it("should notify listeners on state change", () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.setState({ currentLang: "nl" });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ currentLang: "nl" })
      );
    });

    it("should allow multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);

      store.setState({ canEdit: false });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.setState({ currentLang: "fr" });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.setState({ currentLang: "de" });
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });
  });

  describe("placeholders", () => {
    it("should update placeholders", () => {
      store.setState({
        placeholders: { username: "Alice", count: "10" },
      });

      expect(store.getState().placeholders).toEqual({
        username: "Alice",
        count: "10",
      });
    });
  });
});
