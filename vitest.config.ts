import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Os testes de componente usam `react-dom/server`; o JSX do Next é "preserve" só para o tsc.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
  },
});
