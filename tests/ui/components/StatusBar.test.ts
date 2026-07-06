import { describe, it, expect, beforeEach } from "vitest";
import { setupUIFixture } from "../setup";
import { initStatusBar, setStatus, setViewMode } from "../../../src/ui/components/StatusBar";

describe("StatusBar", () => {
  beforeEach(() => {
    setupUIFixture();
  });

  describe("initStatusBar", () => {
    it("should run without throwing against the UI fixture", () => {
      expect(() => initStatusBar()).not.toThrow();
    });
  });

  describe("setStatus", () => {
    it("should update status text", () => {
      setStatus("Loading...");

      const statusText = document.getElementById("statusText");
      expect(statusText?.textContent).toBe("Loading...");
    });

    it("should overwrite previous status text", () => {
      setStatus("Ready");
      setStatus("150 translations loaded");

      const statusText = document.getElementById("statusText");
      expect(statusText?.textContent).toBe("150 translations loaded");
    });
  });

  describe("setViewMode", () => {
    it("should show view mode banner when true", () => {
      setViewMode(true);

      const banner = document.getElementById("viewModeBanner");
      expect(banner?.style.display).toBe("block");
    });

    it("should hide view mode banner when false", () => {
      setViewMode(true);
      setViewMode(false);

      const banner = document.getElementById("viewModeBanner");
      expect(banner?.style.display).toBe("none");
    });
  });
});
