import { defineConfig } from "vitest/config";
import path from "path";
import { existsSync, readFileSync } from "fs";

// Only set envDir if .env.local doesn't exist or is accessible
// This prevents permission errors when the file exists but isn't readable
let envDir = ".";
try {
  if (existsSync(".env.local")) {
    // File exists, try to read it to check permissions
    readFileSync(".env.local");
  }
} catch {
  // If we can't read .env.local, use a directory that doesn't have it
  envDir = path.resolve(__dirname, "src");
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    passWithNoTests: true,
  },
  envDir,
  envPrefix: ["VITE_", "VITEST_"],
  resolve: {
    alias: {
      "ponder:api": path.resolve(__dirname, "./src/mocks/ponder-api.ts"),
      "ponder:schema": path.resolve(__dirname, "./src/mocks/ponder-schema.ts"),
    },
  },
});
