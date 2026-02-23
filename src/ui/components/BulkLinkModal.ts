import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById } from '../utils/dom';
import { escapeHtml } from '../utils/dom';

export function initBulkLinkModal(): void {
  const closeBulkModal = getElementById<HTMLButtonElement>('closeBulkModal');
  const applyExactMatches = getElementById<HTMLButtonElement>('applyExactMatches');

  closeBulkModal.addEventListener('click', () => {
    closeModal();
    const state = store.getState();
    pluginBridge.refresh(state.scope);
  });

  applyExactMatches.addEventListener('click', () => {
    const state = store.getState();
    if (!state.bulkLinkResults?.exactMatches) return;

    const confirmations = state.bulkLinkResults.exactMatches.map(m => ({
      nodeId: m.nodeId,
      multilanId: m.multilanId
    }));

    pluginBridge.applyExactMatches(confirmations, state.scope);

    applyExactMatches.style.display = 'none';
    store.setState({
      bulkLinkResults: {
        ...state.bulkLinkResults,
        exactMatches: []
      }
    });
    renderBulkLinkResults();
  });
}

export function showModal(): void {
  getElementById('bulkLinkModal').classList.add('active');
}

export function closeModal(): void {
  getElementById('bulkLinkModal').classList.remove('active');
}

export function renderBulkLinkResults(): void {
  const state = store.getState();
  if (!state.bulkLinkResults) return;

  const { exactMatches, fuzzyMatches, unmatched } = state.bulkLinkResults;
  const bulkLinkSummary = getElementById<HTMLDivElement>('bulkLinkSummary');
  const bulkLinkContent = getElementById<HTMLDivElement>('bulkLinkContent');
  const applyExactMatches = getElementById<HTMLButtonElement>('applyExactMatches');

  // Summary
  bulkLinkSummary.innerHTML = `
    <div class="stat"><span class="stat-dot exact"></span> ${exactMatches.length} exact</div>
    <div class="stat"><span class="stat-dot fuzzy"></span> ${fuzzyMatches.length} fuzzy</div>
    <div class="stat"><span class="stat-dot unmatched"></span> ${unmatched.length} unmatched</div>
  `;

  // Show/hide apply button
  applyExactMatches.style.display = exactMatches.length > 0 ? 'block' : 'none';

  let content = '';

  // Exact matches
  if (exactMatches.length > 0) {
    content += `
      <div class="modal-section">
        <h4>Exact Matches (will be auto-linked)</h4>
        ${exactMatches.map(m => `
          <div class="match-item">
            <div class="match-item-text">${escapeHtml(m.text.slice(0, 50))}${m.text.length > 50 ? '...' : ''}</div>
            <div class="match-item-id">→ ${escapeHtml(m.multilanId)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Fuzzy matches
  if (fuzzyMatches.length > 0) {
    content += `
      <div class="modal-section">
        <h4>Possible Matches (review needed)</h4>
        ${fuzzyMatches.map(m => `
          <div class="match-item">
            <div class="match-item-text">${escapeHtml(m.text.slice(0, 50))}${m.text.length > 50 ? '...' : ''}</div>
            ${m.suggestions.slice(0, 2).map(s => {
              const previewText = s.translations['en'] || Object.values(s.translations)[0] || '';
              return `
              <div class="fuzzy-suggestion">
                <div class="fuzzy-suggestion-info">
                  <span class="fuzzy-suggestion-id">${escapeHtml(s.multilanId)}</span>
                  <span class="fuzzy-suggestion-text">${escapeHtml(previewText)}</span>
                </div>
                <div class="fuzzy-actions">
                  <button class="btn-accept" data-node="${m.nodeId}" data-id="${s.multilanId}">Link</button>
                  <button class="btn-skip">Skip</button>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Unmatched
  if (unmatched.length > 0) {
    content += `
      <div class="modal-section">
        <h4>No Matches Found</h4>
        ${unmatched.slice(0, 5).map(m => `
          <div class="match-item">
            <div class="match-item-text">${escapeHtml(m.text.slice(0, 50))}${m.text.length > 50 ? '...' : ''}</div>
          </div>
        `).join('')}
        ${unmatched.length > 5 ? `<div style="font-size: 10px; color: var(--figma-color-text-secondary);">...and ${unmatched.length - 5} more</div>` : ''}
      </div>
    `;
  }

  if (!content) {
    content = '<div class="empty-state">No unlinked text nodes found</div>';
  }

  bulkLinkContent.innerHTML = content;
  attachFuzzyMatchHandlers();
}

function attachFuzzyMatchHandlers(): void {
  const bulkLinkContent = getElementById<HTMLDivElement>('bulkLinkContent');

  // Accept handlers
  bulkLinkContent.querySelectorAll<HTMLButtonElement>('.btn-accept').forEach(btn => {
    btn.addEventListener('click', () => {
      const nodeId = btn.dataset.node!;
      const multilanId = btn.dataset.id!;
      pluginBridge.confirmFuzzyLink(nodeId, multilanId);
      btn.closest('.match-item')?.remove();
    });
  });

  // Skip handlers
  bulkLinkContent.querySelectorAll<HTMLButtonElement>('.btn-skip').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.fuzzy-suggestion')?.remove();
    });
  });
}
