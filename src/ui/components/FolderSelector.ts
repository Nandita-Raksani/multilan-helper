import type { FolderDataStatus, TraUploadMetadata } from '../../shared/types';
import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById } from '../utils/dom';
import { showTraUploadModal } from './TraUploadModal';

function formatDateShort(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function initFolderSelector(): void {
  const folderBar = getElementById('folderBar');
  folderBar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.folder-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const folder = btn.dataset.folder;
    if (!folder) return;

    const state = store.getState();
    const folderStatus = state.folderDataStatus[folder];

    if (folderStatus?.hasData) {
      // Folder has data — if it's the same folder, show re-upload modal
      if (folder === state.currentFolder) {
        showTraUploadModal(folder, folderStatus.metadata);
        return;
      }
      // Different folder with data — switch to it
      setActiveFolder(folder);
      store.setState({ currentFolder: folder });
      pluginBridge.switchFolder(folder);
    } else {
      // No data — show upload modal
      showTraUploadModal(folder);
    }
  });
}

export function renderFolderButtons(folders: string[], active: string | null, folderDataStatus?: FolderDataStatus): void {
  const section = getElementById('folderSelectorSection');
  const folderBar = getElementById('folderBar');

  if (folders.length <= 1) {
    section.style.display = 'none';
    return;
  }

  const status = folderDataStatus || store.getState().folderDataStatus;

  folderBar.innerHTML = folders.map(f => {
    const isActive = f === active;
    const hasData = status[f]?.hasData || false;
    const metadata: TraUploadMetadata | undefined = status[f]?.metadata;
    const tooltip = hasData && metadata
      ? `Last uploaded: ${formatDateShort(metadata.uploadTimestamp)}${
          metadata.sourceZipName ? ` (from ${metadata.sourceZipName})` : ''
        }`
      : 'Click to upload .tra files';
    const classes = [
      'folder-btn',
      isActive ? 'active' : '',
      hasData ? 'folder-btn-has-data' : 'folder-btn-empty',
    ].filter(Boolean).join(' ');

    return `<button class="${classes}" data-folder="${f}" title="${tooltip}">${f}${hasData ? '<span class="folder-btn-dot"></span>' : ''}</button>`;
  }).join('');

  section.style.display = '';
}

export function setActiveFolder(folder: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.folder-btn');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.folder === folder);
  });
}
