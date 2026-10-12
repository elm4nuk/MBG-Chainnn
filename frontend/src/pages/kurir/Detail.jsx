// Detail batch untuk kurir: ambil batch di dapur (UC-03), serah terima ke kurir ditandatangani kurir.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMuat, useSesi, useTx } from '../../lib/sesi.jsx';
import { jam } from '../../lib/format.js';
import { AppBar, Halaman, Hero, Ikon, InfoBatch, Kosong, Overlay, Pesan, Riwayat, Skeleton, useKelayakan } from '../../components/ui.jsx';
import TxLayar from '../../components/TxLayar.jsx';

export default function DetailKurir() {
  const { kode } = useParams();
  const { klien, profil, sekarang } = useSesi();
  const nav = useNavigate();
  const nilaiK = useKelayakan();
  const { data: b, loading, error, reload } = useMuat(() => klien.batch(kode), [kode]);
  const { tx, jalankan, ulangi, tutup } = useTx();
  const [tanya, setTanya] = useState(false);

  if (loading && !b) return <Halaman><AppBar judul={`Batch ${kode}`} kembali="/kurir" /><div className="content"><Skeleton n={3} teks="Memuat data batch…" /></div></Halaman>;
  if (error || !b) return <Halaman><AppBar judul={`Batch ${kode}`} kembali="/kurir" /><div className="content"><Kosong ikon="search" judul="QR tidak dikenali">{error?.message || 'Batch tidak ditemukan.'}</Kosong></div></Halaman>;

  if (tx) {
    return (
      <Halaman>
        <TxLayar tx={tx}
          teks={{ menunggu: 'Mencatat pengambilan…', tercatat: 'Batch diambil', ditolak: 'Pengambilan ditolak sistem',
            pesan: (x) => `Batch ${b.kode} tercatat diambil pukul ${jam(x.waktu)}. Antar ke ${b.sekolah}.` }}
          onSelesai={() => nav('/kurir')} onKembali={() => { tutup(); reload(); }} onUlang={ulangi} />
      </Halaman>
    );
  }

  const k = nilaiK(b);
  const saya = b.akun.kurir.toLowerCase() === profil.akun.toLowerCase();
  return (
    <Halaman>
      <AppBar judul={`Batch ${b.kode}`} eyebrow={`${b.dapur} → ${b.sekolah}`} kembali="/kurir" />
      <div className="content">
        <Hero b={b} k={k} />
        {b.status === 0 && <Pesan jenis="info" ikon="clock">Batch belum selesai dimasak. Tunggu dapur mencatat selesai masak.</Pesan>}
        {b.status === 2 && saya && <Pesan jenis="info" ikon="truck">Antar ke {b.sekolah}. PIC sekolah mencatat penerimaan saat batch tiba.</Pesan>}
        {b.status === 2 && !saya && <Pesan>Batch ini sedang diantar kurir lain.</Pesan>}
        {b.status === 2 && k.kode === 3 && <Pesan>Batch sudah melewati batas 4 jam. Sekolah akan menolaknya; tetap serahkan agar keterlambatan tercatat.</Pesan>}
        <InfoBatch b={b} />
        <Riwayat b={b} />
      </div>
      {b.status === 1 && (
        <div className="actions"><button type="button" className="btn primary" onClick={() => setTanya(true)}><Ikon n="truck" />Ambil batch</button></div>
      )}

      {tanya && (
        <Overlay jenis="dialog" label="Ambil batch">
          <h2>Ambil batch {b.kode}?</h2>
          <dl className="kv">
            <dt>Dari</dt><dd>{b.dapur}</dd>
            <dt>Antar ke</dt><dd>{b.sekolah}</dd>
            <dt>Porsi</dt><dd>{b.porsi} porsi</dd>
            <dt>Batas konsumsi</dt><dd>{jam(k.batas)}</dd>
            <dt>Waktu</dt><dd>{jam(sekarang())}</dd>
            <dt>Kurir</dt><dd>{profil.nama}</dd>
          </dl>
          <p className="warn-line">Mulai saat ini batch menjadi tanggung jawab Anda sampai diterima sekolah.</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setTanya(false)}>Batal</button>
            <button type="button" className="btn primary" onClick={() => { setTanya(false); jalankan((onStatus) => klien.ambilBatch(b.id, { onStatus })); }}>Konfirmasi ambil</button>
          </div>
        </Overlay>
      )}
    </Halaman>
  );
}
