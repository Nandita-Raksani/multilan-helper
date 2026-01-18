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
    multilanTextList: [
      { languageId: "en", wording: "Submit", id: 1 },
      { languageId: "fr", wording: "Soumettre", id: 2 },
      { languageId: "nl", wording: "Indienen", id: 3 },
      { languageId: "de", wording: "Einreichen", id: 4 },
    ],
  },
  {
    id: 10002,
    multilanTextList: [
      { languageId: "en", wording: "Cancel", id: 5 },
      { languageId: "fr", wording: "Annuler", id: 6 },
      { languageId: "nl", wording: "Annuleren", id: 7 },
      { languageId: "de", wording: "Abbrechen", id: 8 },
    ],
  },
  {
    id: 10003,
    multilanTextList: [
      { languageId: "en", wording: "Hello {username}", id: 9 },
      { languageId: "fr", wording: "Bonjour {username}", id: 10 },
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
    en: "Hello {username}",
    fr: "Bonjour {username}",
  },
};
