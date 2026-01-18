// Test setup - Figma API mocks

import { vi } from "vitest";

// Mock TextNode
export function createMockTextNode(overrides: Partial<TextNode> = {}): TextNode {
  const pluginData: Record<string, string> = {};

  return {
    id: "node-1",
    type: "TEXT",
    name: "Test Node",
    characters: "Test text",
    width: 100,
    height: 20,
    x: 0,
    y: 0,
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
    fontName: { family: "Inter", style: "Regular" },
    getPluginData: vi.fn((key: string) => pluginData[key] || ""),
    setPluginData: vi.fn((key: string, value: string) => {
      pluginData[key] = value;
    }),
    getRangeFontName: vi.fn(() => ({ family: "Inter", style: "Regular" })),
    ...overrides,
  } as unknown as TextNode;
}

// Mock Figma global
export function setupFigmaMock() {
  const mockFigma = {
    currentPage: {
      selection: [],
      findAll: vi.fn(() => []),
    },
    viewport: {
      center: { x: 0, y: 0 },
      scrollAndZoomIntoView: vi.fn(),
    },
    editorType: "figma",
    ui: {
      postMessage: vi.fn(),
    },
    showUI: vi.fn(),
    loadFontAsync: vi.fn().mockResolvedValue(undefined),
    createText: vi.fn(() => createMockTextNode()),
    getNodeByIdAsync: vi.fn().mockResolvedValue(null),
    notify: vi.fn(),
    mixed: Symbol("mixed"),
    on: vi.fn(),
  };

  // @ts-expect-error - Mocking global figma
  global.figma = mockFigma;

  return mockFigma;
}

// Sample translation data for tests
export const sampleApiData = [
  {
    id: 10001,
    status: "FINAL" as const,
    createdAt: "2024-01-15T10:30:00Z",
    modifiedAt: "2024-01-20T14:45:00Z",
    modifiedBy: "john.doe",
    multilanTextList: [
      { languageId: "en", wording: "Submit", id: 1, sourceLanguageId: "en" },
      { languageId: "fr", wording: "Soumettre", id: 2, sourceLanguageId: "en" },
      { languageId: "nl", wording: "Indienen", id: 3, sourceLanguageId: "en" },
      { languageId: "de", wording: "Einreichen", id: 4, sourceLanguageId: "en" },
    ],
  },
  {
    id: 10002,
    status: "DRAFT" as const,
    createdAt: "2024-02-01T09:00:00Z",
    modifiedAt: "2024-02-05T11:30:00Z",
    modifiedBy: "jane.smith",
    multilanTextList: [
      { languageId: "en", wording: "Cancel", id: 5, sourceLanguageId: "en" },
      { languageId: "fr", wording: "Annuler", id: 6, sourceLanguageId: "en" },
      { languageId: "nl", wording: "Annuleren", id: 7, sourceLanguageId: "en" },
      { languageId: "de", wording: "Abbrechen", id: 8, sourceLanguageId: "en" },
    ],
  },
  {
    id: 10003,
    status: "IN_TRANSLATION" as const,
    multilanTextList: [
      { languageId: "en", wording: "Hello ###username###", id: 9, sourceLanguageId: "en" },
      { languageId: "fr", wording: "Bonjour ###username###", id: 10, sourceLanguageId: "en" },
    ],
  },
];

export const sampleTranslationMap = {
  "10001": {
    en: "Submit",
    fr: "Soumettre",
    nl: "Indienen",
    de: "Einreichen",
  },
  "10002": {
    en: "Cancel",
    fr: "Annuler",
    nl: "Annuleren",
    de: "Abbrechen",
  },
  "10003": {
    en: "Hello ###username###",
    fr: "Bonjour ###username###",
  },
};
