import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '__tests__/**/*.test.ts',
      '__tests__/**/*.test.tsx',
      'src/__tests__/**/*.test.ts',
      'src/__tests__/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/db.ts',
        'src/lib/notifications.tsx',
        'src/lib/errorLog.ts',
        'src/lib/offlineQueue.ts',
        'src/lib/store.ts',
        'src/lib/security.ts',
        'src/lib/errorReporter.ts',
        'src/lib/solanaPay.ts',
        'src/lib/connectivity.ts',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
