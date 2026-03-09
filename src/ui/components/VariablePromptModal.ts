import type { Language } from '../../shared/types';
import { pluginBridge } from '../services/pluginBridge';
import { escapeHtml } from '../utils/dom';

let modalEl: HTMLDivElement | null = null;

interface VariablePromptOptions {
  nodeId: string;
  multilanId: string;
  language: Language;
  variableNames: string[];
  translationTemplate: string;
}

export function showVariablePrompt(options: VariablePromptOptions): void {
  hideVariablePrompt();

  const { nodeId, multilanId, language, variableNames, translationTemplate } = options;

  // Highlight variables in the template preview
  const templatePreview = escapeHtml(translationTemplate).replace(
    /###([^#]+)###/g,
    '<span class="var-highlight">###$1###</span>'
  );

  modalEl = document.createElement('div');
  modalEl.className = 'variable-prompt-overlay';
  modalEl.innerHTML = `
    <div class="variable-prompt-modal">
      <div class="variable-prompt-title">Enter variable values</div>
      <div class="variable-prompt-preview">${templatePreview}</div>
      <div class="variable-prompt-fields">
        ${variableNames.map(name => `
          <div class="variable-prompt-field">
            <label class="variable-prompt-label">${escapeHtml(name)}</label>
            <input type="text" class="variable-prompt-input" data-var="${escapeHtml(name)}" placeholder="Enter value for ${escapeHtml(name)}" />
          </div>
        `).join('')}
      </div>
      <div class="variable-prompt-actions">
        <button class="btn-sm btn-sm-outline variable-prompt-cancel">Cancel</button>
        <button class="btn-sm btn-sm-success variable-prompt-submit">Apply &amp; Link</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Focus first input
  const firstInput = modalEl.querySelector<HTMLInputElement>('.variable-prompt-input');
  if (firstInput) firstInput.focus();

  // Cancel handler
  modalEl.querySelector('.variable-prompt-cancel')!.addEventListener('click', () => {
    hideVariablePrompt();
  });

  // Close on overlay click
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) hideVariablePrompt();
  });

  // Submit handler
  const submit = () => {
    const inputs = modalEl!.querySelectorAll<HTMLInputElement>('.variable-prompt-input');
    const variables: Record<string, string> = {};
    let allFilled = true;

    inputs.forEach(input => {
      const varName = input.dataset.var!;
      const value = input.value.trim();
      if (!value) {
        allFilled = false;
        input.classList.add('variable-prompt-input-error');
      } else {
        input.classList.remove('variable-prompt-input-error');
      }
      variables[varName] = value;
    });

    if (!allFilled) return;

    pluginBridge.linkNodeWithVariables(nodeId, multilanId, language, variables);
    hideVariablePrompt();
  };

  modalEl.querySelector('.variable-prompt-submit')!.addEventListener('click', submit);

  // Enter key submits
  modalEl.querySelectorAll<HTMLInputElement>('.variable-prompt-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });
}

export function hideVariablePrompt(): void {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}
