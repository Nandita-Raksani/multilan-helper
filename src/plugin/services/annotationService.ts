// Annotation service — draws on-canvas multilanId badges with dashed leader lines
// outside a frame, so anyone viewing the file (any seat, no plugin) can read the
// multilanId of each linked text. All created nodes are marked with ANNOTATION_KEY
// so the plugin's text scans ignore them.

import { ANNOTATION_KEY, ANNOTATION_TARGET_KEY } from "../../shared/types";
import { getMultilanId, getNodeSide, isEffectivelyVisible } from "./nodeService";

// Container node types that count as a "frame"/screen we annotate around.
const CONTAINER_TYPES: ReadonlySet<string> = new Set([
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "SECTION",
]);

// Layout constants.
const COLUMN_GAP = 80; // horizontal gap between the frame edge and the badge column
const MIN_LINE = 8; // keep the dashed line visible even when text ends near the column
const BADGE_HEIGHT = 24; // estimated badge height, used for stacking
const BADGE_MIN_GAP = 8; // minimum vertical gap between stacked badges
const BADGE_CHAR_W = 8; // estimated width per id character (for overlap detection)
const BADGE_PAD_X = 8; // horizontal badge padding (per side)

// Badge / line styling: white badge, green border + green text + green dashed line.
const GREEN: RGB = { r: 0.086, g: 0.639, b: 0.29 }; // ~#16A34A
const WHITE: RGB = { r: 1, g: 1, b: 1 };

export type Side = "left" | "right";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface BadgePlacement {
  side: Side;
  textEdge: Point; // where the leader meets the text (at the text's vertical center)
  elbow: Point; // the corner: column x, still at the text's vertical center
  badgeCenter: Point; // badge center (column x, possibly nudged vertically)
}
export interface DesiredBadge {
  side: Side;
  textEdge: Point;
  elbow: Point;
  rect: Box; // desired badge rect, centered on the text line
}

/** True when a node is one of the plugin's own annotation nodes. */
export function isAnnotationNode(node: BaseNode): boolean {
  return !!node.getPluginData(ANNOTATION_KEY);
}

function markAnnotation(node: BaseNode): void {
  node.setPluginData(ANNOTATION_KEY, "true");
}

/**
 * Which frame edge a text node is nearest to. Text in the left half of the frame
 * exits left, text in the right half exits right — so a two-column layout puts each
 * column's badges on its own side.
 */
export function naturalSideForNode(frameBox: Box, nodeBox: Box): Side {
  const frameCenterX = frameBox.x + frameBox.width / 2;
  const nodeCenterX = nodeBox.x + nodeBox.width / 2;
  return nodeCenterX < frameCenterX ? "left" : "right";
}

/**
 * Which sides are blocked by a neighbouring node/screen within `band` of the frame,
 * used so a badge never lands on top of other design content. */
export function boxesIntersect(a: Box, b: Box, margin: number = 0): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

function collidesAny(rect: Box, obstacles: Box[], margin: number): boolean {
  for (const o of obstacles) if (boxesIntersect(rect, o, margin)) return true;
  return false;
}

/**
 * Choose which side a badge goes and how far out its column sits, so it doesn't cover
 * other content. Tries the natural (nearest) side, then the other side, at the base
 * gap; if both would overlap content, pushes the natural side further out until clear.
 * `obstacles` are the absolute boxes of real content (text + screens) to avoid.
 */
export function chooseColumn(
  frameBox: Box,
  nodeBox: Box,
  obstacles: Box[],
  width: number,
  forcedSide?: Side,
  gap: number = COLUMN_GAP,
  height: number = BADGE_HEIGHT,
  margin: number = 6,
  pushStep: number = 40
): { side: Side; columnX: number } {
  const centerY = nodeBox.y + nodeBox.height / 2;
  const natural = naturalSideForNode(frameBox, nodeBox);
  const other: Side = natural === "right" ? "left" : "right";

  const baseColumn = (side: Side) =>
    side === "right" ? frameBox.x + frameBox.width + gap : frameBox.x - gap;
  const rectFor = (side: Side, columnX: number): Box => ({
    x: side === "right" ? columnX : columnX - width,
    y: centerY - height / 2,
    width,
    height,
  });
  const pushOut = (side: Side): number => {
    let columnX = baseColumn(side);
    const step = side === "right" ? pushStep : -pushStep;
    for (let i = 0; i < 40 && collidesAny(rectFor(side, columnX), obstacles, margin); i++) {
      columnX += step;
    }
    return columnX;
  };

  // Manual override: always use the chosen side, only pushing out to avoid content.
  if (forcedSide) {
    return { side: forcedSide, columnX: pushOut(forcedSide) };
  }

  // Auto: prefer a side that's already clear at the base gap.
  for (const side of [natural, other]) {
    const columnX = baseColumn(side);
    if (!collidesAny(rectFor(side, columnX), obstacles, margin)) {
      return { side, columnX };
    }
  }
  // Both busy — push the natural side outward until it clears (bounded).
  return { side: natural, columnX: pushOut(natural) };
}

/**
 * Walk the selection up to the nearest enclosing container (frame/section/component/
 * instance); if a node is itself a container, use it. Deduped, order-preserving.
 */
export function resolveTargetFrames(selection: readonly SceneNode[]): SceneNode[] {
  const frames: SceneNode[] = [];
  const seen = new Set<string>();
  for (const node of selection) {
    let current: BaseNode | null = node;
    while (current && !CONTAINER_TYPES.has(current.type)) {
      current = current.parent;
    }
    if (current && CONTAINER_TYPES.has(current.type) && !seen.has(current.id)) {
      seen.add(current.id);
      frames.push(current as SceneNode);
    }
  }
  return frames;
}

/**
 * Pure global de-overlap: given every badge's desired rect + connection points,
 * stack them so no two badges overlap. Processed top-to-bottom; a badge that would
 * collide with an already-placed one (horizontally AND vertically) is pushed straight
 * down until it clears. Only vertical position changes, so each leader becomes an
 * elbow (out to the column, then down) when its badge is nudged off the text line.
 */
export function resolveOverlaps(
  desired: DesiredBadge[],
  minGap: number = BADGE_MIN_GAP
): BadgePlacement[] {
  const order = desired
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.rect.y - b.d.rect.y);

  const placed: Box[] = [];
  const out: BadgePlacement[] = new Array(desired.length);

  for (const { d, i } of order) {
    const rect: Box = { ...d.rect };
    let moved = true;
    while (moved) {
      moved = false;
      for (const p of placed) {
        const xOverlap = rect.x < p.x + p.width && rect.x + rect.width > p.x;
        const yOverlap =
          rect.y < p.y + p.height + minGap && rect.y + rect.height + minGap > p.y;
        if (xOverlap && yOverlap) {
          rect.y = p.y + p.height + minGap; // push below the blocker
          moved = true;
        }
      }
    }
    placed.push(rect);
    out[i] = {
      side: d.side,
      textEdge: d.textEdge,
      elbow: d.elbow,
      badgeCenter: { x: d.elbow.x, y: rect.y + rect.height / 2 },
    };
  }
  return out;
}

/** Build the desired (un-nudged) badge geometry for one linked node. */
function buildDesired(node: TextNode, frameBox: Box, obstacles: Box[]): DesiredBadge | null {
  const box = node.absoluteBoundingBox;
  const multilanId = getMultilanId(node);
  if (!box || !multilanId) return null;

  // Each node carries its own side preference; 'auto' lets chooseColumn decide.
  const pref = getNodeSide(node);
  const forcedSide = pref === "auto" ? undefined : pref;
  const width = multilanId.length * BADGE_CHAR_W + BADGE_PAD_X * 2;
  const { side, columnX } = chooseColumn(frameBox, box, obstacles, width, forcedSide);
  const centerY = box.y + box.height / 2;
  const textEdgeX =
    side === "right"
      ? Math.min(box.x + box.width, columnX - MIN_LINE)
      : Math.max(box.x, columnX + MIN_LINE);
  const rectX = side === "right" ? columnX : columnX - width;

  return {
    side,
    textEdge: { x: textEdgeX, y: centerY },
    elbow: { x: columnX, y: centerY },
    rect: { x: rectX, y: centerY - BADGE_HEIGHT / 2, width, height: BADGE_HEIGHT },
  };
}

/** Absolute boxes of real content (visible text + top-level screens) badges must
 * avoid. Annotation nodes are already removed before this is gathered. */
function gatherObstacles(): Box[] {
  const boxes: Box[] = [];
  const texts = figma.currentPage.findAll(
    (n) => n.type === "TEXT" && !isAnnotationNode(n)
  ) as TextNode[];
  for (const t of texts) {
    if (!isEffectivelyVisible(t)) continue;
    const b = t.absoluteBoundingBox;
    if (b) boxes.push(b);
  }
  for (const child of figma.currentPage.children) {
    if (isAnnotationNode(child)) continue;
    const b = child.absoluteBoundingBox;
    if (b) boxes.push(b);
  }
  return boxes;
}

async function createBadge(multilanId: string): Promise<FrameNode> {
  // Inter Regular is the font every other creation path in the plugin loads, so
  // it's the safe choice — an unavailable style would reject and abort silently.
  const font: FontName = { family: "Inter", style: "Regular" };
  await figma.loadFontAsync(font);

  const label = figma.createText();
  label.fontName = font;
  label.characters = multilanId;
  label.fontSize = 11;
  label.fills = [{ type: "SOLID", color: GREEN }];

  const badge = figma.createFrame();
  badge.name = `ml-badge ${multilanId}`;
  badge.layoutMode = "HORIZONTAL";
  badge.primaryAxisSizingMode = "AUTO";
  badge.counterAxisSizingMode = "AUTO";
  badge.paddingLeft = 6;
  badge.paddingRight = 6;
  badge.paddingTop = 3;
  badge.paddingBottom = 3;
  badge.cornerRadius = 4;
  badge.fills = [{ type: "SOLID", color: WHITE }];
  badge.strokes = [{ type: "SOLID", color: GREEN }];
  badge.strokeWeight = 1;
  badge.appendChild(label);

  markAnnotation(badge);
  markAnnotation(label);
  return badge;
}

/** A green dashed leader: straight when the badge is on the text line, an elbow
 * (horizontal then vertical) when it was nudged down to avoid an overlap. */
function createLeader(p: BadgePlacement): VectorNode {
  const v = figma.createVector();
  v.name = "ml-leader";
  const nudged = Math.abs(p.elbow.y - p.badgeCenter.y) > 0.5;
  const data = nudged
    ? `M ${p.textEdge.x} ${p.textEdge.y} L ${p.elbow.x} ${p.elbow.y} L ${p.elbow.x} ${p.badgeCenter.y}`
    : `M ${p.textEdge.x} ${p.textEdge.y} L ${p.elbow.x} ${p.elbow.y}`;
  v.vectorPaths = [{ windingRule: "NONE", data }];
  v.strokes = [{ type: "SOLID", color: GREEN }];
  v.strokeWeight = 1;
  v.dashPattern = [4, 4];
  markAnnotation(v);
  return v;
}

/** Create one badge + leader group for a node at the given placement. */
async function createAnnotation(
  node: TextNode,
  multilanId: string,
  p: BadgePlacement
): Promise<void> {
  const leader = createLeader(p);
  figma.currentPage.appendChild(leader);

  const badge = await createBadge(multilanId);
  figma.currentPage.appendChild(badge);
  badge.x = p.side === "right" ? p.badgeCenter.x : p.badgeCenter.x - badge.width;
  badge.y = p.badgeCenter.y - badge.height / 2;

  const group = figma.group([leader, badge], figma.currentPage);
  group.name = `multilanId ${multilanId}`;
  group.expanded = false;
  markAnnotation(group);
  group.setPluginData(ANNOTATION_TARGET_KEY, node.id);
  group.locked = true;
}

/** Remove every annotation group on the current page. */
export function removeAllAnnotations(): void {
  const groups = figma.currentPage.findAll(
    (n) => !!n.getPluginData(ANNOTATION_TARGET_KEY)
  );
  for (const g of groups) g.remove();
}

/**
 * Rebuild all on-canvas badges for the given linked nodes. Badges are laid out
 * together and de-overlapped globally, so texts that are close together (even across
 * different frames or loose on the page) get stacked instead of piling up. Removes
 * all existing annotations first, so it doubles as cleanup for unlinked nodes.
 */
export async function reconcileAnnotations(linkedNodes: TextNode[]): Promise<void> {
  removeAllAnnotations();

  const usable = linkedNodes.filter(
    (n) => getMultilanId(n) && isEffectivelyVisible(n) && n.absoluteBoundingBox
  );
  if (usable.length === 0) return;

  // Real content boxes badges must not cover (gathered after annotations removed).
  const obstacles = gatherObstacles();

  const desired: DesiredBadge[] = [];
  const nodes: TextNode[] = [];

  for (const node of usable) {
    const frame = resolveTargetFrames([node])[0];
    const frameBox = (frame && frame.absoluteBoundingBox) || node.absoluteBoundingBox!;
    const d = buildDesired(node, frameBox, obstacles);
    if (d) {
      desired.push(d);
      nodes.push(node);
    }
  }

  const placements = resolveOverlaps(desired);
  for (let i = 0; i < placements.length; i++) {
    const multilanId = getMultilanId(nodes[i]);
    if (multilanId) await createAnnotation(nodes[i], multilanId, placements[i]);
  }
}
