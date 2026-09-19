import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerationService } from './server/sprite-generation';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  base: '/kids-game/',
  resolve: {
    alias: {
      phaser: resolve(root, 'node_modules/phaser/dist/phaser.js'),
    },
  },
  optimizeDeps: {
    include: ['phaser'],
  },
  plugins: [
    vue(),
    {
      name: 'sprite-generation-local',
      configureServer(server) {
        const env = loadEnv(mode, server.config.envDir, 'OPENAI_');
        const service = createGenerationService({ directory: resolve(server.config.root, '.sprite-studio/jobs'), apiKey: env.OPENAI_API_KEY, model: env.OPENAI_IMAGE_MODEL });
        server.middlewares.use(service.middleware);
      },
    },
    {
      name: 'disable-rocket-loader',
      transformIndexHtml(html) {
        return html.replaceAll('<script', '<script data-cfasync="false"');
      },
    },
  ],
}));
