// Unit test MBGChain di blockchain Ganache (in-process) memakai Web3.js.
// Jalankan: npm test
import assert from 'node:assert/strict';
import { Web3 } from 'web3';
import { kompilasi } from '../scripts/compile.js';
import { muatGanache } from '../scripts/util.js';
import { MBGChainClient, KesalahanMBG, terjemahkanError } from '../client/mbgchain.js';

const ganache = await muatGanache();

const JENIS = { SPPG: 1, Mitra: 2, Sekolah: 3, Puskesmas: 4 };
const STATUS = { Terdaftar: 0, SelesaiMasak: 1, DalamPerjalanan: 2, Diterima: 3, Disajikan: 4, Ditolak: 5 };
const KELAYAKAN = { BelumDimasak: 0, Aman: 1, MendekatiBatas: 2, Kedaluwarsa: 3 };
const ALASAN = { TidakAda: 0, LewatBatasWaktu: 1, KondisiTidakLayak: 2, Lainnya: 3 };
const ORG = { dapur: 1, mitra: 2, sekolah: 3, sekolahLain: 4, puskesmas: 5, dapurLain: 6 };
const MENU = 'Nasi, ayam teriyaki, tumis buncis, pisang';

describe('MBGChain', function () {
  let provider, web3, artefak, kontrak, A;
  const gasPerFungsi = {};

  // ---------------------------------------------------------------- helper
  async function tx(dari, fungsi, ...args) {
    const metode = kontrak.methods[fungsi](...args);
    const gas = await metode.estimateGas({ from: dari });
    const r = await metode.send({ from: dari, gas: String(Math.ceil(Number(gas) * 1.2)) });
    (gasPerFungsi[fungsi] ||= []).push(Number(r.gasUsed));
    return r;
  }
  /** Simulasi transaksi (eth_call) dan pastikan kontrak menolak dengan custom error tertentu. */
  async function ditolak(dari, fungsi, args, namaError) {
    await assert.rejects(kontrak.methods[fungsi](...args).call({ from: dari }), (e) => {
      assert.equal(e.innerError?.errorName, namaError);
      return true;
    });
  }
  const baca = (fungsi, ...args) => kontrak.methods[fungsi](...args).call();
  async function majukan(menit) {
    await provider.request({ method: 'evm_increaseTime', params: [Math.round(menit * 60)] });
    await provider.request({ method: 'evm_mine', params: [] });
  }
  async function batchBaru(porsi = 120, sekolahId = ORG.sekolah) {
    const r = await tx(A.dapur, 'daftarkanBatch', sekolahId, MENU, porsi);
    return Number(r.events.BatchDidaftarkan.returnValues.id);
  }
  /** Batch yang sudah dimasak, diambil kurir, dan diterima sekolah. */
  async function batchDiSekolah(porsi = 120) {
    const id = await batchBaru(porsi);
    await tx(A.dapur, 'catatSelesaiMasak', id);
    await tx(A.kurir, 'ambilBatch', id);
    await tx(A.pic, 'terimaBatch', id, porsi);
    return id;
  }

  before(async function () {
    artefak = kompilasi();
    provider = ganache.provider({ wallet: { deterministic: true }, logging: { quiet: true }, chain: { chainId: 1337 } });
    web3 = new Web3(provider);
    const akun = await web3.eth.getAccounts();
    A = { admin: akun[0], dapur: akun[1], kurir: akun[2], pic: akun[3], picLain: akun[4], puskesmas: akun[5], dapurLain: akun[6], sementara: akun[7], orangLuar: akun[9] };

    const deploy = new web3.eth.Contract(artefak.abi).deploy({ data: artefak.bytecode });
    const gas = await deploy.estimateGas({ from: A.admin });
    kontrak = await deploy.send({ from: A.admin, gas: String(Math.ceil(Number(gas) * 1.2)) });
    gasPerFungsi['(deploy)'] = [Number(gas)];

    await tx(A.admin, 'daftarkanOrganisasi', JENIS.SPPG, 'SPPG Cakung Barat');
    await tx(A.admin, 'daftarkanOrganisasi', JENIS.Mitra, 'Mitra Logistik Cakung');
    await tx(A.admin, 'daftarkanOrganisasi', JENIS.Sekolah, 'SDN Rawa Indah 03');
    await tx(A.admin, 'daftarkanOrganisasi', JENIS.Sekolah, 'SDN Rawa Indah 05');
    await tx(A.admin, 'daftarkanOrganisasi', JENIS.Puskesmas, 'Puskesmas Cakung');
    await tx(A.admin, 'daftarkanOrganisasi', JENIS.SPPG, 'SPPG Pulo Gebang');
    await tx(A.admin, 'daftarkanPetugas', A.dapur, ORG.dapur, 'Rina');
    await tx(A.admin, 'daftarkanPetugas', A.kurir, ORG.mitra, 'Budi');
    await tx(A.admin, 'daftarkanPetugas', A.pic, ORG.sekolah, 'Sinta');
    await tx(A.admin, 'daftarkanPetugas', A.picLain, ORG.sekolahLain, 'Dimas');
    await tx(A.admin, 'daftarkanPetugas', A.puskesmas, ORG.puskesmas, 'Andi');
    await tx(A.admin, 'daftarkanPetugas', A.dapurLain, ORG.dapurLain, 'Yusuf');
  });

  after(function () {
    const baris = Object.entries(gasPerFungsi).map(([f, g]) => ({
      fungsi: f, transaksi: g.length, 'gas rata-rata': Math.round(g.reduce((a, b) => a + b, 0) / g.length),
    }));
    console.log('\n  Pemakaian gas per fungsi (Ganache, solc 0.8.30, optimizer 200):');
    console.table(baris);
  });

  // ================================================================ 1
  describe('Pendaftaran peserta jaringan (admin BGN)', function () {
    it('akun yang men-deploy kontrak menjadi admin', async function () {
      assert.equal(await baca('admin'), A.admin);
    });

    it('selain admin tidak bisa mendaftarkan organisasi atau petugas', async function () {
      await ditolak(A.dapur, 'daftarkanOrganisasi', [JENIS.Sekolah, 'Sekolah Palsu'], 'BukanAdmin');
      await ditolak(A.pic, 'daftarkanPetugas', [A.orangLuar, ORG.sekolah, 'Penyusup'], 'BukanAdmin');
    });

    it('organisasi dan petugas harus valid', async function () {
      await ditolak(A.admin, 'daftarkanOrganisasi', [0, 'Tanpa jenis'], 'OrganisasiTidakValid');
      await ditolak(A.admin, 'daftarkanPetugas', [A.orangLuar, 99, 'Tanpa organisasi'], 'OrganisasiTidakValid');
    });

    it('petugas yang dinonaktifkan tidak bisa mencatat lagi', async function () {
      await tx(A.admin, 'daftarkanPetugas', A.sementara, ORG.dapur, 'Petugas Sementara');
      await tx(A.admin, 'nonaktifkanPetugas', A.sementara);
      await ditolak(A.sementara, 'daftarkanBatch', [ORG.sekolah, MENU, 100], 'BukanPetugas');
    });
  });

  // ================================================================ 2
  describe('Alur batch dari dapur sampai disajikan', function () {
    it('mencatat setiap titik serah terima beserta pelaku dan waktunya', async function () {
      const id = await batchBaru(120);
      await tx(A.dapur, 'catatSelesaiMasak', id);
      await majukan(30);
      await tx(A.kurir, 'ambilBatch', id);
      await majukan(55);
      await tx(A.pic, 'terimaBatch', id, 120);
      await majukan(20);
      const r = await tx(A.pic, 'catatPenyajian', id, 118);

      const b = await baca('lihatBatch', id);
      assert.equal(Number(b.status), STATUS.Disajikan);
      assert.equal(b.menu, MENU);
      assert.deepEqual([b.petugasDapur, b.kurir, b.penerima, b.pencatat], [A.dapur, A.kurir, A.pic, A.pic]);
      assert.deepEqual([Number(b.porsi), Number(b.porsiDiterima), Number(b.porsiSelesai)], [120, 120, 118]);
      const w = [b.waktuDaftar, b.waktuMasak, b.waktuDiambil, b.waktuDiterima, b.waktuSelesai].map(Number);
      assert.ok(w.every((x, i) => i === 0 || x >= w[i - 1]), 'waktu tiap tahap berurutan');
      assert.ok(w[4] - w[1] >= 105 * 60, 'jarak masak sampai disajikan tercatat');
      assert.equal(Number(r.events.BatchDisajikan.returnValues.porsiDisajikan), 118);
    });

    it('urutan status tidak bisa dilompati', async function () {
      const id = await batchBaru();
      await ditolak(A.kurir, 'ambilBatch', [id], 'StatusTidakSesuai');             // belum dimasak
      await tx(A.dapur, 'catatSelesaiMasak', id);
      await ditolak(A.pic, 'terimaBatch', [id, 120], 'StatusTidakSesuai');        // belum diambil kurir
      await ditolak(A.dapur, 'catatSelesaiMasak', [id], 'StatusTidakSesuai');     // tidak bisa dicatat dua kali
      await tx(A.kurir, 'ambilBatch', id);
      await ditolak(A.pic, 'catatPenyajian', [id, 100], 'StatusTidakSesuai');    // belum diterima
    });

    it('hanya peran yang tepat yang bisa mencatat tiap tahap', async function () {
      const id = await batchBaru();
      await ditolak(A.kurir, 'daftarkanBatch', [ORG.sekolah, MENU, 100], 'BukanPetugas');
      await ditolak(A.pic, 'catatSelesaiMasak', [id], 'BukanPetugas');
      await tx(A.dapur, 'catatSelesaiMasak', id);
      await ditolak(A.pic, 'ambilBatch', [id], 'BukanPetugas');
      await ditolak(A.orangLuar, 'ambilBatch', [id], 'BukanPetugas');
      await tx(A.kurir, 'ambilBatch', id);
      await ditolak(A.dapur, 'terimaBatch', [id, 120], 'BukanPetugas');
    });

    it('dapur atau sekolah lain tidak bisa mencatat batch yang bukan miliknya', async function () {
      const id = await batchBaru();
      await ditolak(A.dapurLain, 'catatSelesaiMasak', [id], 'BatchOrganisasiLain');
      await tx(A.dapur, 'catatSelesaiMasak', id);
      await tx(A.kurir, 'ambilBatch', id);
      await ditolak(A.picLain, 'terimaBatch', [id, 120], 'BatchOrganisasiLain');
    });

    it('jumlah porsi divalidasi di setiap tahap', async function () {
      await ditolak(A.dapur, 'daftarkanBatch', [ORG.sekolah, MENU, 0], 'PorsiTidakValid');
      await ditolak(A.dapur, 'daftarkanBatch', [ORG.puskesmas, MENU, 50], 'OrganisasiTidakValid'); // tujuan harus sekolah
      const id = await batchBaru(100);
      await tx(A.dapur, 'catatSelesaiMasak', id);
      await tx(A.kurir, 'ambilBatch', id);
      await ditolak(A.pic, 'terimaBatch', [id, 101], 'PorsiTidakValid');
      await tx(A.pic, 'terimaBatch', id, 96);
      await ditolak(A.pic, 'catatPenyajian', [id, 97], 'PorsiTidakValid');
      await ditolak(A.pic, 'catatPenyajian', [id, 0], 'PorsiTidakValid');
    });
  });

  // ================================================================ 3
  describe('Aturan batas konsumsi 4 jam', function () {
    it('status kelayakan berubah Aman → Mendekati batas → Kedaluwarsa', async function () {
      const id = await batchBaru();
      let k = await baca('cekKelayakan', id);
      assert.equal(Number(k.status), KELAYAKAN.BelumDimasak);
      const r = await tx(A.dapur, 'catatSelesaiMasak', id);
      const batas = Number(r.events.BatchSelesaiMasak.returnValues.batasKonsumsi);

      await majukan(170);                                    // 2 jam 50 menit
      k = await baca('cekKelayakan', id);
      assert.equal(Number(k.status), KELAYAKAN.Aman);
      assert.equal(Number(k.batasKonsumsi), batas);
      await majukan(20);                                     // 3 jam 10 menit -> sisa < 60 menit
      k = await baca('cekKelayakan', id);
      assert.equal(Number(k.status), KELAYAKAN.MendekatiBatas);
      assert.ok(Number(k.sisaDetik) <= 50 * 60 + 5);
      await majukan(55);                                     // 4 jam 5 menit
      k = await baca('cekKelayakan', id);
      assert.equal(Number(k.status), KELAYAKAN.Kedaluwarsa);
      assert.equal(Number(k.sisaDetik), 0);
    });

    it('penyajian sebelum batas diterima kontrak', async function () {
      const id = await batchDiSekolah();
      await majukan(230);                                    // 3 jam 50 menit sejak masak
      await tx(A.pic, 'catatPenyajian', id, 120);
      assert.equal(Number((await baca('lihatBatch', id)).status), STATUS.Disajikan);
    });

    it('penyajian setelah batas ditolak kontrak (BatasWaktuTerlewati)', async function () {
      const id = await batchDiSekolah();
      await majukan(241);                                    // 4 jam 1 menit
      await assert.rejects(kontrak.methods.catatPenyajian(id, 120).call({ from: A.pic }), (e) => {
        assert.equal(e.innerError?.errorName, 'BatasWaktuTerlewati');
        return true;
      });
      assert.equal(Number((await baca('lihatBatch', id)).status), STATUS.Diterima, 'status tidak berubah');
    });

    it('alasan "lewat batas" hanya sah setelah batch benar-benar kedaluwarsa', async function () {
      const id = await batchDiSekolah();
      await ditolak(A.pic, 'tolakBatch', [id, ALASAN.LewatBatasWaktu, 120, ''], 'BelumKedaluwarsa');
      await majukan(245);
      const r = await tx(A.pic, 'tolakBatch', id, ALASAN.LewatBatasWaktu, 120, 'Tiba 10.20, lewat batas');
      const b = await baca('lihatBatch', id);
      assert.equal(Number(b.status), STATUS.Ditolak);
      assert.equal(Number(b.alasanTolak), ALASAN.LewatBatasWaktu);
      assert.equal(r.events.BatchDitolak.returnValues.catatan, 'Tiba 10.20, lewat batas');
    });

    it('penolakan karena kondisi bisa kapan saja, tetapi alasan wajib diisi', async function () {
      const id = await batchDiSekolah();
      await ditolak(A.pic, 'tolakBatch', [id, ALASAN.TidakAda, 120, ''], 'AlasanTidakValid');
      await tx(A.pic, 'tolakBatch', id, ALASAN.KondisiTidakLayak, 40, 'Sayur basi');
      assert.equal(Number((await baca('lihatBatch', id)).porsiSelesai), 40);
    });

    it('batch yang sudah disajikan atau ditolak tidak bisa dicatat ulang', async function () {
      const id = await batchDiSekolah();
      await tx(A.pic, 'catatPenyajian', id, 120);
      await ditolak(A.pic, 'catatPenyajian', [id, 120], 'StatusTidakSesuai');
      await ditolak(A.pic, 'tolakBatch', [id, ALASAN.Lainnya, 120, ''], 'StatusTidakSesuai');
    });
  });

  // ================================================================ 4
  describe('Insiden dan keterbukaan data', function () {
    it('insiden hanya dari sekolah tujuan atau Puskesmas, setelah batch diterima', async function () {
      const belum = await batchBaru();
      await ditolak(A.puskesmas, 'laporkanInsiden', [belum, 'Mual'], 'StatusTidakSesuai');
      const id = await batchDiSekolah();
      await tx(A.pic, 'catatPenyajian', id, 120);
      await ditolak(A.kurir, 'laporkanInsiden', [id, 'Mual'], 'BukanPetugas');
      await ditolak(A.picLain, 'laporkanInsiden', [id, 'Mual'], 'BatchOrganisasiLain');
      await tx(A.pic, 'laporkanInsiden', id, '3 siswa mual setelah makan');
      await tx(A.puskesmas, 'laporkanInsiden', id, 'Pemeriksaan sampel makanan');
      assert.equal(Number((await baca('lihatBatch', id)).jumlahInsiden), 2);
    });

    it('siapa pun bisa membaca data batch tanpa akun terdaftar', async function () {
      const id = await batchBaru();
      const b = await kontrak.methods.lihatBatch(id).call({ from: A.orangLuar });
      assert.equal(b.menu, MENU);
      await ditolak(A.orangLuar, 'lihatBatch', [9999], 'BatchTidakDitemukan');
    });
  });

  // ================================================================ 5
  describe('Klien Web3.js untuk front-end', function () {
    let klien;
    before(function () {
      klien = MBGChainClient.hubungkan(provider, { address: kontrak.options.address, abi: artefak.abi });
    });

    it('membaca peran dan organisasi akun saat masuk', async function () {
      const admin = await klien.masuk(A.admin);
      assert.equal(admin.admin, true);
      const p = await klien.masuk(A.pic);
      assert.deepEqual([p.nama, p.peran, p.organisasi, p.admin], ['Sinta', 'Sekolah', 'SDN Rawa Indah 03', false]);
      await assert.rejects(klien.masuk(A.orangLuar), (e) => e instanceof KesalahanMBG && e.kode === 'BukanPetugas');
      await klien.masuk(A.pic);
    });

    it('menampilkan batch lengkap dengan status kelayakan dan riwayat', async function () {
      const id = await batchDiSekolah();
      const b = await klien.batch(`B-${String(id).padStart(4, '0')}`);
      assert.equal(b.statusTeks, 'Diterima');
      assert.equal(b.kelayakanTeks, 'Aman');
      assert.deepEqual(b.riwayat.map((r) => r.tahap), ['Didaftarkan', 'Selesai masak', 'Diambil kurir', 'Diterima sekolah']);
      assert.deepEqual(b.riwayat.slice(1).map((r) => r.oleh), ['Rina', 'Budi', 'Sinta']);
      const daftar = await klien.daftarBatch({ sekolahId: ORG.sekolah });
      assert.ok(daftar.some((x) => x.id === id));
    });

    it('mengirim transaksi dengan tahap memeriksa → menunggu → tercatat', async function () {
      const id = await batchDiSekolah();
      const tahap = [];
      const bukti = await klien.catatPenyajian(id, 118, { onStatus: (t) => tahap.push(t) });
      assert.deepEqual(tahap, ['memeriksa', 'menunggu', 'tercatat']);
      assert.match(bukti.txHash, /^0x[0-9a-f]{64}$/);
      assert.equal(bukti.event.BatchDisajikan.porsiDisajikan, 118);
    });

    it('menerjemahkan penolakan kontrak menjadi pesan untuk pengguna', async function () {
      const id = await batchDiSekolah();
      await majukan(250);
      const tahap = [];
      await assert.rejects(klien.catatPenyajian(id, 100, { onStatus: (t) => tahap.push(t) }), (e) => {
        assert.equal(e.jenis, 'ditolak');
        assert.equal(e.kode, 'BatasWaktuTerlewati');
        assert.match(e.message, /4 jam/);
        return true;
      });
      assert.deepEqual(tahap, ['memeriksa', 'gagal']);
    });

    it('menyediakan daftar organisasi, petugas, dan semua batch untuk admin & pengawas', async function () {
      const [org, petugas, semua] = await Promise.all([klien.daftarOrganisasi(), klien.daftarPetugas(), klien.semuaBatch()]);
      assert.equal(org.length, 6);
      assert.deepEqual(org[2], { id: 3, jenis: 3, jenisTeks: 'Sekolah', nama: 'SDN Rawa Indah 03' });
      assert.ok(petugas.some((p) => p.nama === 'Sinta' && p.aktif));
      assert.ok(petugas.some((p) => p.nama === 'Petugas Sementara' && !p.aktif));
      assert.equal(semua.length, Number(await baca('jumlahBatch')));
    });

    it('alat demo dapat memajukan jam blockchain lokal', async function () {
      const sebelum = await klien.waktuChain();
      const sesudah = await klien.majukanWaktuLokal(15);
      assert.ok(sesudah - sebelum >= 15 * 60);
    });

    it('mengenali pesan gagal jaringan dari Node maupun browser', function () {
      for (const pesan of ['fetch failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed']) {
        assert.equal(terjemahkanError(new TypeError(pesan)).jenis, 'jaringan', pesan);
      }
    });

    it('melaporkan gagal jaringan bila node tidak bisa dihubungi', async function () {
      const putus = MBGChainClient.hubungkan('http://127.0.0.1:9', { address: kontrak.options.address, abi: artefak.abi });
      await assert.rejects(putus.batch(1), (e) => e instanceof KesalahanMBG && e.jenis === 'jaringan');
    });
  });
});
