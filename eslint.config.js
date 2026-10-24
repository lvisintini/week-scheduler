import js from '@eslint/js';
import globals from 'globals';

// Page-level names that the end-to-end tests and the pictures of How to use use inside page.evaluate(() => …), where they run in the app's own page.
const appGlobals = Object.fromEntries(['state', 'cw', 'render', 'hist', 'parseData', 'parseWorkspace', 'buildFile', 'seal', 'unseal', 'hrA', 'hrB', 'renderSide', 'savePrefs', 'applyPrefs', 'applyTheme', 'saveMem', 'addWorkspace', 'printSchedule', 'openDlg', 'openCopy', 'openSettings', 'openStats', 'openAgenda', 'openRhythmAgenda', 'anyDirty', 'setLive', 'setFocus', 'today', 'lvOpen', 'DAYS', 'setWeek', 'openCycle', 'askLiveWeek', 'dayPage', 'setAllWk', 'newWs', 'defaultData', 'openPeopleCopy', 'setLang', 'openExamples'].map(n => [n, 'writable']));

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/', 'index.html'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.mjs'], ignores: ['js/**'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } }, rules: { 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
  // the app: ES modules in a browser; a name used but not imported (no-undef) or an assignment to an imported name (no-import-assign) is an error
  { files: ['js/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } }, rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
  { files: ['tests/e2e/**/*.js', 'tests/shots/**/*.js'], languageOptions: { globals: { ...globals.browser, ...appGlobals } } },
];
