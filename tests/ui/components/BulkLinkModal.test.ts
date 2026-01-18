import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupUIFixture, mockParentPostMessage, sampleBulkLinkResults } from "../setup";
import { store } from "../../../src/ui/state/store";
import {
  initBulkLinkModal,
  showModal,
  closeModal,
  renderBulkLinkResults,
} from "../../../src/ui/components/BulkLinkModal";

describe("BulkLinkModal", () => {
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

  describe("showModal", () => {
    it("should add active class to modal overlay", () => {
      showModal();

      const modal = document.getElementById("bulkLinkModal");
      expect(modal?.classList.contains("active")).toBe(true);
    });
  });

  describe("closeModal", () => {
    it("should remove active class from modal overlay", () => {
      showModal();
      closeModal();

      const modal = document.getElementById("bulkLinkModal");
      expect(modal?.classList.contains("active")).toBe(false);
    });
  });

  describe("initBulkLinkModal", () => {
    it("should set up close button handler", () => {
      initBulkLinkModal();
      showModal();

      const closeBtn = document.getElementById("closeBulkModal") as HTMLButtonElement;
      closeBtn.click();

      const modal = document.getElementById("bulkLinkModal");
      expect(modal?.classList.contains("active")).toBe(false);
    });

    it("should refresh on close", () => {
      initBulkLinkModal();
      showModal();

      const closeBtn = document.getElementById("closeBulkModal") as HTMLButtonElement;
      closeBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({ type: "refresh" }),
        }),
        "*"
      );
    });

    it("should set up apply exact matches handler", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      initBulkLinkModal();
      renderBulkLinkResults();

      const applyBtn = document.getElementById("applyExactMatches") as HTMLButtonElement;
      applyBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "apply-exact-matches",
            confirmations: [{ nodeId: "node-1", multilanId: "10001" }],
          }),
        }),
        "*"
      );
    });
  });

  describe("renderBulkLinkResults", () => {
    it("should render summary stats", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      renderBulkLinkResults();

      const summary = document.getElementById("bulkLinkSummary");
      expect(summary?.textContent).toContain("1 exact");
      expect(summary?.textContent).toContain("1 fuzzy");
      expect(summary?.textContent).toContain("1 unmatched");
    });

    it("should show apply button when there are exact matches", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      renderBulkLinkResults();

      const applyBtn = document.getElementById("applyExactMatches");
      expect(applyBtn?.style.display).toBe("block");
    });

    it("should hide apply button when no exact matches", () => {
      store.setState({
        bulkLinkResults: {
          exactMatches: [],
          fuzzyMatches: [],
          unmatched: [{ nodeId: "1", nodeName: "Test", text: "xyz" }],
        },
      });
      renderBulkLinkResults();

      const applyBtn = document.getElementById("applyExactMatches");
      expect(applyBtn?.style.display).toBe("none");
    });

    it("should render exact matches", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      renderBulkLinkResults();

      const content = document.getElementById("bulkLinkContent");
      expect(content?.textContent).toContain("Submit");
      expect(content?.textContent).toContain("10001");
    });

    it("should render fuzzy matches with suggestions", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      renderBulkLinkResults();

      const content = document.getElementById("bulkLinkContent");
      expect(content?.textContent).toContain("Submit Now");
      expect(content?.querySelector(".btn-accept")).not.toBeNull();
    });

    it("should render unmatched items", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      renderBulkLinkResults();

      const content = document.getElementById("bulkLinkContent");
      expect(content?.textContent).toContain("xyz123");
    });

    it("should show empty state when no results", () => {
      store.setState({
        bulkLinkResults: {
          exactMatches: [],
          fuzzyMatches: [],
          unmatched: [],
        },
      });
      renderBulkLinkResults();

      const content = document.getElementById("bulkLinkContent");
      expect(content?.textContent).toContain("No unlinked text nodes found");
    });

    it("should handle fuzzy match accept button", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      initBulkLinkModal();
      renderBulkLinkResults();

      const acceptBtn = document.querySelector(".btn-accept") as HTMLButtonElement;
      acceptBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "confirm-fuzzy-link",
            nodeId: "node-2",
            multilanId: "10001",
          }),
        }),
        "*"
      );
    });

    it("should handle fuzzy match skip button", () => {
      store.setState({ bulkLinkResults: sampleBulkLinkResults });
      initBulkLinkModal();
      renderBulkLinkResults();

      const skipBtn = document.querySelector(".btn-skip") as HTMLButtonElement;
      const suggestionElement = skipBtn.closest(".fuzzy-suggestion");

      skipBtn.click();

      expect(suggestionElement?.parentElement).toBeNull(); // removed from DOM
    });
  });
});
