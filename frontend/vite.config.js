import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Aplikasi memanggil blockchain lewat /rpc (proxy ke node), jadi tidak ada masalah CORS
// dan HP di jaringan yang sama juga bisa memakai aplikasi (npm run app:host).
// Alamat node dibaca dari RPC_URL di file .env folder mbg-chain (default Ganache lokal port 8545).
//
// Mode "pages" (npm run pages:build) membuat versi GitHub Pages: tanpa node dan tanpa proxy, blockchain Ganache
// berjalan di browser pengunjung (src/lib/chainBrowser.js) dan kontrak di-deploy dari build/MBGChain.json.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  const RPC_URL = env.RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545';
  const HTTPS = (env.MBG_HTTPS || process.env.MBG_HTTPS) === '1';
  const root = fileURLToPath(new URL('..', import.meta.url));
  const berkasTls = (nama, bawaan) => readFileSync(env[nama] || process.env[nama] || fileURLToPath(new URL(bawaan, import.meta.url)));
  const https = HTTPS ? {
    key: berkasTls('HTTPS_KEY', '../.cert/mbg-chain-key.pem'),
    cert: berkasTls('HTTPS_CERT', '../.cert/mbg-chain-cert.pem'),
  } : undefined;
  const proxy = { '/rpc': { target: RPC_URL, changeOrigin: true, rewrite: (p) => p.replace(/^\/rpc/, '') } };
  const pages = mode === 'pages';
  const berkas = (rel) => fileURLToPath(new URL(rel, import.meta.url));
  if (pages && !existsSync(berkas('../build/MBGChain.json'))) {
    throw new Error('build/MBGChain.json belum ada. Jalankan npm run pages:build (sudah termasuk npm run compile).');
  }
  return {
    base: pages ? (env.PAGES_BASE || '/MBG-Chainnn/') : '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@client': berkas('../client/mbgchain.js'),
        '@skenario': berkas('../client/skenario-demo.js'),
        '@mode-chain': berkas(pages ? './src/lib/chainBrowser.js' : './src/lib/chainTanpa.js'),
        ...(pages ? { '@artefak': berkas('../build/MBGChain.json') } : {}),
      },
    },
    server: { port: Number(env.APP_PORT || process.env.APP_PORT || 5173), https, proxy },
    preview: { port: 4173, https, proxy },
    // web3.js memang besar (~1 MB); wajar untuk prototype. Build Pages ditulis ke folder terpisah.
    build: { chunkSizeWarningLimit: 1200, ...(pages ? { outDir: 'dist-pages', emptyOutDir: true } : {}) },
  };
});
