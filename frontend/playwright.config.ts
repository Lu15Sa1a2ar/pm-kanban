import { defineConfig, devices } from "@playwright/test";

const integrated = process.env.INTEGRATED_E2E === "true";

export default defineConfig({
  testDir: integrated ? "./tests/integrated" : "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: integrated ? "http://127.0.0.1:8000" : "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  ...(integrated
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
