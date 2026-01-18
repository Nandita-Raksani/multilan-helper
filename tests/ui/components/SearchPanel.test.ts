import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupUIFixture, mockParentPostMessage, sampleSearchResults, sampleTextNodes } from "../setup";
import { store } from "../../../src/ui/state/store";
import {
  initSearchPanel,
  updateSearchSelectedNode,
  renderGlobalSearchResults,
  setSearchQuery,
  clearSearch,
  triggerSearch,
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
      placeholders: { username: "John", count: "5" },
      bulkLinkResults: null,
      globalSearchResults: [],
      allTranslations: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("updateSearchSelectedNode", () => {
    it("should show selected node banner when node is selected", () => {
      store.setState({ selectedNode: sampleTextNodes[0] });
      updateSearchSelectedNode();

      const banner = document.getElementById("searchSelectedNode");
      expect(banner?.style.display).toBe("block");
    });

    it("should hide selected node banner when no selection", () => {
      store.setState({ selectedNode: null });
      updateSearchSelectedNode();

      const banner = document.getElementById("searchSelectedNode");
      expect(banner?.style.display).toBe("none");
    });

    it("should show selected text content", () => {
      store.setState({ selectedNode: sampleTextNodes[0] });
      updateSearchSelectedNode();

      const text = document.getElementById("searchSelectedText");
      expect(text?.textContent).toContain("Submit");
    });

    it("should show linked badge for linked node", () => {
      store.setState({ selectedNode: sampleTextNodes[0] });
      updateSearchSelectedNode();

      const badge = document.getElementById("searchSelectedBadge");
      expect(badge?.textContent).toBe("10001");
      expect(badge?.style.background).toBe("rgb(16, 185, 129)"); // #10b981
      expect(badge?.style.cursor).toBe("pointer");
    });

    it("should show 'Not linked' badge for unlinked node", () => {
      store.setState({ selectedNode: sampleTextNodes[1] });
      updateSearchSelectedNode();

      const badge = document.getElementById("searchSelectedBadge");
      expect(badge?.textContent).toBe("Not linked");
      expect(badge?.style.background).toBe("rgb(245, 158, 11)"); // #f59e0b
    });

    it("should show unlink button for linked node", () => {
      store.setState({ selectedNode: sampleTextNodes[0] });
      updateSearchSelectedNode();

      const actions = document.getElementById("searchSelectedActions");
      expect(actions?.querySelector("#searchUnlinkBtn")).not.toBeNull();
    });

    it("should show make placeholder button for linked node", () => {
      store.setState({ selectedNode: sampleTextNodes[0] });
      updateSearchSelectedNode();

      const actions = document.getElementById("searchSelectedActions");
      expect(actions?.querySelector("#searchMakePlaceholderBtn")).not.toBeNull();
    });

    it("should handle unlink button click", () => {
      store.setState({ selectedNode: sampleTextNodes[0] });
      initSearchPanel();
      updateSearchSelectedNode();

      const unlinkBtn = document.getElementById("searchUnlinkBtn") as HTMLButtonElement;
      unlinkBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "unlink-node",
            nodeId: "node-1",
          }),
        }),
        "*"
      );
    });
  });

  describe("renderGlobalSearchResults", () => {
    it("should show empty state when no results and no query", () => {
      store.setState({ globalSearchResults: [] });
      renderGlobalSearchResults();

      const results = document.getElementById("globalSearchResults");
      expect(results?.textContent).toContain("Start typing to search");
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

    it("should show 'Currently linked' for matching linked node", () => {
      store.setState({
        globalSearchResults: sampleSearchResults,
        selectedNode: sampleTextNodes[0], // linked to 10001
      });
      renderGlobalSearchResults();

      const firstCard = document.querySelector('[data-multilan-id="10001"]');
      expect(firstCard?.textContent).toContain("Currently linked");
    });

    it("should show Create button on all results", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      renderGlobalSearchResults();

      const createBtns = document.querySelectorAll(".btn-create-result");
      expect(createBtns.length).toBe(2);
    });

    it("should handle clickable ID click to copy", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      initSearchPanel();
      renderGlobalSearchResults();

      document.execCommand = vi.fn().mockReturnValue(true);

      const clickableId = document.querySelector(".clickable-id") as HTMLSpanElement;
      clickableId.click();

      expect(clickableId.textContent).toBe("Copied!");
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

    it("should handle Create button click", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      initSearchPanel();
      renderGlobalSearchResults();

      const createBtn = document.querySelector(".btn-create-result") as HTMLButtonElement;
      createBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "create-linked-text",
            multilanId: "10001",
          }),
        }),
        "*"
      );
    });

    it("should show placeholder section when no results and has selection", () => {
      store.setState({
        globalSearchResults: [],
        selectedNode: sampleTextNodes[1],
      });
      const input = document.getElementById("globalSearchInput") as HTMLInputElement;
      input.value = "nonexistent";
      renderGlobalSearchResults();

      const placeholderSection = document.getElementById("searchPlaceholderSection");
      expect(placeholderSection?.style.display).toBe("block");
    });

    it("should hide placeholder section when results exist", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      renderGlobalSearchResults();

      const placeholderSection = document.getElementById("searchPlaceholderSection");
      expect(placeholderSection?.style.display).toBe("none");
    });
  });

  describe("setSearchQuery", () => {
    it("should set search input value", () => {
      setSearchQuery("test query");

      const input = document.getElementById("globalSearchInput") as HTMLInputElement;
      expect(input.value).toBe("test query");
    });
  });

  describe("clearSearch", () => {
    it("should clear search input and results", () => {
      store.setState({ globalSearchResults: sampleSearchResults });
      setSearchQuery("test");
      clearSearch();

      const input = document.getElementById("globalSearchInput") as HTMLInputElement;
      expect(input.value).toBe("");
      expect(store.getState().globalSearchResults).toEqual([]);
    });
  });

  describe("triggerSearch", () => {
    it("should set query and trigger search", () => {
      triggerSearch("Submit");

      const input = document.getElementById("globalSearchInput") as HTMLInputElement;
      expect(input.value).toBe("Submit");
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "global-search",
            searchQuery: "Submit",
          }),
        }),
        "*"
      );
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

    it("should handle mark as placeholder button", () => {
      store.setState({ selectedNode: sampleTextNodes[1] });
      initSearchPanel();

      const placeholderInput = document.getElementById("searchPlaceholderText") as HTMLInputElement;
      placeholderInput.value = "My placeholder";

      const markBtn = document.getElementById("searchMarkPlaceholderBtn") as HTMLButtonElement;
      markBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "mark-as-placeholder",
            text: "My placeholder",
          }),
        }),
        "*"
      );
    });

    it("should alert when no placeholder text entered", () => {
      store.setState({ selectedNode: sampleTextNodes[1] });
      initSearchPanel();

      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      const markBtn = document.getElementById("searchMarkPlaceholderBtn") as HTMLButtonElement;
      markBtn.click();

      expect(alertMock).toHaveBeenCalledWith("Please enter placeholder text");
    });

    it("should alert when no node selected for placeholder", () => {
      store.setState({ selectedNode: null });
      initSearchPanel();

      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      const placeholderInput = document.getElementById("searchPlaceholderText") as HTMLInputElement;
      placeholderInput.value = "My placeholder";

      const markBtn = document.getElementById("searchMarkPlaceholderBtn") as HTMLButtonElement;
      markBtn.click();

      expect(alertMock).toHaveBeenCalledWith("Please select a text layer in Figma first");
    });
  });
});
