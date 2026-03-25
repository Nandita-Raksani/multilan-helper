import { pluginBridge } from '../services/pluginBridge';

let modalEl: HTMLDivElement | null = null;

const LANGUAGES = [
  { code: 'en', label: 'EN (English)' },
  { code: 'fr', label: 'FR (French)' },
  { code: 'nl', label: 'NL (Dutch)' },
  { code: 'de', label: 'DE (German)' },
] as const;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let text = reader.result as string;
      // If replacement characters found, file is likely Windows-1252 encoded
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

export function showTraUploadModal(folder: string): void {
  hideTraUploadModal();

  modalEl = document.createElement('div');
  modalEl.className = 'variable-prompt-overlay';
  modalEl.innerHTML = `
    <div class="variable-prompt-modal tra-upload-modal">
      <div class="variable-prompt-title">Upload .tra files for ${folder}</div>
      <div class="tra-upload-hint">Select one .tra file for each language</div>
      <div class="tra-upload-fields">
        ${LANGUAGES.map(lang => `
          <div class="tra-upload-row">
            <label class="tra-upload-label">${lang.label}</label>
            <div class="tra-upload-input-wrap">
              <input type="file" accept=".tra" class="tra-upload-file-input" data-lang="${lang.code}" id="tra-file-${lang.code}" />
              <label for="tra-file-${lang.code}" class="tra-upload-file-btn btn-sm btn-sm-outline">Choose file</label>
              <span class="tra-upload-filename" data-lang="${lang.code}">No file chosen</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="variable-prompt-actions">
        <button class="btn-sm btn-sm-outline tra-upload-cancel">Cancel</button>
        <button class="btn-sm btn-sm-success tra-upload-submit" disabled>Upload</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  const fileInputs = modalEl.querySelectorAll<HTMLInputElement>('.tra-upload-file-input');
  const submitBtn = modalEl.querySelector<HTMLButtonElement>('.tra-upload-submit')!;

  const updateSubmitState = () => {
    const allSelected = Array.from(fileInputs).every(input => input.files && input.files.length > 0);
    submitBtn.disabled = !allSelected;
  };

  // File input change handlers
  fileInputs.forEach(input => {
    input.addEventListener('change', () => {
      const lang = input.dataset.lang!;
      const filenameEl = modalEl!.querySelector<HTMLSpanElement>(`.tra-upload-filename[data-lang="${lang}"]`)!;
      if (input.files && input.files.length > 0) {
        filenameEl.textContent = input.files[0].name;
        filenameEl.classList.add('tra-upload-filename-selected');
      } else {
        filenameEl.textContent = 'No file chosen';
        filenameEl.classList.remove('tra-upload-filename-selected');
      }
      updateSubmitState();
    });
  });

  // Cancel handler
  modalEl.querySelector('.tra-upload-cancel')!.addEventListener('click', () => {
    hideTraUploadModal();
  });

  // Close on overlay click
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) hideTraUploadModal();
  });

  // Submit handler
  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Reading files...';

    try {
      const traFileData: { en: string; fr: string; nl: string; de: string } = { en: '', fr: '', nl: '', de: '' };

      for (const input of Array.from(fileInputs)) {
        const lang = input.dataset.lang as 'en' | 'fr' | 'nl' | 'de';
        const file = input.files![0];
        traFileData[lang] = await readFileAsText(file);
      }

      pluginBridge.uploadTraFiles(folder, traFileData);
      hideTraUploadModal();
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
}
