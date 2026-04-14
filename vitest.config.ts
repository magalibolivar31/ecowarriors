import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      all: true,
      include: [
        'src/lib/**/*.ts',
        'src/services/**/*.ts',
      ],
      thresholds: {
        lines: 98,
        functions: 98,
        branches: 90,
        statements: 98,
      },
    },
  },
});
