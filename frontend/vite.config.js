import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Aplikasi memanggil blockchain lewat /rpc (proxy ke node), jadi tidak ada masalah CORS
// dan HP di jaringan yang sama juga bisa memakai aplikasi (npm run app:host).
// Alamat node dibaca dari RPC_URL di file .env folder mbg-chain (default Ganache lokal port 8545).
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
  return {
    plugins: [react()],
    resolve: { alias: { '@client': fileURLToPath(new URL('../client/mbgchain.js', import.meta.url)) } },
    server: { port: Number(env.APP_PORT || process.env.APP_PORT || 5173), https, proxy },
    preview: { port: 4173, https, proxy },
    build: { chunkSizeWarningLimit: 1200 }, // web3.js memang besar (~1 MB); wajar untuk prototype
  };
});
