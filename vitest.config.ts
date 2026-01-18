import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/plugin/services/**/*.ts",
        "src/shared/**/*.ts",
        "src/ui/**/*.ts",
      ],
      exclude: ["src/plugin/index.ts", "**/*.d.ts"],
    },
    environmentMatchGlobs: [
      // UI tests use jsdom
      ["tests/ui/**/*.test.ts", "jsdom"],
      // Plugin tests use node
      ["tests/plugin/**/*.test.ts", "node"],
    ],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
