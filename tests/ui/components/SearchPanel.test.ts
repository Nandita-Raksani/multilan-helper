import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupUIFixture, mockParentPostMessage, sampleSearchResults, sampleTextNodes } from "../setup";
import { store } from "../../../src/ui/state/store";
import {
  initSearchPanel,
  renderGlobalSearchResults,
  clearSearch,
} from "../../../src/ui/components/SearchPanel";

describe("SearchPanel", () => {
  let postMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupUIFixture();
    postMessageMock = mockParentPostMessage();
    store.setState({
      canEdit: true,
      currentLang: "en",
      scope: "page",
      textNodes: [],
      selectedNode: null,
      matchResult: null,
      hasSelection: false,
      placeholders: { username: "John", count: "5" },
      bulkLinkResults: null,
      globalSearchResults: [],
      allTranslations: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("renderGlobalSearchResults", () => {
    it("should render nothing when no results and no query", () => {
      store.setState({ globalSearchResults: [] });
      renderGlobalSearchResults();

      const results = document.getElementById("globalSearchResults");
      expect(results?.querySelectorAll(".search-result-card").length).toBe(0);
      expect(results?.textContent?.trim()).toBe("");
    });

    it("should show 'no translations found' when query but no results", () => {
      store.setState({ globalSearchResults: [] });
      const input = document.getElementById("globalSearchInput") as HTMLInputElement;
      input.value = "nonexistent";
      renderGlobalSearchResults();

      const results = document.getElementById("globalSearchResults");
      expect(results?.textContent).toContain("No translations found");
    });

    it("should render search results", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      renderGlobalSearchResults();

      const results = document.getElementById("globalSearchResults");
      const cards = results?.querySelectorAll(".search-result-card");

      expect(cards?.length).toBe(2);
    });

    it("should show result count", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      renderGlobalSearchResults();

      const count = document.getElementById("globalSearchResultsCount");
      expect(count?.textContent).toContain("2 results found");
    });

    it("should show multilanId in result header", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      renderGlobalSearchResults();

      const header = document.querySelector(".search-result-id");
      expect(header?.textContent).toBe("10001");
    });

    it("should show all translations", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      renderGlobalSearchResults();

      const translations = document.querySelectorAll(".translation-row");
      expect(translations.length).toBeGreaterThanOrEqual(4); // en, fr, nl, de for first result
    });

    it("should show Link button when unlinked node is selected", () => {
      store.setState({
        globalSearchResults: sampleSearchResults,
        selectedNode: sampleTextNodes[1], // unlinked node
      });
      renderGlobalSearchResults();

      const linkBtn = document.querySelector(".btn-link-result");
      expect(linkBtn).not.toBeNull();
    });

    it("should hide Link button when no selection", () => {
      store.setState({
        globalSearchResults: sampleSearchResults,
        selectedNode: null,
      });
      renderGlobalSearchResults();

      const linkBtn = document.querySelector(".btn-link-result");
      expect(linkBtn).toBeNull();
    });

    it("should show Unlink action on the currently linked result card", () => {
      store.setState({
        globalSearchResults: sampleSearchResults,
        selectedNode: sampleTextNodes[0], // linked to 10001
      });
      renderGlobalSearchResults();

      const linkedCard = document.querySelector('[data-multilan-id="10001"]');
      expect(linkedCard?.querySelector(".btn-unlink-result")).not.toBeNull();
    });

    it("should handle copy button click", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      initSearchPanel();
      renderGlobalSearchResults();

      document.execCommand = vi.fn().mockReturnValue(true);

      const copyBtn = document.querySelector(".copy-btn") as HTMLButtonElement;
      copyBtn.click();

      expect(copyBtn.classList.contains("copied")).toBe(true);
    });

    it("should handle Link button click", () => {
      store.setState({
        globalSearchResults: sampleSearchResults,
        selectedNode: sampleTextNodes[1],
      });
      initSearchPanel();
      renderGlobalSearchResults();

      const linkBtn = document.querySelector(".btn-link-result") as HTMLButtonElement;
      linkBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "link-node",
            nodeId: "node-2",
            multilanId: "10001",
          }),
        }),
        "*"
      );
    });
  });

  describe("clearSearch", () => {
    it("should clear search input and results", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      const input = document.getElementById("globalSearchInput") as HTMLInputElement;
      input.value = "test";
      clearSearch();

      expect(input.value).toBe("");
      expect(store.getState().globalSearchResults).toEqual([]);
    });
  });

  describe("initSearchPanel", () => {
    it("should trigger search on input with debounce", async () => {
      vi.useFakeTimers();
      initSearchPanel();

      const input = document.getElementById("globalSearchInput") as HTMLInputElement;
      input.value = "test";
      input.dispatchEvent(new Event("input"));

      expect(postMessageMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "global-search",
            searchQuery: "test",
          }),
        }),
        "*"
      );
      vi.useRealTimers();
    });
  });
});
