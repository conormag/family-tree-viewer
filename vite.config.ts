import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FamilyTreeViewer',
      fileName: 'family-tree-viewer',
      formats: ['es', 'umd'],
    },
  },
  plugins: [dts({ include: ['src'] })],
});
