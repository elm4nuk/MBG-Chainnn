// Penghubung aplikasi (React) ke smart contract MBGChain melalui Web3.js.
// Dipakai juga oleh script demo dan unit test, jadi koneksi front-end sudah teruji sejak sekarang.
import { Web3 } from 'web3';

export const JENIS_ORGANISASI = ['Belum terdaftar', 'SPPG', 'Mitra distribusi', 'Sekolah', 'Puskesmas'];
export const STATUS_BATCH = ['Terdaftar', 'Selesai masak', 'Dalam perjalanan', 'Diterima', 'Disajikan', 'Ditolak'];
export const KELAYAKAN = ['Belum dimasak', 'Aman', 'Mendekati batas', 'Kedaluwarsa'];
export const ALASAN_TOLAK = ['-', 'Lewat batas 4 jam', 'Kondisi makanan tidak layak', 'Lainnya'];

/** Pesan untuk setiap custom error di kontrak (ditampilkan apa adanya di UI). */
export const PESAN_ERROR = {
  BukanAdmin: 'Hanya admin BGN yang dapat melakukan tindakan ini.',
  BukanPetugas: 'Akun Anda tidak berwenang untuk tindakan ini.',
  BatchOrganisasiLain: 'Batch ini bukan untuk sekolah atau dapur Anda.',
  OrganisasiTidakValid: 'Organisasi tujuan tidak valid.',
  BatchTidakDitemukan: 'Batch tidak ditemukan. Periksa kembali kode QR.',
  StatusTidakSesuai: 'Status batch sudah berubah. Muat ulang data batch.',
  PorsiTidakValid: 'Jumlah porsi tidak valid.',
  AlasanTidakValid: 'Pilih alasan penolakan.',
  BatasWaktuTerlewati: 'Batas 4 jam sudah lewat, penyajian ditolak sistem. Catat penolakan batch.',
  BelumKedaluwarsa: 'Batch belum melewati batas 4 jam. Pilih alasan penolakan lain.',
  BelumMasuk: 'Masuk terlebih dahulu.',
};

export const kodeBatch = (id) => `B-${String(id).padStart(4, '0')}`;
export const idBatch = (kodeAtauId) => Number(String(kodeAtauId).replace(/[^0-9]/g, ''));

const angka = (x) => Number(x ?? 0); // Web3.js v4 mengembalikan BigInt untuk uint
const ALAMAT_KOSONG = /^0x0{40}$/i;

/** Kesalahan yang siap ditampilkan. jenis: 'ditolak' (aturan kontrak) | 'jaringan' (node tidak terjangkau). */
export class KesalahanMBG extends Error {
  constructor(jenis, kode, pesan, detail) {
    super(pesan);
    this.name = 'KesalahanMBG';
    this.jenis = jenis;
    this.kode = kode;
    this.detail = detail;
  }
}

export function terjemahkanError(e) {
  if (e instanceof KesalahanMBG) return e;
  const nama = e?.innerError?.errorName || e?.cause?.errorName;
  if (nama && PESAN_ERROR[nama]) return new KesalahanMBG('ditolak', nama, PESAN_ERROR[nama], e.innerError?.errorArgs);
  const teks = String(e?.message || e);
  // Node: "fetch failed"; Chrome: "Failed to fetch"; Firefox: "NetworkError…"; Safari: "Load failed"
  if (/fetch failed|failed to fetch|load failed|networkerror|ECONNREFUSED|ENOTFOUND|network|connection|timeout|socket/i.test(teks + String(e?.cause?.message || ''))) {
    return new KesalahanMBG('jaringan', 'Jaringan', 'Tidak dapat terhubung ke jaringan MBG-Chain. Periksa koneksi lalu coba lagi.', teks);
  }
  return new KesalahanMBG('ditolak', 'TidakDiketahui', 'Transaksi dibatalkan oleh smart contract.', teks);
}

export class MBGChainClient {
  /** @param deployment isi deployments/<jaringan>.json ({ address, abi, ... }) */
  constructor(web3, deployment) {
    this.web3 = web3;
    this.kontrak = new web3.eth.Contract(deployment.abi, deployment.address);
    this.akun = null;
    this._nama = new Map();
  }

  /** provider: URL RPC (mis. http://127.0.0.1:8545) atau provider EIP-1193. */
  static hubungkan(provider, deployment) {
    return new MBGChainClient(new Web3(provider), deployment);
  }

  // ------------------------------------------------------------ Akun

  async profil(akun) {
    const r = await this._baca('profilPetugas', akun);
    const jenis = angka(r.jenis);
    return { akun, nama: r.nama, aktif: r.aktif, organisasiId: angka(r.organisasiId), jenis, peran: JENIS_ORGANISASI[jenis], organisasi: r.namaOrganisasi };
  }

  /** Menautkan akun yang login. Peran dibaca dari kontrak (admin BGN atau jenis organisasi petugas), bukan dari aplikasi. */
  async masuk(akun) {
    const [p, admin] = await Promise.all([this.profil(akun), this._baca('admin')]);
    if (admin.toLowerCase() === akun.toLowerCase()) {
      this.akun = akun;
      return { ...p, nama: 'Admin BGN', peran: 'Admin BGN', admin: true };
    }
    if (!p.aktif) throw new KesalahanMBG('ditolak', 'BukanPetugas', PESAN_ERROR.BukanPetugas);
    this.akun = akun;
    return { ...p, admin: false };
  }

  // ------------------------------------------------------------ Baca data (gratis, tanpa transaksi)

  /** Jam blockchain saat ini (blok 'pending'); dipakai untuk hitung mundur batas 4 jam di layar. */
  async waktuChain() {
    try {
      return angka((await this.web3.eth.getBlock('pending')).timestamp);
    } catch {
      return angka((await this.web3.eth.getBlock('latest')).timestamp);
    }
  }

  async batch(kodeAtauId) {
    const id = idBatch(kodeAtauId);
    const [b, k] = await Promise.all([this._baca('lihatBatch', id), this._baca('cekKelayakan', id)]);
    const [dapur, sekolah, petugasDapur, kurir, penerima, pencatat] = await Promise.all([
      this._namaOrganisasi(b.dapurId), this._namaOrganisasi(b.sekolahId),
      this._namaPetugas(b.petugasDapur), this._namaPetugas(b.kurir), this._namaPetugas(b.penerima), this._namaPetugas(b.pencatat),
    ]);
    const status = angka(b.status);
    const kelayakan = angka(k.status);
    const riwayat = [
      { tahap: 'Didaftarkan', waktu: angka(b.waktuDaftar), oleh: dapur },
      { tahap: 'Selesai masak', waktu: angka(b.waktuMasak), oleh: petugasDapur },
      { tahap: 'Diambil kurir', waktu: angka(b.waktuDiambil), oleh: kurir },
      { tahap: 'Diterima sekolah', waktu: angka(b.waktuDiterima), oleh: penerima, porsi: angka(b.porsiDiterima) },
      { tahap: status === 5 ? 'Ditolak' : 'Disajikan', waktu: angka(b.waktuSelesai), oleh: pencatat, porsi: angka(b.porsiSelesai) },
    ].filter((r) => r.waktu > 0);
    return {
      id, kode: kodeBatch(id), menu: b.menu, porsi: angka(b.porsi),
      dapurId: angka(b.dapurId), dapur, sekolahId: angka(b.sekolahId), sekolah,
      status, statusTeks: STATUS_BATCH[status], selesai: status >= 4, // sudah disajikan / ditolak
      kelayakan, kelayakanTeks: KELAYAKAN[kelayakan],
      waktuMasak: angka(b.waktuMasak), batasKonsumsi: angka(k.batasKonsumsi), sisaDetik: angka(k.sisaDetik),
      porsiDiterima: angka(b.porsiDiterima), porsiSelesai: angka(b.porsiSelesai),
      alasanTolak: ALASAN_TOLAK[angka(b.alasanTolak)], jumlahInsiden: angka(b.jumlahInsiden),
      akun: { petugasDapur: b.petugasDapur, kurir: b.kurir, penerima: b.penerima, pencatat: b.pencatat },
      riwayat,
    };
  }

  /** Semua batch di jaringan (dipakai pengawas dan kurir). */
  async semuaBatch() {
    const n = angka(await this._baca('jumlahBatch'));
    return Promise.all(Array.from({ length: n }, (_, i) => this.batch(i + 1)));
  }

  async daftarOrganisasi() {
    const n = angka(await this._baca('jumlahOrganisasi'));
    return Promise.all(Array.from({ length: n }, async (_, i) => {
      const o = await this._baca('organisasi', i + 1);
      const jenis = angka(o.jenis);
      return { id: i + 1, jenis, jenisTeks: JENIS_ORGANISASI[jenis], nama: o.nama };
    }));
  }

  /** Petugas dari event PetugasDidaftarkan, dengan status terkini dari kontrak. */
  async daftarPetugas() {
    const ev = await this._jalankan(() => this.kontrak.getPastEvents('PetugasDidaftarkan', { fromBlock: 0, toBlock: 'latest' }));
    const akunUnik = [...new Set(ev.map((e) => e.returnValues.akun))];
    return Promise.all(akunUnik.map((akun) => this.profil(akun)));
  }

  /** Akun yang dikelola node (prototype: akun Ganache), dipakai admin saat mendaftarkan petugas. */
  akunNode() {
    return this._jalankan(() => this.web3.eth.getAccounts());
  }

  async jaringan() {
    return { chainId: angka(await this._jalankan(() => this.web3.eth.getChainId())), kontrak: this.kontrak.options.address };
  }

  /** Alat demo khusus jaringan lokal (Ganache/Hardhat): memajukan jam blockchain untuk memperlihatkan aturan 4 jam. */
  async majukanWaktuLokal(menit) {
    const { chainId } = await this.jaringan();
    if (chainId !== 1337 && chainId !== 31337) throw new KesalahanMBG('ditolak', 'BukanLokal', 'Simulasi waktu hanya untuk jaringan lokal.');
    await this._jalankan(() => this.web3.requestManager.send({ method: 'evm_increaseTime', params: [Math.round(menit * 60)] }));
    await this._jalankan(() => this.web3.requestManager.send({ method: 'evm_mine', params: [] }));
    return this.waktuChain();
  }

  /** Daftar batch per sekolah/dapur dari event BatchDidaftarkan (kontrak tidak perlu menyimpan array). */
  async daftarBatch({ sekolahId, dapurId } = {}) {
    const filter = {};
    if (sekolahId) filter.sekolahId = sekolahId;
    if (dapurId) filter.dapurId = dapurId;
    const ev = await this._jalankan(() => this.kontrak.getPastEvents('BatchDidaftarkan', { filter, fromBlock: 0, toBlock: 'latest' }));
    return Promise.all(ev.map((e) => this.batch(angka(e.returnValues.id))));
  }

  /** Jejak audit satu batch: semua event yang menyebut batch tersebut, urut waktu (UC-10). */
  async jejakAudit(kodeAtauId) {
    const id = idBatch(kodeAtauId);
    const semua = await this._jalankan(() => this.kontrak.getPastEvents('allEvents', { fromBlock: 0, toBlock: 'latest' }));
    const milikBatch = semua.filter((e) => e.event?.startsWith('Batch') || e.event === 'InsidenDilaporkan')
      .filter((e) => angka(e.returnValues.id) === id);
    return Promise.all(milikBatch.map(async (e) => ({
      event: e.event,
      blok: angka(e.blockNumber),
      txHash: e.transactionHash,
      waktu: angka((await this.web3.eth.getBlock(e.blockNumber)).timestamp),
      data: normalisasi(e.returnValues),
    })));
  }

  // ------------------------------------------------------------ Transaksi (butuh akun yang sudah masuk)

  /** jenis: 1 = SPPG, 2 = mitra distribusi, 3 = sekolah, 4 = Puskesmas (khusus admin BGN) */
  daftarkanOrganisasi(jenis, nama, opsi) { return this._kirim('daftarkanOrganisasi', [jenis, nama], opsi); }
  daftarkanPetugas(akun, organisasiId, nama, opsi) { return this._kirim('daftarkanPetugas', [akun, organisasiId, nama], opsi); }
  nonaktifkanPetugas(akun, opsi) { return this._kirim('nonaktifkanPetugas', [akun], opsi); }

  daftarkanBatch(sekolahId, menu, porsi, opsi) { return this._kirim('daftarkanBatch', [sekolahId, menu, porsi], opsi); }
  catatSelesaiMasak(id, opsi) { return this._kirim('catatSelesaiMasak', [idBatch(id)], opsi); }
  ambilBatch(id, opsi) { return this._kirim('ambilBatch', [idBatch(id)], opsi); }
  terimaBatch(id, porsi, opsi) { return this._kirim('terimaBatch', [idBatch(id), porsi], opsi); }
  catatPenyajian(id, porsi, opsi) { return this._kirim('catatPenyajian', [idBatch(id), porsi], opsi); }
  /** alasan: 1 = lewat batas 4 jam, 2 = kondisi tidak layak, 3 = lainnya */
  tolakBatch(id, alasan, porsi, catatan = '', opsi) { return this._kirim('tolakBatch', [idBatch(id), alasan, porsi, catatan], opsi); }
  laporkanInsiden(id, keterangan, opsi) { return this._kirim('laporkanInsiden', [idBatch(id), keterangan], opsi); }

  /**
   * Alur satu transaksi, sama dengan state UI di Session 10:
   * memeriksa -> menunggu (Pending) -> tercatat (Confirmed), atau gagal (Rejected / Failed).
   * Tidak ada pop-up dompet: akun petugas dikelola jaringan berizin.
   */
  async _kirim(fungsi, args, { onStatus } = {}) {
    const lapor = (tahap, data) => onStatus && onStatus(tahap, data);
    if (!this.akun) throw new KesalahanMBG('ditolak', 'BelumMasuk', PESAN_ERROR.BelumMasuk);
    const metode = this.kontrak.methods[fungsi](...args);
    try {
      lapor('memeriksa');
      await metode.call({ from: this.akun });             // simulasi: aturan kontrak dicek tanpa biaya
      const gas = await metode.estimateGas({ from: this.akun });
      const receipt = await metode.send({ from: this.akun, gas: String(Math.ceil(angka(gas) * 1.2)) })
        .on('transactionHash', (txHash) => lapor('menunggu', { txHash }));
      const blok = await this.web3.eth.getBlock(receipt.blockNumber);
      const event = Object.fromEntries(Object.entries(receipt.events || {}).map(([nama, ev]) => [nama, normalisasi(ev.returnValues)]));
      const bukti = { txHash: receipt.transactionHash, blok: angka(receipt.blockNumber), waktu: angka(blok.timestamp), gas: angka(receipt.gasUsed), event };
      lapor('tercatat', bukti);
      return bukti;
    } catch (e) {
      let err = terjemahkanError(e);
      if (err.kode === 'TidakDiketahui' && e?.receipt) {
        // Gagal saat dieksekusi (mis. batas lewat tepat sebelum blok dibuat): simulasikan ulang untuk tahu alasannya.
        try { await metode.call({ from: this.akun }); } catch (e2) { err = terjemahkanError(e2); }
      }
      lapor('gagal', err);
      throw err;
    }
  }

  // ------------------------------------------------------------ Internal

  _baca(fungsi, ...args) {
    return this._jalankan(() => this.kontrak.methods[fungsi](...args).call());
  }

  async _jalankan(fn) {
    try { return await fn(); } catch (e) { throw terjemahkanError(e); }
  }

  async _namaOrganisasi(id) {
    const n = angka(id);
    if (!n) return '';
    if (!this._nama.has(`o${n}`)) this._nama.set(`o${n}`, (await this._baca('organisasi', n)).nama);
    return this._nama.get(`o${n}`);
  }

  async _namaPetugas(akun) {
    if (!akun || ALAMAT_KOSONG.test(akun)) return '';
    if (!this._nama.has(akun)) this._nama.set(akun, (await this._baca('petugas', akun)).nama);
    return this._nama.get(akun);
  }
}

function normalisasi(nilai) {
  const hasil = {};
  for (const [k, v] of Object.entries(nilai || {})) {
    if (/^\d+$/.test(k) || k === '__length__') continue;
    hasil[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return hasil;
}
