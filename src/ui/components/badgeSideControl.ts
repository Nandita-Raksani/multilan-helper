// Per-node badge side control (Auto / Left / Right) shown on a linked node's card.
// Lets the user decide which side THIS node's on-canvas multilanId badge sits on.

import type { AnnotationSide } from '../../shared/types';
import { escapeHtml } from '../utils/dom';
import { pluginBridge } from '../services/pluginBridge';

const SIDES: AnnotationSide[] = ['auto', 'left', 'right'];
const LABELS: Record<AnnotationSide, string> = { auto: 'Auto', left: 'Left', right: 'Right' };

/** Render the control for one node. `active` is the node's current preference. */
export function renderBadgeSideControl(nodeId: string, active: AnnotationSide = 'auto'): string {
  const buttons = SIDES.map(
    (s) =>
      `<button class="badge-side-btn${s === active ? ' active' : ''}" data-node-id="${escapeHtml(nodeId)}" data-side="${s}">${LABELS[s]}</button>`
  ).join('');
  return `<div class="badge-side-control" title="Which side this multilanId badge sits on">
    <span class="badge-side-label">Badge side</span>
    ${buttons}
  </div>`;
}

/** Attach click handling for badge-side buttons within a container (idempotent per render). */
export function wireBadgeSideControl(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('.badge-side-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId;
      const side = btn.dataset.side as AnnotationSide;
      if (nodeId && (side === 'auto' || side === 'left' || side === 'right')) {
        pluginBridge.setNodeAnnotationSide(nodeId, side);
      }
    });
  });
}
