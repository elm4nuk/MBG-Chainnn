// Menjalankan blockchain lokal (Hardhat Network) di http://127.0.0.1:8545 untuk pengembangan dan demo.
// - Konfigurasi di hardhat.config.js (jaringan "lokal"): mnemonic sama dengan Ganache deterministik,
//   jadi alamat akun dan alamat kontrak selalu sama setiap kali dijalankan.
// - Jam chain dimulai 5 jam sebelum sekarang. Script seed memajukan jam sesuai skenario demo,
//   sehingga setelah seed jam chain kembali kira-kira sama dengan jam sekarang.
// - Blok kosong tiap 5 detik membuat jam chain terus berjalan seperti jaringan sungguhan.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ROOT } from './util.js';
import { panggilRpc, portDipakai } from './proses.js';

const PORT = Number(process.env.PORT || 8545);
const PERAN = [
  'Admin BGN (deployer)', 'Petugas dapur · SPPG Cakung Barat', 'Kurir Budi · Mitra Logistik Cakung',
  'Kurir Rudi · Mitra Logistik Cakung', 'PIC Sinta · SDN Rawa Indah 03', 'PIC Dimas · SDN Rawa Indah 05',
  'Petugas · Puskesmas Cakung', 'Petugas dapur · SPPG Pulo Gebang', '(cadangan)', '(cadangan)',
];

if (await portDipakai(PORT)) {
  console.error(`\nPort ${PORT} sudah dipakai. Kemungkinan MBG-Chain lokal masih berjalan di terminal lain.`);
  console.error(`Hentikan proses lama dengan Ctrl+C, atau periksa dengan: lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const paket = path.dirname(require.resolve('hardhat/package.json'));
const bin = JSON.parse(readFileSync(path.join(paket, 'package.json'), 'utf8')).bin;
const cli = path.join(paket, typeof bin === 'string' ? bin : bin.hardhat);

const node = spawn(process.execPath, [cli, 'node', '--network', 'lokal', '--hostname', '127.0.0.1', '--port', String(PORT)], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
});
// Hardhat mencetak setiap panggilan RPC; cukup teruskan peringatan dan error agar terminal demo tetap bersih.
let sisa = '';
node.stdout.setEncoding('utf8');
node.stdout.on('data', (d) => {
  const baris = (sisa + d).split('\n');
  sisa = baris.pop();
  for (const b of baris) if (/error|warning|EADDRINUSE/i.test(b) && !/eth_|net_|evm_/.test(b)) console.error(b);
});
node.stderr.pipe(process.stderr);
node.on('exit', (kode) => process.exit(kode ?? 1));
for (const sinyal of ['SIGINT', 'SIGTERM']) process.on(sinyal, () => node.kill(sinyal));

// Tunggu RPC siap, lalu tampilkan peran tiap akun.
const rpc = `http://127.0.0.1:${PORT}`;
for (let i = 0; ; i++) {
  try { await panggilRpc(rpc, 'eth_chainId'); break; } catch {
    if (i > 120) { console.error('Hardhat node tidak siap dalam 60 detik.'); node.kill(); process.exit(1); }
    await new Promise((r) => setTimeout(r, 500));
  }
}
const { getAddress } = await import('viem');
const akun = (await panggilRpc(rpc, 'eth_accounts')).map((a) => getAddress(a));
console.log(`\nMBG-Chain lokal (Hardhat) berjalan di ${rpc} (chainId 1337, blok baru minimal tiap 5 detik)\n`);
console.table(akun.map((alamat, i) => ({ alamat, peran: PERAN[i] })));
console.log('Langkah berikutnya di terminal lain:  npm run deploy  →  npm run seed  →  npm run app');
console.log('Tekan Ctrl+C untuk berhenti (data chain lokal akan hilang).\n');
