import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:43123',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:43123',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'phone',
      testMatch: 'phone.spec.ts',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'tall',
      testMatch: 'tall.spec.ts',
      use: { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'desktop',
      testMatch: 'desktop.spec.ts',
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
})
