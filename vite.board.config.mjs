import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));

// Builds the React plan board into one classic script + one stylesheet (assets/board/),
// loaded by app.html like app.js, so it works opened straight from disk (file://) or any static host.
// Module scripts are blocked on file://, hence the IIFE format.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: path.join(root, 'assets/board'),
    emptyOutDir: true,
    lib: {
      entry: path.join(root, 'src/board/main.jsx'),
      name: 'HVSBoard',
      formats: ['iife'],
      fileName: () => 'board.js',
      cssFileName: 'board'
    }
  }
});
