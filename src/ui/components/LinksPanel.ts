import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById, querySelectorAll } from '../utils/dom';
import { escapeHtml } from '../utils/dom';
import { setActiveTab } from './Tabs';
import { triggerSearch } from './SearchPanel';

let isHighlighting = false;

export function initLinksPanel(): void {
  const scopeBtns = querySelectorAll<HTMLButtonElement>('.scope-btn[data-scope]');
  const textSearch = getElementById<HTMLInputElement>('textSearch');
  const highlightBtn = getElementById<HTMLButtonElement>('highlightUnlinkedBtn');

  // Scope toggle - triggers auto-link for the selected scope
  scopeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const state = store.getState();
      if (!state.canEdit) {
        alert('You do not have edit permissions');
        return;
      }

      scopeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const scope = btn.dataset.scope as 'page' | 'selection';
      store.setState({ scope });

      // Refresh the text list and trigger auto-link
      pluginBridge.refresh(scope);
      updateStatusText('Scanning for matches...');
      btn.disabled = true;
      pluginBridge.bulkAutoLink(scope);
      setTimeout(() => { btn.disabled = false; }, 1000);
    });
  });

  // Text search filter
  textSearch.addEventListener('input', () => {
    renderTextList();
  });

  // Highlight unlinked toggle
  highlightBtn.addEventListener('click', () => {
    const state = store.getState();
    if (!state.canEdit) {
      alert('You do not have edit permissions');
      return;
    }

    isHighlighting = !isHighlighting;
    highlightBtn.classList.toggle('active', isHighlighting);
    highlightBtn.textContent = isHighlighting ? 'Hide Unlinked' : 'Show Unlinked';

    pluginBridge.highlightUnlinked(isHighlighting, state.scope);
  });
}

export function renderTextList(): void {
  const state = store.getState();
  const textList = getElementById<HTMLDivElement>('textList');
  const textSearch = getElementById<HTMLInputElement>('textSearch');
  const filter = textSearch.value.toLowerCase();

  const filtered = state.textNodes.filter(node => {
    return node.name.toLowerCase().includes(filter) ||
           node.characters.toLowerCase().includes(filter) ||
           (node.multilanId && node.multilanId.toLowerCase().includes(filter));
  });

  if (filtered.length === 0) {
    textList.innerHTML = '<div class="empty-state">No text layers found</div>';
    return;
  }

  textList.innerHTML = filtered.map(node => {
    const itemClass = node.multilanId ? 'linked' : 'unlinked';
    const translations = node.translations || {};
    const previewText = node.multilanId
      ? (translations[state.currentLang] || '*Multilan not available*')
      : node.characters;
    const linkButton = !node.multilanId ? `<button class="btn-link-node" data-id="${node.id}" data-text="${escapeHtml(node.characters)}">Link</button>` : '';
    const unlinkButton = node.multilanId ? `<button class="btn-unlink-node" data-id="${node.id}">Unlink</button>` : '';

    return `
      <div class="text-item ${itemClass}" data-id="${node.id}">
        <div class="text-item-header">
          <span class="text-item-name">${escapeHtml(node.name)}</span>
          ${!node.multilanId ? `<span class="text-item-unlinked">Not linked ${linkButton}</span>` : unlinkButton}
        </div>
        <div class="text-item-content">${escapeHtml(previewText)}</div>
      </div>
    `;
  }).join('');

  attachTextItemHandlers();
}

function attachTextItemHandlers(): void {
  const textList = getElementById<HTMLDivElement>('textList');
  const state = store.getState();

  // Click handlers for selecting nodes
  textList.querySelectorAll<HTMLDivElement>('.text-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('btn-link-node') ||
          (e.target as HTMLElement).classList.contains('btn-unlink-node')) return;

      const nodeId = item.dataset.id!;
      const nodeData = state.textNodes.find(n => n.id === nodeId);
      const text = nodeData ? nodeData.characters : '';

      pluginBridge.selectNode(nodeId);
      setActiveTab('search');

      setTimeout(() => {
        triggerSearch(text.slice(0, 30));
      }, 50);
    });
  });

  // Link button handlers
  textList.querySelectorAll<HTMLButtonElement>('.btn-link-node').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.id!;
      const text = btn.dataset.text!;

      pluginBridge.selectNode(nodeId);
      setActiveTab('search');

      setTimeout(() => {
        triggerSearch(text.slice(0, 30));
      }, 50);
    });
  });

  // Unlink button handlers
  textList.querySelectorAll<HTMLButtonElement>('.btn-unlink-node').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.id!;
      pluginBridge.unlinkNode(nodeId);
    });
  });
}

function updateStatusText(text: string): void {
  getElementById('statusText').textContent = text;
}
