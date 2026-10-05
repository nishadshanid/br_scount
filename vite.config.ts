import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the build works at https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});
