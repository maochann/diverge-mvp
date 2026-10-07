import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests cover the pure modules (i18n core, feed composition, threading,
// adjacency ranking, notification scheduling). Nothing here renders React
// Native; screens are verified in the simulator.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/_shared/**/*.test.ts'],
  },
});
