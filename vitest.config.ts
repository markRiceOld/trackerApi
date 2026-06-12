import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./src/test/globalSetup.ts",
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      JWT_SECRET: "test-secret-key",
    },
    // Serialize test files to avoid concurrent SQLite writes
    fileParallelism: false,
  },
});
