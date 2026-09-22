import { defineConfig } from "vitest/config";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
export default defineConfig({
  test: { fileParallelism: false, testTimeout: 20000 },
});
