import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/kids-game/',
  plugins: [
    vue(),
    {
      name: 'disable-rocket-loader',
      transformIndexHtml(html) {
        return html.replaceAll('<script', '<script data-cfasync="false"');
      },
    },
  ],
});
