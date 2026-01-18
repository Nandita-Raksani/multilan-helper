import type { Language, PluginMessage } from '../../shared/types';

type MessageHandler = (message: PluginMessage) => void;

class PluginBridge {
  private handlers: Set<MessageHandler> = new Set();

  constructor() {
    window.addEventListener('message', (event) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      this.handlers.forEach(handler => handler(msg));
    });
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(message: PluginMessage): void {
    parent.postMessage({ pluginMessage: message }, '*');
  }

  // Convenience methods for common operations
  init(): void {
    this.send({ type: 'init' });
  }

  refresh(scope: 'page' | 'selection'): void {
    this.send({ type: 'refresh', scope });
  }

  switchLanguage(language: Language, scope: 'page' | 'selection', placeholders: Record<string, string>): void {
    this.send({
      type: 'switch-language',
      language,
      scope,
      placeholders
    });
  }

  globalSearch(query: string): void {
    this.send({
      type: 'global-search',
      searchQuery: query
    });
  }

  linkNode(nodeId: string, multilanId: string, language: Language): void {
    this.send({
      type: 'link-node',
      nodeId,
      multilanId,
      language
    });
  }

  unlinkNode(nodeId: string): void {
    this.send({
      type: 'unlink-node',
      nodeId
    });
  }

  selectNode(nodeId: string): void {
    this.send({
      type: 'select-node',
      nodeId
    });
  }

  createLinkedText(multilanId: string, text: string, language: Language): void {
    this.send({
      type: 'create-linked-text',
      multilanId,
      text,
      language
    });
  }

  markAsPlaceholder(text: string): void {
    this.send({
      type: 'mark-as-placeholder',
      text
    });
  }

  bulkAutoLink(scope: 'page' | 'selection'): void {
    this.send({
      type: 'bulk-auto-link',
      scope
    });
  }

  applyExactMatches(confirmations: Array<{ nodeId: string; multilanId: string }>, scope: 'page' | 'selection'): void {
    this.send({
      type: 'apply-exact-matches',
      confirmations,
      scope
    });
  }

  confirmFuzzyLink(nodeId: string, multilanId: string): void {
    this.send({
      type: 'confirm-fuzzy-link',
      nodeId,
      multilanId
    });
  }
}

export const pluginBridge = new PluginBridge();
