import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Tests wipe tables, so they only ever run against the separate test database branch.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL (e.g. in api/.env.test) to a disposable database branch.");
}

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      DIRECT_URL: process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL,
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
