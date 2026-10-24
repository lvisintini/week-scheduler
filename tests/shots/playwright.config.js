// The pictures of How to use (R-UI-17): `npm run shots` takes them again, from the Examples workspace (R-DATA-12), into img/help/<language>/.
// Not part of the test suites (the e2e configuration only looks in tests/e2e); run it after a change that alters what the pictures show.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /shots\.spec\.js/,
  timeout: 120000,
  workers: 1,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173', viewport: { width: 1900, height: 1100 }, deviceScaleFactor: 1, colorScheme: 'light' },
  webServer: { command: 'node tests/e2e/serve.js', cwd: '../..', port: 4173, reuseExistingServer: true },
});
