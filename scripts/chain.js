// Menjalankan blockchain lokal (Ganache) di http://127.0.0.1:8545 untuk pengembangan dan demo.
// - Mnemonic deterministik: alamat akun dan alamat kontrak selalu sama setiap kali dijalankan.
// - Jam chain dimulai 5 jam sebelum sekarang. Script seed memajukan jam sesuai skenario demo,
//   sehingga setelah seed jam chain kembali kira-kira sama dengan jam sekarang.
import { Web3 } from 'web3';
import { muatGanache } from './util.js';

const PORT = Number(process.env.PORT || 8545);
const PERAN = [
  'Admin BGN (deployer)', 'Petugas dapur · SPPG Cakung Barat', 'Kurir Budi · Mitra Logistik Cakung',
  'Kurir Rudi · Mitra Logistik Cakung', 'PIC Sinta · SDN Rawa Indah 03', 'PIC Dimas · SDN Rawa Indah 05',
  'Petugas · Puskesmas Cakung', 'Petugas dapur · SPPG Pulo Gebang', '(cadangan)', '(cadangan)',
];

const ganache = await muatGanache();
const server = ganache.server({
  wallet: { deterministic: true, totalAccounts: PERAN.length, defaultBalance: 1000 },
  chain: { chainId: 1337, networkId: 1337, time: new Date(Date.now() - 5 * 60 * 60 * 1000) },
  logging: { quiet: true },
});
try {
  await server.listen(PORT);
} catch (error) {
  // Ganache dibundel dalam satu berkas minified. Tanpa penanganan ini, konflik
  // port mencetak stack trace sangat panjang dan menutupi solusi sederhananya.
  if (error?.code === 'EADDRINUSE' || /EADDRINUSE|address already in use/i.test(error?.message || '')) {
    console.error(`\nPort ${PORT} sudah dipakai. Kemungkinan MBG-Chain lokal masih berjalan di terminal lain.`);
    console.error(`Hentikan proses lama dengan Ctrl+C, atau periksa dengan: lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n`);
    process.exit(1);
  }
  throw error;
}

// Ganache hanya membuat blok saat ada transaksi. Blok kosong tiap 5 detik membuat jam chain terus berjalan
// seperti jaringan sungguhan, sehingga hitung mundur batas 4 jam di aplikasi selalu mutakhir.
const DETAK_DETIK = 5;
setInterval(() => server.provider.request({ method: 'evm_mine', params: [] }).catch(() => {}), DETAK_DETIK * 1000);

const akun = Object.keys(server.provider.getInitialAccounts()).map((a) => Web3.utils.toChecksumAddress(a));
console.log(`\nMBG-Chain lokal berjalan di http://127.0.0.1:${PORT} (chainId 1337, blok baru minimal tiap ${DETAK_DETIK} detik)\n`);
console.table(akun.map((alamat, i) => ({ alamat, peran: PERAN[i] })));
console.log('Langkah berikutnya di terminal lain:  npm run deploy  →  npm run seed  →  npm run app');
console.log('Tekan Ctrl+C untuk berhenti (data chain lokal akan hilang).\n');
