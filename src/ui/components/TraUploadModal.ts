import type { TraUploadMetadata } from '../../shared/types';
import { pluginBridge } from '../services/pluginBridge';
import { showToast } from './Toast';
import { unzipSync } from 'fflate';

let modalEl: HTMLDivElement | null = null;

import type { Language } from '../../shared/types';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN (English)' },
  { code: 'fr', label: 'FR (French)' },
  { code: 'nl', label: 'NL (Dutch)' },
  { code: 'de', label: 'DE (German)' },
];

// Map filenames to language codes
function detectLanguageFromFilename(filename: string): Language | null {
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

function formatReleaseDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Tracked files mapped to languages
const languageFileMap: Map<Language, File> = new Map();
let sourceZipName: string | null = null;

function parseReleaseDateFromZipName(name: string): number | undefined {
  try {
    const m = name.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return undefined;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    const t = Date.UTC(year, month - 1, day);
    if (Number.isNaN(t)) return undefined;
    const d = new Date(t);
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      return undefined;
    }
    return t;
  } catch {
    return undefined;
  }
}

function renderFileList(): string {
  const items = LANGUAGES.map(lang => {
    const file = languageFileMap.get(lang.code);
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

  const count = languageFileMap.size;
  const missing = LANGUAGES.filter(l => !languageFileMap.has(l.code)).map(l => l.code.toUpperCase());
  const validationText = count === 4
    ? '<span class="tra-validation-ok">All 4 languages selected</span>'
    : count > 0
      ? `<span class="tra-validation-info">${count} of 4 languages selected</span>`
      : '';

  return `<div class="tra-file-list">${items}</div><div class="tra-validation">${validationText}</div>`;
}

function extractTraFilesFromZip(file: File): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const zipData = new Uint8Array(reader.result as ArrayBuffer);
        const entries = unzipSync(zipData);
        const traFiles: File[] = [];
        for (const [path, data] of Object.entries(entries)) {
          const name = path.split('/').pop() || path;
          if (name.toLowerCase().endsWith('.tra')) {
            traFiles.push(new File([data], name, { lastModified: file.lastModified }));
          }
        }
        resolve(traFiles);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

async function processFiles(files: FileList | File[]): Promise<void> {
  const incoming = Array.from(files);
  const rejected = incoming.filter(f => !f.name.toLowerCase().endsWith('.zip'));
  for (const file of incoming) {
    if (!file.name.toLowerCase().endsWith('.zip')) continue;
    const traFiles = await extractTraFilesFromZip(file);
    for (const traFile of traFiles) {
      const lang = detectLanguageFromFilename(traFile.name);
      if (lang) languageFileMap.set(lang, traFile);
    }
    sourceZipName = file.name;
  }
  if (rejected.length > 0) {
    const hasTra = rejected.some(f => f.name.toLowerCase().endsWith('.tra'));
    const message = hasTra
      ? 'Please upload the original .zip file, not the individual .tra files.'
      : 'Only .zip files are supported.';
    showRejectionWarning(message);
    showToast(message, 'error');
  } else {
    showRejectionWarning(null);
  }
  updateModalState();
}

function showRejectionWarning(message: string | null): void {
  if (!modalEl) return;
  const warnEl = modalEl.querySelector<HTMLDivElement>('.tra-drop-warning');
  if (!warnEl) return;
  warnEl.textContent = message ?? '';
  warnEl.style.display = message ? '' : 'none';
}

function updateModalState(): void {
  if (!modalEl) return;
  const listEl = modalEl.querySelector('.tra-file-status')!;
  listEl.innerHTML = renderFileList();

  const selectedEl = modalEl.querySelector<HTMLDivElement>('.tra-selected-zip');
  if (selectedEl) {
    selectedEl.textContent = sourceZipName ? `Selected: ${sourceZipName}` : '';
    selectedEl.style.display = sourceZipName ? '' : 'none';
  }

  const submitBtn = modalEl.querySelector<HTMLButtonElement>('.tra-upload-submit')!;
  submitBtn.disabled = languageFileMap.size < 1;
}

export function showTraUploadModal(folder: string, metadata?: TraUploadMetadata): void {
  hideTraUploadModal();
  languageFileMap.clear();
  sourceZipName = null;

  const lastUploadedHtml = metadata
    ? `<div class="tra-upload-last">Last uploaded: ${formatDate(metadata.uploadTimestamp)}${
        metadata.sourceZipName ? ` &middot; from ${metadata.sourceZipName}` : ''
      }${
        metadata.releaseDate ? ` &middot; release ${formatReleaseDate(metadata.releaseDate)}` : ''
      }</div>`
    : '';

  modalEl = document.createElement('div');
  modalEl.className = 'variable-prompt-overlay';
  modalEl.innerHTML = `
    <div class="variable-prompt-modal tra-upload-modal">
      <div class="variable-prompt-title">Upload .zip of .tra files for ${folder}</div>
      ${lastUploadedHtml}
      <div class="tra-upload-hint">Drop a .zip file containing the .tra files</div>
      <div class="tra-drop-zone" id="traDropZone">
        <div class="tra-drop-icon">&#128194;</div>
        <div class="tra-drop-text">Drop .zip file here</div>
        <div class="tra-drop-or">or</div>
        <label class="btn-sm btn-sm-outline tra-drop-btn">
          Choose .zip file
          <input type="file" accept=".zip" class="tra-drop-file-input" />
        </label>
      </div>
      <div class="tra-drop-warning" style="display:none; color:#d73a49; font-size:12px; margin-top:8px;"></div>
      <div class="tra-selected-zip" style="display:none"></div>
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
    if (languageFileMap.size < 1) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
      const traFileData: { en: string; fr: string; nl: string; de: string } = { en: '', fr: '', nl: '', de: '' };
      const fileLastModified: { en: number; fr: number; nl: number; de: number } = { en: 0, fr: 0, nl: 0, de: 0 };

      for (const [lang, file] of languageFileMap.entries()) {
        traFileData[lang] = await readFileAsText(file);
        fileLastModified[lang] = file.lastModified;
      }

      const uploadMetadata: TraUploadMetadata = {
        uploadTimestamp: Date.now(),
        fileLastModified,
        availableLanguages: Array.from(languageFileMap.keys()),
      };
      if (sourceZipName) {
        uploadMetadata.sourceZipName = sourceZipName;
        const parsed = parseReleaseDateFromZipName(sourceZipName);
        if (parsed !== undefined) uploadMetadata.releaseDate = parsed;
      }

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
  languageFileMap.clear();
  sourceZipName = null;
}
