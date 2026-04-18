import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      VITE_GEMINI_API_KEY: 'test-key-1',
      VITE_GEMINI_API_KEY2: 'test-key-2',
      VITE_GEMINI_API_KEY3: 'test-key-3',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      all: true,
      include: [
        'src/lib/**/*.ts',
        'src/services/**/*.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
