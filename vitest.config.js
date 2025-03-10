import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    includeSource: ['src/**/*.js', 'src-ts/**/*.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js', 'src-ts/**/*.ts'],
    },
    alias: {
      // Help tests import from both source directories
      '@src-js': './src',
      '@src-ts': './src-ts',
    },
  },
});