import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'demo',
  base: '/family-tree-viewer/',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'demo/index.html'),
        gedcom:   resolve(__dirname, 'demo/gedcom/index.html'),
        wikitree: resolve(__dirname, 'demo/wikitree/index.html'),
        docs:     resolve(__dirname, 'demo/docs/index.html'),
      },
    },
  },
});
