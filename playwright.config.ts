import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  reporter: "list",
  timeout: 60000,
});
