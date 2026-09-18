import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { createGenerationService } from './server/sprite-generation';

export default defineConfig(({ mode }) => ({
  base: '/kids-game/',
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
