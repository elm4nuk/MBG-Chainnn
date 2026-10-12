// Demo alur kritis PIC sekolah lewat klien Web3.js (client/mbgchain.js), tanpa UI.
// Membuktikan koneksi aplikasi -> kontrak: baca data, kirim transaksi, dan penolakan aturan 4 jam.
// Jalankan setelah: npm run chain → npm run deploy → npm run seed  (demo ini mengubah data seed).
import { bacaJson } from './util.js';
import { MBGChainClient, kodeBatch } from '../client/mbgchain.js';

const dep = bacaJson('deployments/lokal.json');
const akunDemo = bacaJson('deployments/akun-demo.json');
if (!dep || !akunDemo) {
  console.error('Jalankan dulu: npm run chain → npm run deploy → npm run seed');
  process.exit(1);
}
const klien = MBGChainClient.hubungkan(dep.rpcUrl, dep);
const menit = (detik) => (detik >= 3600 ? `${Math.floor(detik / 3600)} jam ${Math.round((detik % 3600) / 60)} menit` : `${Math.round(detik / 60)} menit`);
const pendek = (h) => `${h.slice(0, 10)}…${h.slice(-4)}`;
const tampilStatus = (tahap, data) => {
  if (tahap === 'menunggu') console.log(`   … menunggu konfirmasi jaringan (tx ${pendek(data.txHash)})`);
  if (tahap === 'tercatat') console.log(`   ✔ tercatat di blok ${data.blok} · gas ${data.gas.toLocaleString('id-ID')}`);
  if (tahap === 'gagal') console.log(`   ✖ ${data.jenis === 'ditolak' ? 'Ditolak sistem' : 'Gagal'}: ${data.message}`);
};

console.log('\nMBG-Chain · demo alur kritis PIC sekolah\n');

// 1. Masuk
const pic = akunDemo.petugas.find((p) => p.id === 'PIC-RI03-021');
const profil = await klien.masuk(pic.akun);
console.log(`1. Masuk sebagai ${pic.id} → ${profil.nama} · ${profil.organisasi} (peran ${profil.peran})`);

// 2. Beranda sekolah: batch yang menunggu keputusan, paling mendesak di atas
const sekarang = await klien.waktuChain();
const semua = await klien.daftarBatch({ sekolahId: profil.organisasiId });
const aktif = semua.filter((b) => b.status === 3).sort((a, b) => a.batasKonsumsi - b.batasKonsumsi);
console.log(`2. Beranda: ${aktif.length} batch menunggu keputusan`);
for (const b of aktif) {
  const ket = b.kelayakan === 3 ? `lewat ${menit(sekarang - b.batasKonsumsi)}` : `sisa ${menit(b.sisaDetik)}`;
  console.log(`   ${b.kode}  ${b.kelayakanTeks.padEnd(16)} ${ket}`);
}

// 3. Pindai QR batch yang mendekati batas
const target = aktif.find((b) => b.kelayakan === 2) || aktif.find((b) => b.kelayakan === 1);
const detail = await klien.batch(target.kode);
console.log(`3. Pindai QR ${detail.kode}: ${detail.menu}`);
console.log(`   ${detail.porsiDiterima} porsi diterima · ${detail.kelayakanTeks} · sisa ${menit(detail.sisaDetik)}`);

// 4. Catat penyajian
const porsi = detail.porsiDiterima - 2;
console.log(`4. Catat penyajian ${porsi} porsi`);
await klien.catatPenyajian(detail.id, porsi, { onStatus: tampilStatus });

// 5. Coba sajikan batch yang sudah lewat batas → ditolak kontrak
const telat = aktif.find((b) => b.kelayakan === 3);
console.log(`5. Coba catat penyajian ${telat.kode} (sudah lewat batas)`);
await klien.catatPenyajian(telat.id, telat.porsiDiterima, { onStatus: tampilStatus }).catch(() => {});

// 6. Tolak batch tersebut dengan alasan lewat batas
console.log(`6. Tolak ${telat.kode}: alasan "Lewat batas 4 jam", ${telat.porsiDiterima} porsi`);
await klien.tolakBatch(telat.id, 1, telat.porsiDiterima, 'Tiba setelah batas konsumsi', { onStatus: tampilStatus });

// 7. Verifikasi publik tanpa akun (orang tua / pengawas)
const publik = MBGChainClient.hubungkan(dep.rpcUrl, dep);
const cek = await publik.batch(kodeBatch(detail.id));
console.log(`7. Verifikasi publik ${cek.kode} tanpa login: ${cek.statusTeks} ${cek.porsiSelesai} porsi`);
for (const r of cek.riwayat) {
  console.log(`   ${new Date(r.waktu * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}  ${r.tahap.padEnd(17)} ${r.oleh}`);
}
const jejak = await publik.jejakAudit(detail.id);
console.log(`   jejak audit: ${jejak.length} event on-chain (${jejak.map((e) => e.event).join(' → ')})\n`);
