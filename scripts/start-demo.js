// Menyalakan seluruh demo lokal secara berurutan: chain -> RPC siap -> deploy -> seed -> Vite.
// Referensi child process disimpan agar Ctrl+C hanya membersihkan proses buatan launcher ini.
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, muatEnv } from './util.js';
import { portDipakai } from './proses.js';

muatEnv();

const RPC_URL = process.env.RPC_URL || `http://127.0.0.1:${process.env.PORT || 8545}`;
const APP_PORT = Number(process.env.APP_PORT || 5173);
const HTTPS = process.env.MBG_HTTPS === '1';
const rpc = new URL(RPC_URL);
const rpcPort = Number(rpc.port || (rpc.protocol === 'https:' ? 443 : 80));
const proses = new Set();
let berhenti = false;

if (!['127.0.0.1', 'localhost'].includes(rpc.hostname)) {
  console.error(`demo:start hanya untuk chain lokal. RPC_URL saat ini: ${RPC_URL}`);
  console.error('Kosongkan RPC_URL di .env, lalu coba lagi.');
  process.exit(1);
}
if (!Number.isInteger(APP_PORT) || APP_PORT < 1 || APP_PORT > 65535) {
  console.error(`APP_PORT tidak valid: ${process.env.APP_PORT}`);
  process.exit(1);
}

function jalankan(perintah, argumen, opsi = {}) {
  const child = spawn(perintah, argumen, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    ...opsi,
  });
  proses.add(child);
  child.once('exit', () => proses.delete(child));
  return child;
}

function tungguSelesai(child, nama) {
  return new Promise((resolve, reject) => {
    child.once('error', (error) => reject(new Error(`${nama} gagal dimulai: ${error.message}`)));
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${nama} berhenti (${signal || `kode ${code}`}).`));
    });
  });
}

async function tungguRpc(child, timeoutMs = 20_000) {
  const mulai = Date.now();
  while (Date.now() - mulai < timeoutMs) {
    if (child.exitCode !== null) throw new Error('Ganache berhenti sebelum RPC siap.');
    try {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: AbortSignal.timeout(1_500),
      });
      const isi = await res.json();
      if (res.ok && isi.result) return isi.result;
    } catch { /* RPC masih mulai */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`RPC belum siap setelah ${timeoutMs / 1000} detik (${RPC_URL}).`);
}

function alamatAplikasi() {
  const protokol = HTTPS ? 'https' : 'http';
  const alamat = [`${protokol}://localhost:${APP_PORT}`];
  for (const daftar of Object.values(os.networkInterfaces())) {
    for (const info of daftar || []) {
      if (info.family === 'IPv4' && !info.internal) alamat.push(`${protokol}://${info.address}:${APP_PORT}`);
    }
  }
  return [...new Set(alamat)];
}

function matikan(child, signal) {
  if (!child.pid || child.exitCode !== null) return;
  try { child.kill(signal); } catch { /* sudah berhenti */ }
}

function bersihkan(code = 0) {
  if (berhenti) return;
  berhenti = true;
  console.log('\nMenghentikan proses demo yang dibuat launcher…');
  for (const child of proses) matikan(child, 'SIGTERM');
  const paksa = setTimeout(() => {
    for (const child of proses) matikan(child, 'SIGKILL');
    process.exit(code);
  }, 2_000);
  paksa.unref();
  Promise.allSettled([...proses].map((child) => new Promise((resolve) => child.once('exit', resolve))))
    .finally(() => process.exit(code));
}

process.once('SIGINT', () => bersihkan(0));
process.once('SIGTERM', () => bersihkan(0));

try {
  const [rpcTerpakai, appTerpakai] = await Promise.all([
    portDipakai(rpcPort),
    portDipakai(APP_PORT),
  ]);
  if (rpcTerpakai) throw new Error(`Port RPC ${rpcPort} sedang dipakai. Hentikan proses tersebut sendiri; launcher tidak akan membunuhnya.`);
  if (appTerpakai) throw new Error(`Port aplikasi ${APP_PORT} sedang dipakai. Hentikan proses tersebut sendiri; launcher tidak akan membunuhnya.`);

  console.log(`\n1/4 Menyalakan Ganache di ${RPC_URL}`);
  const chain = jalankan(process.execPath, [path.join(ROOT, 'scripts/chain.js')], { env: { ...process.env, PORT: String(rpcPort) } });
  const chainId = await tungguRpc(chain);
  console.log(`\nRPC siap (chainId ${Number.parseInt(chainId, 16)}).`);

  console.log('\n2/4 Deploy kontrak');
  await tungguSelesai(jalankan('npm', ['run', 'deploy']), 'Deploy');
  console.log('\n3/4 Mengisi data demo');
  await tungguSelesai(jalankan('npm', ['run', 'seed']), 'Seed');

  console.log(`\n4/4 Menyalakan aplikasi${HTTPS ? ' HTTPS' : ''}`);
  const vite = jalankan(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '0.0.0.0', '--port', String(APP_PORT), '--strictPort'], {
    cwd: path.join(ROOT, 'frontend'),
  });
  vite.once('exit', (code) => { if (!berhenti) bersihkan(code || 1); });
  console.log('\nAlamat aplikasi:');
  for (const alamat of alamatAplikasi()) console.log(`  ${alamat}`);
  console.log('\nTekan Ctrl+C untuk menghentikan chain dan aplikasi. Data chain ini akan hilang.\n');
} catch (error) {
  console.error(`\nDemo tidak dapat dimulai: ${error.message}\n`);
  bersihkan(1);
}
