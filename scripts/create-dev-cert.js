// Membuat sertifikat HTTPS lokal tanpa memasang CA atau mengubah trust store perangkat.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './util.js';

const tujuan = path.join(ROOT, '.cert');
const kunci = path.join(tujuan, 'mbg-chain-key.pem');
const sertifikat = path.join(tujuan, 'mbg-chain-cert.pem');

if (fs.existsSync(kunci) || fs.existsSync(sertifikat)) {
  console.error('Sertifikat .cert/ sudah ada. Hapus kedua file secara manual bila memang ingin membuat ulang.');
  process.exit(1);
}

const ips = ['127.0.0.1'];
for (const daftar of Object.values(os.networkInterfaces())) {
  for (const info of daftar || []) {
    if (info.family === 'IPv4' && !info.internal) ips.push(info.address);
  }
}
const unik = [...new Set(ips)];
const sementara = fs.mkdtempSync(path.join(os.tmpdir(), 'mbg-chain-cert-'));
const config = path.join(sementara, 'openssl.cnf');
const ipConfig = unik.map((ip, i) => `IP.${i + 1} = ${ip}`).join('\n');
fs.writeFileSync(config, `[req]\nprompt = no\ndistinguished_name = dn\nx509_extensions = ext\n[dn]\nCN = MBG-Chain lokal\n[ext]\nbasicConstraints = critical,CA:FALSE\nkeyUsage = critical,digitalSignature,keyEncipherment\nextendedKeyUsage = serverAuth\nsubjectAltName = @alt_names\n[alt_names]\nDNS.1 = localhost\n${ipConfig}\n`);
fs.mkdirSync(tujuan, { recursive: true });

const hasil = spawnSync('openssl', [
  'req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-sha256', '-days', '30',
  '-keyout', kunci, '-out', sertifikat, '-config', config,
], { stdio: 'inherit' });
fs.rmSync(sementara, { recursive: true, force: true });

if (hasil.error || hasil.status !== 0) {
  for (const file of [kunci, sertifikat]) if (fs.existsSync(file)) fs.rmSync(file);
  console.error(hasil.error?.message || 'OpenSSL gagal membuat sertifikat.');
  process.exit(1);
}
fs.chmodSync(kunci, 0o600);
console.log('\nSertifikat HTTPS lokal dibuat untuk:');
console.log(`  localhost, ${unik.join(', ')}`);
console.log(`  ${sertifikat}`);
console.log('\nSertifikat ini belum dipercaya. Impor/percaya secara manual di perangkat demo sebelum memakai kamera HP.');
