// Real-browser tests. `npx playwright install` once, then `npm run test:e2e`.
// Set ALL_BROWSERS=1 to add Firefox and WebKit (nightly CI does). CHROMIUM_PATH lets you use an existing Chromium.
import { defineConfig, devices } from '@playwright/test';

const custom = process.env.CHROMIUM_PATH;
const chromiumLaunch = custom
  ? { executablePath: custom, args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-zygote', '--in-process-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
  : {};
// Playwright hides scrollbars by default; the app promises always-visible scrollbars, so keep real ones.
const launchOptions = { ...chromiumLaunch, ignoreDefaultArgs: ['--hide-scrollbars'] };
const desktop = { viewport: { width: 1400, height: 900 }, launchOptions, colorScheme: 'light', locale: 'en-US' };

const projects = [
  { name: 'chromium', testIgnore: /touch\.spec\.js/, use: { ...devices['Desktop Chrome'], ...desktop } },
  { name: 'mobile-chromium', testMatch: /touch\.spec\.js/, use: { ...devices['Pixel 5'], launchOptions, colorScheme: 'light', locale: 'en-US' } },
];
if (process.env.ALL_BROWSERS) {
  projects.push({ name: 'firefox', testIgnore: /touch\.spec\.js|print\.spec\.js/, use: { ...devices['Desktop Firefox'], viewport: desktop.viewport, locale: 'en-US' } });
  projects.push({ name: 'webkit', testIgnore: /touch\.spec\.js|print\.spec\.js/, use: { ...devices['Desktop Safari'], viewport: desktop.viewport, locale: 'en-US' } });
}

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.js/,
  timeout: 60000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/e2e/serve.js', port: 4173, reuseExistingServer: !process.env.CI },
  projects,
});
