// Manual link-by-multilanId widget.
//
// Available on every node card (single-node panels and frame-mode cards) so a
// designer can paste an ID they already know, verify it exists in the loaded
// translation data, preview the canonical text, and link — useful when fuzzy
// match misses or the canvas text has drifted from the database.
//
// Lifecycle (per nodeId):
//   collapsed  → user clicks "Link by multilanId"
//   expanded   → user types ID, hits Verify or Enter
//   verifying  → waiting for plugin response
//   found      → preview translation + Link button
//   not-found  → inline error, user can edit and retry
//
// State is keyed by nodeId so multiple widgets coexist in frame mode without
// stepping on each other.

import type { Language, TranslationEntry } from '../../shared/types';
import { escapeHtml } from '../utils/dom';
import { pluginBridge } from '../services/pluginBridge';

const linkIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;

type WidgetState =
  | { kind: 'collapsed' }
  | { kind: 'expanded'; draft: string }
  | { kind: 'verifying'; draft: string }
  | { kind: 'found'; multilanId: string; translations: TranslationEntry }
  | { kind: 'not-found'; draft: string };

const states = new Map<string, WidgetState>();

function getState(nodeId: string): WidgetState {
  return states.get(nodeId) ?? { kind: 'collapsed' };
}

function setState(nodeId: string, next: WidgetState): void {
  states.set(nodeId, next);
}

function reset(nodeId: string): void {
  states.delete(nodeId);
}

/**
 * Called by main.ts when the plugin replies with a verification result.
 * Returns true when the widget for `nodeId` was actually waiting on this reply.
 */
export function handleVerifyResult(
  nodeId: string,
  multilanId: string,
  found: boolean,
  translations?: TranslationEntry,
): boolean {
  const current = getState(nodeId);
  if (current.kind !== 'verifying') return false;
  // Ignore stale replies for a different draft (rare but possible if user typed
  // again between requests).
  if (current.draft.trim() !== multilanId.trim()) return false;

  if (found && translations) {
    setState(nodeId, { kind: 'found', multilanId, translations });
  } else {
    setState(nodeId, { kind: 'not-found', draft: current.draft });
  }
  return true;
}

/**
 * Render the widget HTML for a node. Returns an empty string when the user
 * hasn't asked to manually link yet — keeps cards compact in the common case.
 */
export function renderManualLinkWidget(nodeId: string): string {
  const state = getState(nodeId);
  const safeNode = escapeHtml(nodeId);

  switch (state.kind) {
    case 'collapsed':
      return `
        <div class="manual-link-widget" data-node-id="${safeNode}">
          <button class="manual-link-toggle" data-node-id="${safeNode}">${linkIconSvg}<span>Link by multilanId</span></button>
        </div>`;

    case 'expanded':
    case 'not-found': {
      const errorMsg = state.kind === 'not-found'
        ? `<div class="manual-link-error">Multilan ID not found</div>`
        : '';
      const draft = escapeHtml(state.draft);
      return `
        <div class="manual-link-widget manual-link-widget-expanded" data-node-id="${safeNode}">
          <div class="manual-link-row">
            <input
              type="text"
              inputmode="numeric"
              class="manual-link-input"
              data-node-id="${safeNode}"
              value="${draft}"
              placeholder="Paste multilanId (e.g. 10042)"
            />
            <button class="manual-link-verify btn-sm btn-sm-brand" data-node-id="${safeNode}">Verify</button>
            <button class="manual-link-cancel btn-sm btn-sm-outline" data-node-id="${safeNode}">Cancel</button>
          </div>
          ${errorMsg}
        </div>`;
    }

    case 'verifying':
      return `
        <div class="manual-link-widget manual-link-widget-expanded" data-node-id="${safeNode}">
          <div class="manual-link-row">
            <input type="text" class="manual-link-input" disabled value="${escapeHtml(state.draft)}" />
            <span class="searching-hint"><span class="searching-spinner"></span> Verifying&hellip;</span>
          </div>
        </div>`;

    case 'found':
      return `
        <div class="manual-link-widget manual-link-widget-expanded" data-node-id="${safeNode}">
          <div class="manual-link-preview">
            <div class="manual-link-preview-id">${escapeHtml(state.multilanId)} <span class="match-badge match-badge-exact">Verified</span></div>
            <div class="manual-link-preview-translations">
              ${renderPreviewTranslations(state.translations)}
            </div>
          </div>
          <div class="manual-link-row" style="justify-content:flex-end">
            <button class="manual-link-cancel btn-sm btn-sm-outline" data-node-id="${safeNode}">Cancel</button>
            <button class="manual-link-confirm btn-sm btn-sm-success" data-node-id="${safeNode}" data-multilan-id="${escapeHtml(state.multilanId)}">Link</button>
          </div>
        </div>`;
  }
}

function renderPreviewTranslations(translations: TranslationEntry): string {
  return Object.entries(translations)
    .filter(([, value]) => value)
    .map(([lang, value]) => `
      <div class="translation-row">
        <span class="translation-lang">${escapeHtml(lang.toUpperCase())}</span>
        <span class="translation-text">${escapeHtml(value)}</span>
      </div>
    `)
    .join('');
}

/**
 * Wire all widget event handlers within a container. Re-render is the caller's
 * responsibility (it owns the panel lifecycle).
 */
export function wireManualLinkWidget(
  container: HTMLElement,
  rerender: () => void,
  getCurrentLanguage: () => Language,
): void {
  // Toggle (collapsed → expanded)
  container.querySelectorAll<HTMLButtonElement>('.manual-link-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      setState(nodeId, { kind: 'expanded', draft: '' });
      rerender();
    });
  });

  // Cancel (any state → collapsed, fully reset)
  container.querySelectorAll<HTMLButtonElement>('.manual-link-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      reset(nodeId);
      rerender();
    });
  });

  // Track typing so the draft survives re-renders triggered elsewhere
  container.querySelectorAll<HTMLInputElement>('.manual-link-input').forEach(input => {
    input.addEventListener('input', () => {
      const nodeId = input.dataset.nodeId!;
      const cleaned = input.value.replace(/\D+/g, '');
      if (cleaned !== input.value) {
        const caret = input.selectionStart ?? cleaned.length;
        input.value = cleaned;
        const newCaret = Math.min(caret, cleaned.length);
        input.setSelectionRange(newCaret, newCaret);
      }
      const current = getState(nodeId);
      if (current.kind === 'expanded' || current.kind === 'not-found') {
        setState(nodeId, { kind: 'expanded', draft: cleaned });
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nodeId = input.dataset.nodeId!;
        triggerVerify(nodeId, input.value, rerender);
      }
    });
  });

  // Verify button
  container.querySelectorAll<HTMLButtonElement>('.manual-link-verify').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      const inputEl = container.querySelector<HTMLInputElement>(
        `.manual-link-input[data-node-id="${cssEscape(nodeId)}"]`,
      );
      const value = inputEl?.value ?? '';
      triggerVerify(nodeId, value, rerender);
    });
  });

  // Confirm-link button
  container.querySelectorAll<HTMLButtonElement>('.manual-link-confirm').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId!;
      const multilanId = btn.dataset.multilanId!;
      pluginBridge.linkNode(nodeId, multilanId, getCurrentLanguage());
      reset(nodeId);
      rerender();
    });
  });
}

function triggerVerify(nodeId: string, rawValue: string, rerender: () => void): void {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    setState(nodeId, { kind: 'not-found', draft: rawValue });
    rerender();
    return;
  }
  setState(nodeId, { kind: 'verifying', draft: trimmed });
  pluginBridge.verifyMultilanId(nodeId, trimmed);
  rerender();
}

// CSS.escape isn't always available in older runtimes; do a minimal escape for
// attribute selectors keyed on nodeId (which can contain ":" from Figma).
function cssEscape(value: string): string {
  return value.replace(/(["\\:])/g, '\\$1');
}

/**
 * Drop the entire widget state. Call when the underlying selection changes so
 * a stale "found" preview from a previously-selected node doesn't reappear.
 */
export function clearAllManualLinkState(): void {
  states.clear();
}
