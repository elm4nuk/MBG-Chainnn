// Format tampilan dan aturan kelayakan (sama dengan smart contract: 4 jam, peringatan 60 menit).
export const BATAS_KONSUMSI = 4 * 3600;
export const AMBANG_PERINGATAN = 3600;
export const KELAYAKAN = ['Belum dimasak', 'Aman', 'Mendekati batas', 'Kedaluwarsa'];
export const NADA_KELAYAKAN = ['netral', 'ok', 'warn', 'bad'];
export const ALASAN = [
  { kode: 1, teks: 'Lewat batas 4 jam' },
  { kode: 2, teks: 'Kondisi makanan tidak layak' },
  { kode: 3, teks: 'Lainnya' },
];
export const BERANDA_PERAN = { 1: '/dapur', 2: '/kurir', 3: '/sekolah', 4: '/puskesmas' };
export const berandaUntuk = (p) => (p?.admin ? '/admin' : BERANDA_PERAN[p?.jenis] || '/masuk');

/** Hitung kelayakan dari waktu selesai masak dan jam chain saat ini (untuk hitung mundur di layar). */
export function kelayakan(b, sekarang) {
  if (!b.waktuMasak) return { kode: 0, sisa: 0, lewat: 0, batas: 0, persen: 0 };
  const batas = b.waktuMasak + BATAS_KONSUMSI;
  const persen = Math.min(100, Math.max(0, ((sekarang - b.waktuMasak) / BATAS_KONSUMSI) * 100));
  if (sekarang > batas) return { kode: 3, sisa: 0, lewat: sekarang - batas, batas, persen: 100 };
  const sisa = batas - sekarang;
  return { kode: sisa <= AMBANG_PERINGATAN ? 2 : 1, sisa, lewat: 0, batas, persen };
}

/** Nada & teks status batch untuk chip. */
export function statusBatch(b) {
  return [
    { nada: 'netral', teks: 'Terdaftar' },
    { nada: 'pend', teks: 'Siap diambil' },
    { nada: 'pend', teks: 'Dalam perjalanan' },
    { nada: 'pend', teks: 'Diterima' },
    { nada: 'ok', teks: 'Disajikan' },
    { nada: 'bad', teks: 'Ditolak' },
  ][b.status];
}

export const jam = (t) => (t ? new Date(t * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—');
export const jamDetik = (t) => new Date(t * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const tanggal = (t) => new Date(t * 1000).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

/** 2700 → "45 m", 5700 → "1 j 35 m" */
export function durasi(detik) {
  const m = Math.max(0, Math.round(detik / 60));
  const j = Math.floor(m / 60);
  return j ? `${j} j ${m % 60} m` : `${m} m`;
}

/** Untuk angka besar di kartu kelayakan: { besar: '45', satuan: 'menit lagi' } */
export function durasiBesar(detik, lewat = false) {
  const m = Math.max(0, Math.round(detik / 60));
  const j = Math.floor(m / 60);
  const besar = j ? `${j} j ${m % 60}` : `${m}`;
  return { besar, satuan: lewat ? 'menit lewat batas' : 'menit lagi' };
}

export const pendek = (h, a = 8, b = 6) => (h ? `${h.slice(0, a)}…${h.slice(-b)}` : '');
export const angkaID = (n) => Number(n).toLocaleString('id-ID');

/** Ambil kode batch dari isi QR: "B-0002", "b2", atau URL ".../#/verifikasi/B-0002". */
export function kodeDariTeks(teks) {
  const m = String(teks || '').trim().match(/B-?(\d{1,6})\s*$/i) || String(teks || '').match(/verifikasi\/B-?(\d{1,6})/i);
  return m ? `B-${m[1].padStart(4, '0')}` : null;
}
