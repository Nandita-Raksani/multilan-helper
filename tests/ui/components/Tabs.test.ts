import { describe, it, expect, beforeEach } from "vitest";
import { setupUIFixture } from "../setup";
import { initTabs, getCurrentTab } from "../../../src/ui/components/Tabs";

// Tabs was collapsed to a single-tab stub. The multi-tab API
// (setActiveTab / onTabChange / clickable data-tab switching) was removed,
// so the surviving behaviour is: initTabs is a no-op that must not throw,
// and getCurrentTab always reports the sole 'search' tab.
describe("Tabs", () => {
  beforeEach(() => {
    setupUIFixture();
  });

  describe("initTabs", () => {
    it("should run without throwing", () => {
      expect(() => initTabs()).not.toThrow();
    });
  });

  describe("getCurrentTab", () => {
    it("should always report the single 'search' tab", () => {
      expect(getCurrentTab()).toBe("search");
    });

    it("should still report 'search' after initTabs", () => {
      initTabs();
      expect(getCurrentTab()).toBe("search");
    });
  });
});
