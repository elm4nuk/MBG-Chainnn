// Mengisi data demo ke kontrak di jaringan lokal: organisasi, petugas, dan 6 batch di berbagai tahap.
// Skenario meniru prototype UI (Session 10): pada "sekarang", batch B-0001 sudah lewat batas 25 menit,
// B-0002 tersisa 45 menit, dan B-0003 tersisa 1 jam 35 menit.
// Hanya untuk jaringan lokal (Ganache/Hardhat) karena memakai evm_increaseTime untuk memajukan jam.
import { Web3 } from 'web3';
import { bacaJson, tulisJson } from './util.js';
import { MBGChainClient } from '../client/mbgchain.js';
import { ORGANISASI, isiDataDemo } from '../client/skenario-demo.js';

const dep = bacaJson('deployments/lokal.json');
if (!dep) {
  console.error('deployments/lokal.json belum ada. Jalankan: npm run chain, lalu npm run deploy');
  process.exit(1);
}
const web3 = new Web3(dep.rpcUrl);
const kontrak = new web3.eth.Contract(dep.abi, dep.address);
if (Number(await kontrak.methods.jumlahOrganisasi().call()) > 0) {
  console.error('Data demo sudah ada. Untuk mengulang: hentikan chain, lalu npm run chain → npm run deploy → npm run seed');
  process.exit(1);
}

// Skenario yang sama dipakai mode demo browser (GitHub Pages), jadi data demo lokal dan online selalu sama.
const { akunDemo, idBatch } = await isiDataDemo(web3, kontrak);

// Simpan akun demo untuk layar Masuk di front-end.
tulisJson('deployments/akun-demo.json', akunDemo);
tulisJson('frontend/public/akun-demo.json', akunDemo);   // dipakai layar Masuk di aplikasi

// Ringkasan, dibaca lewat klien yang sama dengan front-end.
const klien = MBGChainClient.hubungkan(dep.rpcUrl, dep);
const sekarang = await klien.waktuChain();
const jam = (t) => new Date(t * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const ringkas = [];
for (const id of idBatch) {
  const b = await klien.batch(id);
  const sisa = b.kelayakan === 3 ? `lewat ${Math.round((sekarang - b.batasKonsumsi) / 60)} menit`
    : `sisa ${Math.floor(b.sisaDetik / 3600)} j ${Math.round((b.sisaDetik % 3600) / 60)} m`;
  ringkas.push({
    batch: b.kode, sekolah: b.sekolah, status: b.statusTeks,
    kelayakan: b.selesai ? '—' : b.kelayakanTeks,
    'batas konsumsi': b.selesai || !b.batasKonsumsi ? '—' : `${jam(b.batasKonsumsi)} · ${sisa}`,
  });
}
console.log(`✔ Data demo terisi: ${ORGANISASI.length} organisasi, ${akunDemo.petugas.length} petugas, ${ringkas.length} batch`);
console.log(`  jam chain sekarang ${jam(sekarang)} · akun login demo di deployments/akun-demo.json`);
console.table(ringkas);
