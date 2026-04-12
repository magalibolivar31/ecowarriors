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
        'src/lib/utils.ts',
        'src/lib/levelUtils.ts',
        'src/lib/validation.ts',
        'src/lib/reportNormalization.ts',
        'src/lib/missionProgress.ts',
        'src/services/achievementService.ts',
      ],
      thresholds: {
        lines: 98,
        functions: 98,
        branches: 96,
        statements: 98,
      },
    },
  },
});
