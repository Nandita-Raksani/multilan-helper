import type { TraUploadMetadata } from '../../shared/types';
import { pluginBridge } from '../services/pluginBridge';

let modalEl: HTMLDivElement | null = null;

type LangCode = 'en' | 'fr' | 'nl' | 'de';

const LANGUAGES: { code: LangCode; label: string }[] = [
  { code: 'en', label: 'EN (English)' },
  { code: 'fr', label: 'FR (French)' },
  { code: 'nl', label: 'NL (Dutch)' },
  { code: 'de', label: 'DE (German)' },
];

// Map filenames to language codes
function detectLanguageFromFilename(filename: string): LangCode | null {
  const lower = filename.toLowerCase();
  if (lower.includes('en-') || lower.startsWith('en.') || lower === 'en.tra') return 'en';
  if (lower.includes('fr-') || lower.startsWith('fr.') || lower === 'fr.tra') return 'fr';
  if (lower.includes('nl-') || lower.startsWith('nl.') || lower === 'nl.tra') return 'nl';
  if (lower.includes('de-') || lower.startsWith('de.') || lower === 'de.tra') return 'de';
  return null;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (text.includes('\uFFFD')) {
        const reader2 = new FileReader();
        reader2.onload = () => resolve(reader2.result as string);
        reader2.onerror = () => reject(reader2.error);
        reader2.readAsText(file, 'windows-1252');
      } else {
        resolve(text);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    + ' at ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Tracked files mapped to languages
const fileMap: Map<LangCode, File> = new Map();

function renderFileList(): string {
  const items = LANGUAGES.map(lang => {
    const file = fileMap.get(lang.code);
    if (file) {
      return `<div class="tra-file-item tra-file-item-ok">
        <span class="tra-file-check">&#10003;</span>
        <span class="tra-file-name">${file.name}</span>
        <span class="tra-file-lang">${lang.label}</span>
      </div>`;
    }
    return `<div class="tra-file-item tra-file-item-missing">
      <span class="tra-file-check">&#8226;</span>
      <span class="tra-file-lang">${lang.label}</span>
      <span class="tra-file-name">not selected</span>
    </div>`;
  }).join('');

  const count = fileMap.size;
  const missing = LANGUAGES.filter(l => !fileMap.has(l.code)).map(l => l.code.toUpperCase());
  const validationText = count === 4
    ? '<span class="tra-validation-ok">All 4 languages selected</span>'
    : count > 0
      ? `<span class="tra-validation-info">${count} of 4 languages selected</span>`
      : '';

  return `<div class="tra-file-list">${items}</div><div class="tra-validation">${validationText}</div>`;
}

function processFiles(files: FileList | File[]): void {
  for (const file of Array.from(files)) {
    if (!file.name.toLowerCase().endsWith('.tra')) continue;
    const lang = detectLanguageFromFilename(file.name);
    if (lang) {
      fileMap.set(lang, file);
    }
  }
  updateModalState();
}

function updateModalState(): void {
  if (!modalEl) return;
  const listEl = modalEl.querySelector('.tra-file-status')!;
  listEl.innerHTML = renderFileList();

  const submitBtn = modalEl.querySelector<HTMLButtonElement>('.tra-upload-submit')!;
  submitBtn.disabled = fileMap.size < 1;
}

export function showTraUploadModal(folder: string, metadata?: TraUploadMetadata): void {
  hideTraUploadModal();
  fileMap.clear();

  const lastUploadedHtml = metadata
    ? `<div class="tra-upload-last">Last uploaded: ${formatDate(metadata.uploadTimestamp)}</div>`
    : '';

  modalEl = document.createElement('div');
  modalEl.className = 'variable-prompt-overlay';
  modalEl.innerHTML = `
    <div class="variable-prompt-modal tra-upload-modal">
      <div class="variable-prompt-title">Upload .tra files for ${folder}</div>
      ${lastUploadedHtml}
      <div class="tra-upload-hint">Drop all 4 .tra files at once or use the file picker</div>
      <div class="tra-drop-zone" id="traDropZone">
        <div class="tra-drop-icon">&#128194;</div>
        <div class="tra-drop-text">Drop .tra files here</div>
        <div class="tra-drop-or">or</div>
        <label class="btn-sm btn-sm-outline tra-drop-btn">
          Choose files
          <input type="file" accept=".tra" multiple class="tra-drop-file-input" />
        </label>
      </div>
      <div class="tra-file-status">${renderFileList()}</div>
      <div class="variable-prompt-actions">
        <button class="btn-sm btn-sm-outline tra-upload-cancel">Cancel</button>
        <button class="btn-sm btn-sm-success tra-upload-submit" disabled>Upload</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  const dropZone = modalEl.querySelector<HTMLDivElement>('#traDropZone')!;
  const fileInput = modalEl.querySelector<HTMLInputElement>('.tra-drop-file-input')!;
  const submitBtn = modalEl.querySelector<HTMLButtonElement>('.tra-upload-submit')!;

  // Drag & drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('tra-drop-zone-active');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('tra-drop-zone-active');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('tra-drop-zone-active');
    if (e.dataTransfer?.files) {
      processFiles(e.dataTransfer.files);
    }
  });

  // File input handler
  fileInput.addEventListener('change', () => {
    if (fileInput.files) {
      processFiles(fileInput.files);
    }
  });

  // Cancel
  modalEl.querySelector('.tra-upload-cancel')!.addEventListener('click', () => {
    hideTraUploadModal();
  });
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) hideTraUploadModal();
  });

  // Submit
  submitBtn.addEventListener('click', async () => {
    if (fileMap.size < 1) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
      const traFileData: { en: string; fr: string; nl: string; de: string } = { en: '', fr: '', nl: '', de: '' };
      const fileLastModified: { en: number; fr: number; nl: number; de: number } = { en: 0, fr: 0, nl: 0, de: 0 };

      for (const [lang, file] of fileMap.entries()) {
        traFileData[lang] = await readFileAsText(file);
        fileLastModified[lang] = file.lastModified;
      }

      const uploadMetadata: TraUploadMetadata = {
        uploadTimestamp: Date.now(),
        fileLastModified,
        availableLanguages: Array.from(fileMap.keys()),
      };

      pluginBridge.uploadTraFiles(folder, traFileData, uploadMetadata);
      // Don't close modal here — wait for 'upload-success' message
    } catch (error) {
      submitBtn.textContent = 'Upload';
      submitBtn.disabled = false;
      console.error('Failed to read .tra files:', error);
    }
  });
}

export function hideTraUploadModal(): void {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
  fileMap.clear();
}
