import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/_setup.ts'],
    typecheck: { tsconfig: './tsconfig.test.json' }
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
});
