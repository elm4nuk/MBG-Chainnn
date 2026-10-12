// Detail batch untuk dapur: label QR (cetak) dan catat selesai masak (UC-02).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMuat, useSesi, useTx } from '../../lib/sesi.jsx';
import { jam } from '../../lib/format.js';
import { AppBar, Halaman, Hero, Ikon, InfoBatch, Kosong, Overlay, Pesan, Riwayat, Skeleton, useKelayakan } from '../../components/ui.jsx';
import { LabelQR } from '../../components/Qr.jsx';
import TxLayar from '../../components/TxLayar.jsx';

export default function DetailDapur() {
  const { kode } = useParams();
  const { klien, profil, sekarang } = useSesi();
  const nilaiK = useKelayakan();
  const { data: b, loading, error, reload } = useMuat(() => klien.batch(kode), [kode]);
  const { tx, jalankan, ulangi, tutup } = useTx();
  const [tanya, setTanya] = useState(false);

  if (loading && !b) return <Halaman><AppBar judul={`Batch ${kode}`} kembali="/dapur" /><div className="content"><Skeleton n={3} teks="Memuat data batch…" /></div></Halaman>;
  if (error || !b) return <Halaman><AppBar judul={`Batch ${kode}`} kembali="/dapur" /><div className="content"><Kosong ikon="search" judul="Batch tidak ditemukan">{error?.message}</Kosong></div></Halaman>;

  if (tx) {
    return (
      <Halaman>
        <TxLayar tx={tx}
          teks={{ menunggu: 'Mencatat selesai masak…', tercatat: 'Selesai masak tercatat', ditolak: 'Pencatatan ditolak sistem',
            pesan: (x) => `Batch ${b.kode} selesai dimasak pukul ${jam(x.waktu)}. Batas konsumsi ${jam(x.waktu + 4 * 3600)}.` }}
          labelSelesai="Kembali ke batch" onSelesai={() => { tutup(); reload(); }}
          onKembali={() => { tutup(); reload(); }} onUlang={ulangi} />
      </Halaman>
    );
  }

  const k = nilaiK(b);
  const milikSendiri = b.dapurId === profil.organisasiId;
  return (
    <Halaman>
      <AppBar judul={`Batch ${b.kode}`} eyebrow={b.sekolah} kembali="/dapur" />
      <div className="content">
        <LabelQR b={b} />
        <button type="button" className="btn secondary block" onClick={() => window.print()}><Ikon n="printer" />Cetak label QR</button>
        {!milikSendiri && <Pesan>Batch ini milik {b.dapur}. Anda hanya dapat melihat datanya.</Pesan>}
        <Hero b={b} k={k} />
        {b.status === 1 && <Pesan jenis="info" ikon="truck">Batch siap diambil. Kurir memindai QR ini saat mengambil, dan pengambilan tercatat atas nama kurir.</Pesan>}
        <InfoBatch b={b} />
        <Riwayat b={b} />
      </div>
      {b.status === 0 && milikSendiri && (
        <div className="actions"><button type="button" className="btn primary" onClick={() => setTanya(true)}><Ikon n="check" />Catat selesai masak</button></div>
      )}

      {tanya && (
        <Overlay jenis="dialog" label="Catat selesai masak">
          <h2>Catat selesai masak?</h2>
          <dl className="kv">
            <dt>Batch</dt><dd>{b.kode} · {b.porsi} porsi</dd>
            <dt>Sekolah tujuan</dt><dd>{b.sekolah}</dd>
            <dt>Waktu</dt><dd>{jam(sekarang())}</dd>
            <dt>Batas konsumsi</dt><dd>{jam(sekarang() + 4 * 3600)}</dd>
          </dl>
          <p className="warn-line">Hitungan 4 jam dimulai dari waktu blok saat dicatat. Catat hanya jika makanan benar-benar sudah matang.</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setTanya(false)}>Batal</button>
            <button type="button" className="btn primary" onClick={() => { setTanya(false); jalankan((onStatus) => klien.catatSelesaiMasak(b.id, { onStatus })); }}>Catat sekarang</button>
          </div>
        </Overlay>
      )}
    </Halaman>
  );
}
