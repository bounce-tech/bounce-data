import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "ponder:api": path.resolve(__dirname, "./src/mocks/ponder-api.ts"),
      "ponder:schema": path.resolve(__dirname, "./src/mocks/ponder-schema.ts"),
    },
  },
});
