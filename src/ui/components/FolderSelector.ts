import { store } from '../state/store';
import { pluginBridge } from '../services/pluginBridge';
import { getElementById } from '../utils/dom';

export function initFolderSelector(): void {
  const folderBar = getElementById('folderBar');
  folderBar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.folder-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const folder = btn.dataset.folder;
    if (!folder || folder === store.getState().currentFolder) return;

    setActiveFolder(folder);
    store.setState({ currentFolder: folder });
    pluginBridge.switchFolder(folder);
  });
}

export function renderFolderButtons(folders: string[], active: string): void {
  const section = getElementById('folderSelectorSection');
  const folderBar = getElementById('folderBar');

  if (folders.length <= 1) {
    section.style.display = 'none';
    return;
  }

  folderBar.innerHTML = folders.map(f =>
    `<button class="folder-btn${f === active ? ' active' : ''}" data-folder="${f}">${f}</button>`
  ).join('');

  section.style.display = '';
}

export function setActiveFolder(folder: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.folder-btn');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.folder === folder);
  });
}
