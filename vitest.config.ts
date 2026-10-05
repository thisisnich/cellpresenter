import { defineConfig } from "vitest/config";

// Unit tests for pure frontend logic (domain, i18n, routing). No DOM needed.
export default defineConfig({
  test: {
    include: ["app/src/**/*.test.ts"],
  },
});
