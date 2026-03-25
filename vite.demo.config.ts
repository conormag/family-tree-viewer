import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  base: '/family-tree-viewer/',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
});
