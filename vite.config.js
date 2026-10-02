import { defineConfig, loadEnv } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Only these public cartographic/vendor assets are copied. Never copy data/ wholesale.
export const publicAssets = [
  'data/regions.json', 'data/curitiba-regionais.geojson', 'data/rmc-municipios.geojson',
  'vendor/leaflet.js', 'vendor/leaflet.markercluster.js',
  'vendor/LEAFLET-LICENSE.txt', 'vendor/MARKERCLUSTER-LICENSE.txt',
];
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (key && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY deve conter uma chave publishable (sb_publishable_).');
  }
  return {
    base: './', publicDir: false,
    // Expose exactly two public settings; no other .env values enter the bundle.
    envPrefix: [],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
    },
    server: { host: '127.0.0.1', port: Number(process.env.PORT || 3000), strictPort: true,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/*.csv', '**/leads.json', '**/docs/**', '**/tests/**', '**/.tmp/**', '**/test-results/**', '**/playwright-report/**'] },
    },
    preview: { host: '127.0.0.1', port: Number(process.env.PORT || 3000), strictPort: true },
    build: { outDir: 'dist', sourcemap: false },
    plugins: [{
      name: 'pamda-public-assets',
      async generateBundle() {
        for (const fileName of publicAssets) {
          this.emitFile({ type: 'asset', fileName, source: await readFile(new URL(fileName, import.meta.url)) });
        }
      },
    }],
  };
});
