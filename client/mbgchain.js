// Penghubung aplikasi (React) ke smart contract MBGChain melalui viem.
// Dipakai juga oleh script demo dan unit test, jadi koneksi front-end teruji dengan kode yang sama.
// API kelas ini sama dengan versi Web3.js sebelumnya, sehingga layar aplikasi tidak perlu berubah.
import {
  BaseError, ContractFunctionRevertedError, HttpRequestError, TimeoutError,
  createPublicClient, createWalletClient, custom, getAddress, http, parseEventLogs,
} from 'viem';

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

const angka = (x) => Number(x ?? 0); // viem mengembalikan BigInt untuk uint
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

/** Ubah argumen custom error (array) menjadi objek bernama, mis. { batasKonsumsi: 1712345678 }. */
function argumenBernama(abi, namaError, args = []) {
  const masukan = abi?.find((x) => x.type === 'error' && x.name === namaError)?.inputs || [];
  return Object.fromEntries(masukan.map((m, i) => [m.name || String(i), typeof args[i] === 'bigint' ? Number(args[i]) : args[i]]));
}

export function terjemahkanError(e, abi) {
  if (e instanceof KesalahanMBG) return e;
  if (e instanceof BaseError) {
    const tolak = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const nama = tolak?.data?.errorName;
    if (nama && PESAN_ERROR[nama]) return new KesalahanMBG('ditolak', nama, PESAN_ERROR[nama], argumenBernama(abi, nama, tolak.data.args));
    if (e.walk((x) => x instanceof HttpRequestError || x instanceof TimeoutError)) {
      return new KesalahanMBG('jaringan', 'Jaringan', 'Tidak dapat terhubung ke jaringan MBG-Chain. Periksa koneksi lalu coba lagi.', e.shortMessage);
    }
  }
  const teks = String(e?.message || e);
  // Node: "fetch failed"; Chrome: "Failed to fetch"; Firefox: "NetworkError…"; Safari: "Load failed"
  if (/fetch failed|failed to fetch|load failed|networkerror|HTTP request failed|ECONNREFUSED|ENOTFOUND|network|connection|timeout|socket/i.test(teks + String(e?.cause?.message || ''))) {
    return new KesalahanMBG('jaringan', 'Jaringan', 'Tidak dapat terhubung ke jaringan MBG-Chain. Periksa koneksi lalu coba lagi.', teks);
  }
  return new KesalahanMBG('ditolak', 'TidakDiketahui', 'Transaksi dibatalkan oleh smart contract.', teks);
}

export class MBGChainClient {
  /**
   * @param transport transport viem (http untuk URL RPC, custom untuk provider EIP-1193)
   * @param deployment isi deployments/<jaringan>.json ({ address, abi, ... })
   */
  constructor(transport, deployment) {
    this.publik = createPublicClient({ transport, pollingInterval: 250 });
    this.dompet = createWalletClient({ transport });
    this.alamat = getAddress(deployment.address);
    this.abi = deployment.abi;
    this.akun = null;
    this._nama = new Map();
  }

  /** provider: URL RPC (mis. http://127.0.0.1:8545) atau provider EIP-1193 (Hardhat, Ganache di browser). */
  static hubungkan(provider, deployment) {
    const transport = typeof provider === 'string'
      ? http(provider, { retryCount: 0, timeout: 15_000 })
      : custom(provider, { retryCount: 0 }); // penolakan kontrak tidak perlu diulang
    return new MBGChainClient(transport, deployment);
  }

  // ------------------------------------------------------------ Akun

  admin() {
    return this._baca('admin');
  }

  async profil(akun) {
    const r = await this._baca('profilPetugas', akun);
    const jenis = angka(r.jenis);
    return { akun, nama: r.nama, aktif: r.aktif, organisasiId: angka(r.organisasiId), jenis, peran: JENIS_ORGANISASI[jenis], organisasi: r.namaOrganisasi };
  }

  /** Menautkan akun yang login. Peran dibaca dari kontrak (admin BGN atau jenis organisasi petugas), bukan dari aplikasi. */
  async masuk(akun) {
    const [p, admin] = await Promise.all([this.profil(akun), this.admin()]);
    if (admin.toLowerCase() === akun.toLowerCase()) {
      this.akun = getAddress(akun);
      return { ...p, nama: 'Admin BGN', peran: 'Admin BGN', admin: true };
    }
    if (!p.aktif) throw new KesalahanMBG('ditolak', 'BukanPetugas', PESAN_ERROR.BukanPetugas);
    this.akun = getAddress(akun);
    return { ...p, admin: false };
  }

  // ------------------------------------------------------------ Baca data (gratis, tanpa transaksi)

  /** Jam blockchain saat ini (blok 'pending'); dipakai untuk hitung mundur batas 4 jam di layar. */
  async waktuChain() {
    try {
      return angka((await this.publik.getBlock({ blockTag: 'pending' })).timestamp);
    } catch {
      return angka((await this._jalankan(() => this.publik.getBlock({ blockTag: 'latest' }))).timestamp);
    }
  }

  async batch(kodeAtauId) {
    const id = idBatch(kodeAtauId);
    const [b, k] = await Promise.all([this._baca('lihatBatch', BigInt(id)), this._baca('cekKelayakan', BigInt(id))]);
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
    const ev = await this._event('PetugasDidaftarkan');
    const akunUnik = [...new Set(ev.map((e) => e.args.akun))];
    return Promise.all(akunUnik.map((akun) => this.profil(akun)));
  }

  /** Akun yang dikelola node (prototype: akun chain lokal), dipakai admin saat mendaftarkan petugas. */
  async akunNode() {
    return (await this._jalankan(() => this.dompet.getAddresses())).map((a) => getAddress(a));
  }

  async jaringan() {
    return { chainId: angka(await this._jalankan(() => this.publik.getChainId())), kontrak: this.alamat };
  }

  /** Alat demo khusus jaringan lokal (Hardhat/Ganache): memajukan jam blockchain untuk memperlihatkan aturan 4 jam. */
  async majukanWaktuLokal(menit) {
    const { chainId } = await this.jaringan();
    if (chainId !== 1337 && chainId !== 31337) throw new KesalahanMBG('ditolak', 'BukanLokal', 'Simulasi waktu hanya untuk jaringan lokal.');
    await this._jalankan(() => this.publik.request({ method: 'evm_increaseTime', params: [Math.round(menit * 60)] }));
    await this._jalankan(() => this.publik.request({ method: 'evm_mine', params: [] }));
    return this.waktuChain();
  }

  /** Daftar batch per sekolah/dapur dari event BatchDidaftarkan (kontrak tidak perlu menyimpan array). */
  async daftarBatch({ sekolahId, dapurId } = {}) {
    const args = {};
    if (sekolahId) args.sekolahId = sekolahId;
    if (dapurId) args.dapurId = dapurId;
    const ev = await this._event('BatchDidaftarkan', args);
    return Promise.all(ev.map((e) => this.batch(angka(e.args.id))));
  }

  /** Jejak audit satu batch: semua event yang menyebut batch tersebut, urut waktu, beserta penanda tangan transaksinya (UC-10). */
  async jejakAudit(kodeAtauId) {
    const id = idBatch(kodeAtauId);
    const semua = await this._event();
    const milikBatch = semua.filter((e) => e.eventName?.startsWith('Batch') || e.eventName === 'InsidenDilaporkan')
      .filter((e) => angka(e.args.id) === id);
    return Promise.all(milikBatch.map(async (e) => {
      const [blok, tx] = await Promise.all([
        this._jalankan(() => this.publik.getBlock({ blockNumber: e.blockNumber })),
        this._jalankan(() => this.publik.getTransaction({ hash: e.transactionHash })),
      ]);
      return {
        event: e.eventName,
        blok: angka(e.blockNumber),
        txHash: e.transactionHash,
        waktu: angka(blok.timestamp),
        dari: tx?.from ? getAddress(tx.from) : '',
        data: normalisasi(e.args),
      };
    }));
  }

  // ------------------------------------------------------------ Transaksi (butuh akun yang sudah masuk)

  /** jenis: 1 = SPPG, 2 = mitra distribusi, 3 = sekolah, 4 = Puskesmas (khusus admin BGN) */
  daftarkanOrganisasi(jenis, nama, opsi) { return this._kirim('daftarkanOrganisasi', [jenis, nama], opsi); }
  daftarkanPetugas(akun, organisasiId, nama, opsi) { return this._kirim('daftarkanPetugas', [getAddress(akun), organisasiId, nama], opsi); }
  nonaktifkanPetugas(akun, opsi) { return this._kirim('nonaktifkanPetugas', [getAddress(akun)], opsi); }

  daftarkanBatch(sekolahId, menu, porsi, opsi) { return this._kirim('daftarkanBatch', [sekolahId, menu, porsi], opsi); }
  catatSelesaiMasak(id, opsi) { return this._kirim('catatSelesaiMasak', [BigInt(idBatch(id))], opsi); }
  ambilBatch(id, opsi) { return this._kirim('ambilBatch', [BigInt(idBatch(id))], opsi); }
  terimaBatch(id, porsi, opsi) { return this._kirim('terimaBatch', [BigInt(idBatch(id)), porsi], opsi); }
  catatPenyajian(id, porsi, opsi) { return this._kirim('catatPenyajian', [BigInt(idBatch(id)), porsi], opsi); }
  /** alasan: 1 = lewat batas 4 jam, 2 = kondisi tidak layak, 3 = lainnya */
  tolakBatch(id, alasan, porsi, catatan = '', opsi) { return this._kirim('tolakBatch', [BigInt(idBatch(id)), alasan, porsi, catatan], opsi); }
  laporkanInsiden(id, keterangan, opsi) { return this._kirim('laporkanInsiden', [BigInt(idBatch(id)), keterangan], opsi); }

  /**
   * Alur satu transaksi, sama dengan state UI di Session 10:
   * memeriksa -> menunggu (Pending) -> tercatat (Confirmed), atau gagal (Rejected / Failed).
   * Tidak ada pop-up dompet: akun petugas dikelola jaringan berizin (di prototype: akun node lokal).
   */
  async _kirim(fungsi, args, { onStatus } = {}) {
    const lapor = (tahap, data) => onStatus && onStatus(tahap, data);
    if (!this.akun) throw new KesalahanMBG('ditolak', 'BelumMasuk', PESAN_ERROR.BelumMasuk);
    const panggilan = { address: this.alamat, abi: this.abi, functionName: fungsi, args, account: this.akun };
    try {
      lapor('memeriksa');
      await this.publik.simulateContract(panggilan);         // simulasi (eth_call): aturan kontrak dicek tanpa biaya
      const gas = await this.publik.estimateContractGas(panggilan);
      const txHash = await this.dompet.writeContract({ ...panggilan, gas: (gas * 12n) / 10n, chain: null });
      lapor('menunggu', { txHash });
      const receipt = await this.publik.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') throw Object.assign(new Error('Transaksi gagal dieksekusi'), { receipt });
      const blok = await this.publik.getBlock({ blockNumber: receipt.blockNumber });
      const event = Object.fromEntries(parseEventLogs({ abi: this.abi, logs: receipt.logs })
        .filter((l) => l.address.toLowerCase() === this.alamat.toLowerCase())
        .map((l) => [l.eventName, normalisasi(l.args)]));
      const bukti = { txHash, blok: angka(receipt.blockNumber), waktu: angka(blok.timestamp), gas: angka(receipt.gasUsed), event };
      lapor('tercatat', bukti);
      return bukti;
    } catch (e) {
      let err = terjemahkanError(e, this.abi);
      if (err.kode === 'TidakDiketahui') {
        // Gagal saat dieksekusi (mis. batas lewat tepat sebelum blok dibuat): simulasikan ulang untuk tahu alasannya.
        try { await this.publik.simulateContract(panggilan); } catch (e2) { err = terjemahkanError(e2, this.abi); }
      }
      lapor('gagal', err);
      throw err;
    }
  }

  // ------------------------------------------------------------ Internal

  /** Baca fungsi view; keluaran ganda (mis. profilPetugas) dijadikan objek bernama seperti struct. */
  async _baca(fungsi, ...args) {
    const hasil = await this._jalankan(() => this.publik.readContract({ address: this.alamat, abi: this.abi, functionName: fungsi, args }));
    const keluaran = this.abi.find((x) => x.type === 'function' && x.name === fungsi)?.outputs || [];
    if (keluaran.length > 1 && Array.isArray(hasil)) return Object.fromEntries(keluaran.map((o, i) => [o.name || String(i), hasil[i]]));
    return hasil;
  }

  _event(eventName, args) {
    return this._jalankan(() => this.publik.getContractEvents({
      address: this.alamat, abi: this.abi, eventName, args, fromBlock: 0n, toBlock: 'latest',
    }));
  }

  async _jalankan(fn) {
    try { return await fn(); } catch (e) { throw terjemahkanError(e, this.abi); }
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
    if (/^\d+$/.test(k)) continue;
    hasil[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return hasil;
}
