import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupUIFixture } from "../setup";
import { initTabs, setActiveTab, getCurrentTab, onTabChange } from "../../../src/ui/components/Tabs";

describe("Tabs", () => {
  beforeEach(() => {
    setupUIFixture();
  });

  describe("initTabs", () => {
    it("should set up tab click handlers", () => {
      initTabs();

      const textsTab = document.querySelector('[data-tab="texts"]') as HTMLElement;
      textsTab.click();

      expect(textsTab.classList.contains("active")).toBe(true);
      expect(document.getElementById("textsPanel")?.classList.contains("active")).toBe(true);
    });

    it("should deactivate other tabs when clicking", () => {
      initTabs();

      const searchTab = document.querySelector('[data-tab="search"]') as HTMLElement;
      const textsTab = document.querySelector('[data-tab="texts"]') as HTMLElement;

      textsTab.click();

      expect(searchTab.classList.contains("active")).toBe(false);
      expect(document.getElementById("searchPanel")?.classList.contains("active")).toBe(false);
    });

    it("should switch between all tabs", () => {
      initTabs();

      const settingsTab = document.querySelector('[data-tab="settings"]') as HTMLElement;
      settingsTab.click();

      expect(settingsTab.classList.contains("active")).toBe(true);
      expect(document.getElementById("settingsPanel")?.classList.contains("active")).toBe(true);
    });
  });

  describe("setActiveTab", () => {
    it("should programmatically set active tab", () => {
      setActiveTab("texts");

      const textsTab = document.querySelector('[data-tab="texts"]');
      const textsPanel = document.getElementById("textsPanel");

      expect(textsTab?.classList.contains("active")).toBe(true);
      expect(textsPanel?.classList.contains("active")).toBe(true);
    });

    it("should deactivate other tabs", () => {
      setActiveTab("settings");

      const searchTab = document.querySelector('[data-tab="search"]');
      const searchPanel = document.getElementById("searchPanel");

      expect(searchTab?.classList.contains("active")).toBe(false);
      expect(searchPanel?.classList.contains("active")).toBe(false);
    });
  });

  describe("getCurrentTab", () => {
    it("should return current active tab", () => {
      expect(getCurrentTab()).toBe("search"); // default active
    });

    it("should return updated tab after change", () => {
      setActiveTab("texts");
      expect(getCurrentTab()).toBe("texts");
    });
  });

  describe("onTabChange", () => {
    it("should call callback when tab changes", () => {
      const callback = vi.fn();
      onTabChange(callback);
      initTabs();

      const textsTab = document.querySelector('[data-tab="texts"]') as HTMLElement;
      textsTab.click();

      expect(callback).toHaveBeenCalledWith("texts");
    });
  });
});
