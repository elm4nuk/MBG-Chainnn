// Utilitas kecil yang dipakai bersama oleh script compile, deploy, seed, dan demo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Membaca file .env (jika ada) tanpa dependensi tambahan. Nilai di environment tetap diutamakan. */
export function muatEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const baris of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

export function bacaJson(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function tulisJson(rel, data) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

/** Nama file deployment per jaringan: deployments/<nama>.json */
export function namaJaringan(chainId) {
  return { 1337: 'lokal', 31337: 'lokal', 11155111: 'sepolia' }[Number(chainId)] || `chain-${chainId}`;
}
