import { store } from '../state/store';
import { querySelectorAll } from '../utils/dom';

export function initSettingsPanel(): void {
  const placeholderInputs = querySelectorAll<HTMLInputElement>('[data-placeholder]');

  placeholderInputs.forEach(input => {
    input.addEventListener('input', () => {
      const state = store.getState();
      store.setState({
        placeholders: {
          ...state.placeholders,
          [input.dataset.placeholder!]: input.value
        }
      });
    });
  });
}
