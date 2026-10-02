import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));

// The vanilla pages load assets/hvs/*.js as classic scripts, which Vite does not bundle;
// copy those folders into dist as-is so the built site still works.
function copyStatic(dirs) {
  return {
    name: 'copy-static',
    apply: 'build',
    closeBundle() {
      dirs.forEach((d) => fs.cpSync(path.join(root, d), path.join(root, 'dist', d), { recursive: true }));
    }
  };
}

export default defineConfig({
  plugins: [react(), copyStatic(['assets', 'images'])],
  publicDir: false,
  build: {
    rollupOptions: {
      input: {
        index: path.join(root, 'index.html'),
        login: path.join(root, 'login.html'),
        app: path.join(root, 'app.html'),
        device: path.join(root, 'device.html')
      }
    }
  }
});
