import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/app/**/*.test.js', 'tests/security/**/*.test.js', 'tests/requirements.test.js'],
    testTimeout: 60000,
    hookTimeout: 60000,
    reporters: ['verbose'],
  },
});
