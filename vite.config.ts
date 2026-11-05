/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mockSseMiddleware } from './server/mockSse';

/**
 * `base` is set for GitHub Pages project sites, which are served from
 * /<repo-name>/. Override it with BASE_PATH=/ when deploying to a root domain.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/majlis-chat/',
  plugins: [
    react(),
    {
      name: 'majlis-mock-sse',
      configureServer(server) {
        server.middlewares.use('/api/chat', mockSseMiddleware);
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'proxy/**/*.test.ts'],
  },
});
