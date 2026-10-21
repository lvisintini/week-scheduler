import js from '@eslint/js';
import globals from 'globals';

// Page-level names that the end-to-end tests use inside page.evaluate(() => …), where they run in the app's own page.
const appGlobals = Object.fromEntries(['S', 'cw', 'render', 'parseData', 'parseWorkspace', 'buildFile', 'seal', 'unseal', 'vs', 'HH', 'prefs', 'savePrefs', 'applyPrefs', 'applyTheme', 'saveMem', 'addWorkspace', 'printSchedule', 'openDlg', 'openCopy', 'openSettings', 'openStats', 'openAgenda', 'openRhythmAgenda', 'anyDirty', 'WS', 'setLive', 'setFocus', 'focusD', 'today', 'lvOpen', 'DAYS', 'curWk', 'setWeek', 'openCycle'].map(n => [n, 'writable']));

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/', 'index.html'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } }, rules: { 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
  { files: ['tests/e2e/**/*.js'], languageOptions: { globals: { ...globals.browser, ...appGlobals } } },
];
