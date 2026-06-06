/// <reference lib="dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Language } from "../../../src/shared/types";

// Mock pluginBridge before importing the widget — the widget calls into it.
vi.mock("../../../src/ui/services/pluginBridge", () => {
  const verifyMultilanId = vi.fn();
  const linkNode = vi.fn();
  return {
    pluginBridge: { verifyMultilanId, linkNode },
  };
});

import {
  renderManualLinkWidget,
  wireManualLinkWidget,
  handleVerifyResult,
  clearAllManualLinkState,
} from "../../../src/ui/components/ManualLinkWidget";
import { pluginBridge } from "../../../src/ui/services/pluginBridge";

const NODE_ID = "node:42";

interface MountedWidget {
  container: HTMLElement;
  rerender: () => void;
}

function mountWidget(lang: Language = "en", nodeId: string = NODE_ID): MountedWidget {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const rerender = (): void => {
    container.innerHTML = renderManualLinkWidget(nodeId);
    wireManualLinkWidget(container, rerender, () => lang);
  };
  rerender();
  return { container, rerender };
}

describe("ManualLinkWidget", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    clearAllManualLinkState();
    vi.clearAllMocks();
  });

  it("starts collapsed showing only the toggle button", () => {
    const { container } = mountWidget();
    expect(container.querySelector(".manual-link-toggle")).not.toBeNull();
    expect(container.querySelector(".manual-link-input")).toBeNull();
  });

  it("expands to show input + verify when toggle is clicked", () => {
    const { container } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();

    expect(container.querySelector(".manual-link-input")).not.toBeNull();
    expect(container.querySelector(".manual-link-verify")).not.toBeNull();
    expect(container.querySelector(".manual-link-cancel")).not.toBeNull();
  });

  it("calls pluginBridge.verifyMultilanId with the trimmed value when Verify is clicked", () => {
    const { container } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    const input = container.querySelector<HTMLInputElement>(".manual-link-input")!;
    input.value = "  10042  ";
    input.dispatchEvent(new Event("input"));
    container.querySelector<HTMLButtonElement>(".manual-link-verify")!.click();

    expect(pluginBridge.verifyMultilanId).toHaveBeenCalledWith(NODE_ID, "10042");
  });

  it("calls verify when Enter is pressed in the input", () => {
    const { container } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    const input = container.querySelector<HTMLInputElement>(".manual-link-input")!;
    input.value = "12345";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(pluginBridge.verifyMultilanId).toHaveBeenCalledWith(NODE_ID, "12345");
  });

  it("does not call verify on empty input — instead routes to not-found state", () => {
    const { container } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    container.querySelector<HTMLButtonElement>(".manual-link-verify")!.click();

    expect(pluginBridge.verifyMultilanId).not.toHaveBeenCalled();
    expect(container.querySelector(".manual-link-error")?.textContent).toContain("not found");
  });

  it("on found result, shows preview + Link button with the verified ID", () => {
    const { container, rerender } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    const input = container.querySelector<HTMLInputElement>(".manual-link-input")!;
    input.value = "10042";
    input.dispatchEvent(new Event("input"));
    container.querySelector<HTMLButtonElement>(".manual-link-verify")!.click();

    handleVerifyResult(NODE_ID, "10042", true, { en: "Submit", fr: "Soumettre" });
    rerender();

    const confirmBtn = container.querySelector<HTMLButtonElement>(".manual-link-confirm");
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn!.dataset.multilanId).toBe("10042");
    expect(container.textContent).toContain("Submit");
    expect(container.textContent).toContain("Soumettre");
  });

  it("on not-found result, shows inline error and keeps the user's draft", () => {
    const { container, rerender } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    const input = container.querySelector<HTMLInputElement>(".manual-link-input")!;
    input.value = "99999";
    input.dispatchEvent(new Event("input"));
    container.querySelector<HTMLButtonElement>(".manual-link-verify")!.click();

    handleVerifyResult(NODE_ID, "99999", false);
    rerender();

    expect(container.querySelector(".manual-link-error")?.textContent).toContain("not found");
    expect(container.querySelector<HTMLInputElement>(".manual-link-input")?.value).toBe("99999");
  });

  it("ignores a verify result whose draft no longer matches (stale reply)", () => {
    const { container } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    const input = container.querySelector<HTMLInputElement>(".manual-link-input")!;
    input.value = "first";
    input.dispatchEvent(new Event("input"));
    container.querySelector<HTMLButtonElement>(".manual-link-verify")!.click();

    const consumed = handleVerifyResult(NODE_ID, "stale", true, { en: "old" });
    expect(consumed).toBe(false);
  });

  it("Cancel resets the widget to collapsed", () => {
    const { container } = mountWidget();
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    container.querySelector<HTMLButtonElement>(".manual-link-cancel")!.click();

    expect(container.querySelector(".manual-link-toggle")).not.toBeNull();
    expect(container.querySelector(".manual-link-input")).toBeNull();
  });

  it("Link button on found state calls pluginBridge.linkNode with the verified ID", () => {
    const { container, rerender } = mountWidget("fr");
    container.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    const input = container.querySelector<HTMLInputElement>(".manual-link-input")!;
    input.value = "10042";
    input.dispatchEvent(new Event("input"));
    container.querySelector<HTMLButtonElement>(".manual-link-verify")!.click();
    handleVerifyResult(NODE_ID, "10042", true, { en: "Submit" });
    rerender();

    container.querySelector<HTMLButtonElement>(".manual-link-confirm")!.click();

    expect(pluginBridge.linkNode).toHaveBeenCalledWith(NODE_ID, "10042", "fr");
  });

  it("two widgets for different nodes maintain independent state", () => {
    const { container: c1, rerender: r1 } = mountWidget("en", "nA");
    const { container: c2, rerender: r2 } = mountWidget("en", "nB");

    c1.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();
    r1();
    r2();

    expect(c1.querySelector(".manual-link-input")).not.toBeNull();
    expect(c2.querySelector(".manual-link-input")).toBeNull();
    expect(c2.querySelector(".manual-link-toggle")).not.toBeNull();
  });

  it("(legacy multi-mount setup) widgets coexist when manually wired", () => {
    const c1 = document.createElement("div");
    c1.innerHTML = renderManualLinkWidget("nA");
    document.body.appendChild(c1);
    wireManualLinkWidget(c1, () => undefined, () => "en");

    const c2 = document.createElement("div");
    c2.innerHTML = renderManualLinkWidget("nB");
    document.body.appendChild(c2);
    wireManualLinkWidget(c2, () => undefined, () => "en");

    // Expand only the first one
    c1.querySelector<HTMLButtonElement>(".manual-link-toggle")!.click();

    // Re-render reflects state
    c1.innerHTML = renderManualLinkWidget("nA");
    c2.innerHTML = renderManualLinkWidget("nB");

    expect(c1.querySelector(".manual-link-input")).not.toBeNull();
    expect(c2.querySelector(".manual-link-input")).toBeNull();
    expect(c2.querySelector(".manual-link-toggle")).not.toBeNull();
  });
});
