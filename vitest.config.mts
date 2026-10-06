import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "apps/web") },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/lib/**/*.test.ts"],
    environment: "node",
  },
});
