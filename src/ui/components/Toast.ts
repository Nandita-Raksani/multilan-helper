let toastEl: HTMLDivElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: 'success' | 'error' = 'success', duration = 4000): void {
  // Remove existing toast
  if (toastEl) {
    toastEl.remove();
    toastEl = null;
  }
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);

  // Trigger slide-up animation
  requestAnimationFrame(() => {
    if (toastEl) toastEl.classList.add('toast-visible');
  });

  toastTimer = setTimeout(() => {
    if (toastEl) {
      toastEl.classList.remove('toast-visible');
      toastEl.addEventListener('transitionend', () => {
        if (toastEl) {
          toastEl.remove();
          toastEl = null;
        }
      }, { once: true });
    }
    toastTimer = null;
  }, duration);
}
