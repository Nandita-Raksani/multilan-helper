// UI Test Setup - HTML fixtures and helpers
import { vi } from "vitest";

/**
 * Set up the full UI HTML structure for component tests
 */
export function setupUIFixture(): void {
  document.body.innerHTML = `
    <div id="app">
      <!-- View Mode Banner -->
      <div id="viewModeBanner" class="view-mode-banner" style="display: none;">
        View Mode - You can preview translations but cannot edit
      </div>

      <!-- Language Bar -->
      <div class="lang-bar">
        <button class="lang-btn" data-lang="en">EN</button>
        <button class="lang-btn" data-lang="fr">FR</button>
        <button class="lang-btn" data-lang="nl">NL</button>
        <button class="lang-btn" data-lang="de">DE</button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <div class="tab active" data-tab="search">Search</div>
        <div class="tab" data-tab="texts">Links</div>
        <div class="tab" data-tab="settings">Settings</div>
      </div>

      <!-- Search Panel -->
      <div id="searchPanel" class="panel active">
        <div id="searchSelectedNode" class="selected-node" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 11px;">Selected</h4>
            <span id="searchSelectedBadge" class="text-item-id"></span>
          </div>
          <div id="searchSelectedText" class="selected-node-text" style="margin-top: 4px;"></div>
          <div id="searchSelectedActions" class="btn-row" style="margin-top: 8px;"></div>
        </div>

        <input type="text" class="search-panel-input" id="globalSearchInput" placeholder="Search by ID or text...">
        <div class="search-hint">Search translations, then Copy, Link, or Create text nodes.</div>
        <div id="globalSearchResultsCount" class="search-results-count"></div>
        <div id="globalSearchResults"></div>

        <div id="searchPlaceholderSection" class="create-section" style="display: none;">
          <h4>No results? Create placeholder:</h4>
          <input type="text" class="search-box" id="searchPlaceholderText" placeholder="Enter placeholder text...">
          <div class="btn-row">
            <button class="btn btn-primary" id="searchMarkPlaceholderBtn">Mark as Placeholder</button>
          </div>
        </div>
      </div>

      <!-- Texts Panel -->
      <div id="textsPanel" class="panel">
        <div class="texts-header">
          <div class="scope-toggle">
            <button class="scope-btn active" data-scope="page">Entire Page</button>
            <button class="scope-btn" data-scope="selection">Selection</button>
          </div>
          <button class="btn btn-secondary btn-auto-link" id="autoLinkBtn">Auto-Link All</button>
        </div>
        <input type="text" class="search-box" id="textSearch" placeholder="Filter texts...">
        <div id="textList" class="text-list">
          <div class="empty-state">Loading...</div>
        </div>
      </div>

      <!-- Settings Panel -->
      <div id="settingsPanel" class="panel">
        <h3 style="margin-bottom: 12px;">Placeholder Values</h3>
        <div id="placeholderSettings">
          <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 4px;">username</label>
            <input type="text" class="search-box" data-placeholder="username" value="John" style="margin-bottom: 0;">
          </div>
          <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 4px;">count</label>
            <input type="text" class="search-box" data-placeholder="count" value="5" style="margin-bottom: 0;">
          </div>
        </div>
      </div>

      <!-- Bulk Auto-Link Modal -->
      <div id="bulkLinkModal" class="modal-overlay">
        <div class="modal">
          <h3>Auto-Link Results</h3>
          <div id="bulkLinkSummary" class="summary-stats"></div>
          <div id="bulkLinkContent"></div>
          <div class="btn-row">
            <button class="btn btn-secondary" id="closeBulkModal">Close</button>
            <button class="btn btn-primary" id="applyExactMatches" style="display: none;">Apply Exact Matches</button>
          </div>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="status-bar">
        <span id="statusText">Ready</span>
        <span id="buildTimestamp" style="float: right; opacity: 0.7;"></span>
      </div>
    </div>
  `;
}

/**
 * Mock parent.postMessage for plugin communication
 */
export function mockParentPostMessage(): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  vi.stubGlobal("parent", { postMessage: mock });
  return mock;
}

/**
 * Reset store to default state
 */
export function resetStore(): void {
  // Import store dynamically to avoid circular dependencies
  import("../../src/ui/state/store").then(({ store }) => {
    store.setState({
      canEdit: true,
      currentLang: "en",
      scope: "page",
      textNodes: [],
      selectedNode: null,
      placeholders: { username: "John", count: "5" },
      bulkLinkResults: null,
      globalSearchResults: [],
      allTranslations: [],
    });
  });
}

/**
 * Sample text node info for tests
 */
export const sampleTextNodes = [
  {
    id: "node-1",
    name: "Submit Button",
    characters: "Submit",
    multilanId: "10001",
    translations: { en: "Submit", fr: "Soumettre" },
    hasOverflow: false,
    isPlaceholder: false,
  },
  {
    id: "node-2",
    name: "Cancel Button",
    characters: "Cancel",
    multilanId: null,
    translations: null,
    hasOverflow: false,
    isPlaceholder: false,
  },
  {
    id: "node-3",
    name: "Placeholder Text",
    characters: "TBD",
    multilanId: "placeholder_1",
    translations: null,
    hasOverflow: false,
    isPlaceholder: true,
  },
];

/**
 * Sample search results for tests
 */
export const sampleSearchResults = [
  {
    multilanId: "10001",
    translations: { en: "Submit", fr: "Soumettre", nl: "Indienen", de: "Einreichen" },
  },
  {
    multilanId: "10002",
    translations: { en: "Cancel", fr: "Annuler", nl: "Annuleren", de: "Abbrechen" },
  },
];

/**
 * Sample search results with variables for tests
 */
export const sampleSearchResultsWithVariables = [
  {
    multilanId: "20001",
    translations: { en: "Hello ###username###!", fr: "Bonjour ###username###!" },
    variableOccurrences: [
      { name: "username", key: "username", index: 1, isIndexed: false },
    ],
  },
];

/**
 * Sample bulk link results for tests
 */
export const sampleBulkLinkResults = {
  exactMatches: [
    { nodeId: "node-1", nodeName: "Button", text: "Submit", multilanId: "10001" },
  ],
  fuzzyMatches: [
    {
      nodeId: "node-2",
      nodeName: "Label",
      text: "Submit Now",
      suggestions: [
        { multilanId: "10001", translations: { en: "Submit" }, score: 0.7 },
      ],
    },
  ],
  unmatched: [
    { nodeId: "node-3", nodeName: "Random", text: "xyz123" },
  ],
};
