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

  switchLanguage(language: Language, scope: 'page' | 'selection'): void {
    this.send({
      type: 'switch-language',
      language,
      scope
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

  detectMatch(text: string): void {
    this.send({
      type: 'detect-match',
      text
    });
  }

  getUnlinkedQueue(scope: 'page' | 'selection'): void {
    this.send({
      type: 'get-unlinked-queue',
      scope
    });
  }

  highlightUnlinked(highlight: boolean, scope: 'page' | 'selection'): void {
    this.send({
      type: 'highlight-unlinked',
      highlight,
      scope
    });
  }

}

export const pluginBridge = new PluginBridge();
