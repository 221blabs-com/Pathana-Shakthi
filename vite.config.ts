import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// The built JS/CSS/wasm list the service worker (public/sw.js) pre-caches for
// offline use. server.ts serves the same list itself; a static host (Vercel)
// serves this file.
function appAssetsList(): Plugin {
  return {
    name: 'app-assets-list',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && /\.(js|css|wasm)$/.test(f))
        .map((f) => f.slice('assets/'.length));
      this.emitFile({type: 'asset', fileName: 'app-assets.json', source: JSON.stringify(files)});
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), appAssetsList()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
