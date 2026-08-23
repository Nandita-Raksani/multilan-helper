import { describe, it, expect } from "vitest";
import { createMockTextNode } from "../../setup";
import {
  resolveOverlaps,
  naturalSideForNode,
  boxesIntersect,
  chooseColumn,
  resolveTargetFrames,
  isAnnotationNode,
} from "../../../src/plugin/services/annotationService";
import type { DesiredBadge } from "../../../src/plugin/services/annotationService";
import { ANNOTATION_KEY } from "../../../src/shared/types";

// Helper: a desired badge whose rect is centered on `centerY` at column `x`.
function desired(
  x: number,
  centerY: number,
  width = 50,
  side: "left" | "right" = "right"
): DesiredBadge {
  const height = 24;
  return {
    side,
    textEdge: { x, y: centerY },
    elbow: { x, y: centerY },
    rect: { x, y: centerY - height / 2, width, height },
  };
}

describe("annotationService", () => {
  describe("resolveOverlaps", () => {
    it("keeps badges in place when they don't overlap", () => {
      const out = resolveOverlaps([desired(180, 30), desired(180, 200)]);
      expect(out[0].badgeCenter.y).toBe(30);
      expect(out[1].badgeCenter.y).toBe(200);
    });

    it("pushes an overlapping badge down below the one above (+min gap)", () => {
      // Two badges on the same column and nearly the same line.
      const out = resolveOverlaps([desired(180, 110), desired(180, 118)]);
      // First: top 98, bottom 122. Second must drop to 122 + gap(8) = 130 → center 142.
      expect(out[0].badgeCenter.y).toBe(110);
      expect(out[1].badgeCenter.y).toBe(142);
      // Elbow stays on the text line, so the leader bends (elbow).
      expect(out[1].elbow.y).toBe(118);
      expect(out[1].badgeCenter.y).not.toBe(out[1].elbow.y);
    });

    it("does not push badges that don't overlap horizontally", () => {
      // Same line, but far apart in x → independent.
      const out = resolveOverlaps([desired(180, 110, 50), desired(500, 110, 50)]);
      expect(out[0].badgeCenter.y).toBe(110);
      expect(out[1].badgeCenter.y).toBe(110);
    });

    it("cascades three overlapping badges into a clean stack", () => {
      const out = resolveOverlaps([
        desired(180, 100),
        desired(180, 104),
        desired(180, 108),
      ]);
      const ys = out.map((p) => p.badgeCenter.y).sort((a, b) => a - b);
      // Each badge (height 24) must be at least 24 + gap(8) = 32 below the previous.
      expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(32);
      expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(32);
    });

    it("returns one placement per item", () => {
      const out = resolveOverlaps([desired(180, 0), desired(180, 100), desired(-80, 200, 50, "left")]);
      expect(out).toHaveLength(3);
    });
  });

  describe("resolveTargetFrames", () => {
    const page = { type: "PAGE", id: "page", parent: null };
    const frame = { type: "FRAME", id: "f1", parent: page };
    const nestedGroup = { type: "GROUP", id: "g1", parent: frame };
    const text = { type: "TEXT", id: "t1", parent: nestedGroup };

    const as = (n: unknown) => n as unknown as SceneNode;

    it("walks a text node up to its enclosing frame", () => {
      const frames = resolveTargetFrames([as(text)]);
      expect(frames.map((f) => f.id)).toEqual(["f1"]);
    });

    it("returns a directly-selected container as itself", () => {
      const frames = resolveTargetFrames([as(frame)]);
      expect(frames.map((f) => f.id)).toEqual(["f1"]);
    });

    it("dedupes multiple selections that resolve to the same frame", () => {
      const text2 = { type: "TEXT", id: "t2", parent: frame };
      const frames = resolveTargetFrames([as(text), as(text2), as(frame)]);
      expect(frames.map((f) => f.id)).toEqual(["f1"]);
    });

    it("returns nothing for loose nodes with no container ancestor", () => {
      const loose = { type: "TEXT", id: "loose", parent: page };
      expect(resolveTargetFrames([as(loose)])).toEqual([]);
    });

    it("treats SECTION and COMPONENT as containers", () => {
      const section = { type: "SECTION", id: "s1", parent: page };
      const comp = { type: "COMPONENT", id: "c1", parent: page };
      const frames = resolveTargetFrames([as(section), as(comp)]);
      expect(frames.map((f) => f.id)).toEqual(["s1", "c1"]);
    });
  });

  describe("naturalSideForNode", () => {
    const frameBox = { x: 0, y: 0, width: 400, height: 300 };

    it("left-half text exits left", () => {
      expect(naturalSideForNode(frameBox, { x: 20, y: 10, width: 80, height: 20 })).toBe("left");
    });

    it("right-half text exits right", () => {
      expect(naturalSideForNode(frameBox, { x: 300, y: 10, width: 80, height: 20 })).toBe("right");
    });

    it("two same-line columns get opposite sides", () => {
      const leftCol = { x: 20, y: 100, width: 120, height: 20 };
      const rightCol = { x: 260, y: 100, width: 120, height: 20 }; // same y as leftCol
      expect(naturalSideForNode(frameBox, leftCol)).toBe("left");
      expect(naturalSideForNode(frameBox, rightCol)).toBe("right");
    });
  });

  describe("boxesIntersect", () => {
    it("detects overlapping boxes", () => {
      expect(boxesIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    });
    it("returns false for separated boxes", () => {
      expect(boxesIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 10, height: 10 })).toBe(false);
    });
    it("counts near-misses as overlap when a margin is given", () => {
      expect(boxesIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 12, y: 0, width: 10, height: 10 }, 5)).toBe(true);
    });
  });

  describe("chooseColumn", () => {
    const frameBox = { x: 0, y: 0, width: 400, height: 300 };
    const node = { x: 300, y: 40, width: 80, height: 20 }; // right-half → natural right
    const width = 50;

    it("uses the natural (right) side when it's clear", () => {
      const { side, columnX } = chooseColumn(frameBox, node, [], width);
      expect(side).toBe("right");
      expect(columnX).toBe(480); // frame right (400) + gap (80)
    });

    it("flips to the left when the right side would cover content", () => {
      // Something sitting just right of the frame on the same line as the node.
      const blocker = { x: 470, y: 30, width: 200, height: 60 };
      const { side } = chooseColumn(frameBox, node, [blocker], width);
      expect(side).toBe("left");
    });

    it("pushes the column further out when both sides are blocked", () => {
      const rightBlocker = { x: 470, y: 30, width: 200, height: 60 };
      const leftBlocker = { x: -260, y: 30, width: 200, height: 60 };
      const { side, columnX } = chooseColumn(frameBox, node, [rightBlocker, leftBlocker], width);
      expect(side).toBe("right"); // natural side, pushed out
      expect(columnX).toBeGreaterThan(480); // pushed beyond the base gap
    });

    it("honours a forced side even when that side is the non-natural one", () => {
      // node is right-half (natural right), but force left.
      const { side } = chooseColumn(frameBox, node, [], width, "left");
      expect(side).toBe("left");
    });

    it("forced side still pushes out to avoid covering content", () => {
      // Base left column x = frame.x(0) - gap(80) = -80; badge rect spans -130..-80.
      const leftBlocker = { x: -120, y: 30, width: 60, height: 60 }; // overlaps that rect
      const { side, columnX } = chooseColumn(frameBox, node, [leftBlocker], width, "left");
      expect(side).toBe("left");
      expect(columnX).toBeLessThan(-80); // pushed further left to clear the blocker
    });
  });

  describe("isAnnotationNode", () => {
    it("is true only when the annotation marker is set", () => {
      const plain = createMockTextNode();
      const marked = createMockTextNode();
      marked.setPluginData(ANNOTATION_KEY, "true");

      expect(isAnnotationNode(plain)).toBe(false);
      expect(isAnnotationNode(marked)).toBe(true);
    });
  });
});
