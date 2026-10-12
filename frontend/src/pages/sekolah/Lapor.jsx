// Lapor insiden setelah makanan disajikan/diterima (UC-08), dipakai PIC sekolah dan petugas Puskesmas.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMuat, useSesi, useTx } from '../../lib/sesi.jsx';
import { jam } from '../../lib/format.js';
import { AppBar, Galat, Halaman, Kosong, Overlay, Pesan, Skeleton, TabBar } from '../../components/ui.jsx';
import TxLayar from '../../components/TxLayar.jsx';
import { TABS_PUSKESMAS, TABS_SEKOLAH } from '../tabs.js';

export default function Lapor({ puskesmas = false }) {
  const { klien, profil, sekarang } = useSesi();
  const nav = useNavigate();
  const [cari] = useSearchParams();
  const { data, loading, error } = useMuat(
    () => (puskesmas ? klien.semuaBatch() : klien.daftarBatch({ sekolahId: profil.organisasiId })), [profil.organisasiId, puskesmas]);
  const { tx, jalankan, ulangi, tutup } = useTx();
  const [kode, setKode] = useState(cari.get('kode') || '');
  const [ket, setKet] = useState('');
  const [galat, setGalat] = useState({});
  const [tinjau, setTinjau] = useState(false);
  const tabs = puskesmas ? TABS_PUSKESMAS : TABS_SEKOLAH;
  const beranda = puskesmas ? '/puskesmas' : '/sekolah';

  const pilihan = (data || []).filter((b) => b.status >= 3);
  const dipilih = pilihan.find((b) => b.kode === kode);

  if (tx) {
    return (
      <Halaman>
        <TxLayar tx={tx}
          teks={{ menunggu: 'Mengirim laporan insiden…', tercatat: 'Laporan insiden tercatat', ditolak: 'Laporan ditolak sistem',
            pesan: (x) => `Laporan untuk batch ${kode} tercatat pukul ${jam(x.waktu)} dan dapat dilihat pengawas.` }}
          onSelesai={() => nav(beranda)} onKembali={tutup} onUlang={ulangi} />
      </Halaman>
    );
  }

  const periksa = (e) => {
    e.preventDefault();
    const g = {};
    if (!dipilih) g.kode = 'Pilih batch yang dilaporkan.';
    if (ket.trim().length < 10) g.ket = 'Jelaskan kejadian minimal 10 karakter.';
    setGalat(g);
    if (!Object.keys(g).length) setTinjau(true);
  };

  return (
    <Halaman>
      <AppBar judul="Lapor insiden" eyebrow={profil.organisasi} kembali={beranda} />
      <div className="content">
        <Pesan jenis="info" ikon="info">Laporkan keluhan setelah makan, misalnya siswa mual atau makanan berbau. Laporan tercatat permanen di blockchain dan terlihat oleh pengawas.</Pesan>
        {loading && <Skeleton n={2} />}
        {error && <Pesan>{error.message}</Pesan>}
        {data && (pilihan.length ? (
          <form className="card form" onSubmit={periksa} noValidate>
            <div className="field">
              <label htmlFor="batch">Batch *</label>
              <select id="batch" value={kode} onChange={(e) => setKode(e.target.value)} aria-invalid={!!galat.kode || undefined}>
                <option value="">Pilih batch…</option>
                {pilihan.map((b) => <option key={b.id} value={b.kode}>{b.kode} · {b.menu.split(',')[0]} · {b.statusTeks}{puskesmas ? ` · ${b.sekolah}` : ''}</option>)}
              </select>
              {galat.kode && <Galat>{galat.kode}</Galat>}
            </div>
            <div className="field">
              <label htmlFor="ket">Keterangan kejadian *</label>
              <textarea id="ket" value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Contoh: 3 siswa kelas 2 mual 30 menit setelah makan" maxLength={240} aria-invalid={!!galat.ket || undefined} />
              {galat.ket ? <Galat>{galat.ket}</Galat> : <p className="help">{ket.length}/240 karakter</p>}
            </div>
            <button type="submit" className="btn primary block">Tinjau laporan</button>
          </form>
        ) : <Kosong ikon="flag" judul="Belum ada batch yang bisa dilaporkan">Insiden dapat dilaporkan setelah batch diterima sekolah.</Kosong>)}
      </div>
      <TabBar items={tabs} />

      {tinjau && (
        <Overlay jenis="dialog" label="Tinjau laporan">
          <h2>Tinjau laporan insiden</h2>
          <dl className="kv">
            <dt>Batch</dt><dd>{dipilih.kode} · {dipilih.sekolah}</dd>
            <dt>Keterangan</dt><dd>{ket.trim()}</dd>
            <dt>Waktu</dt><dd>{jam(sekarang())}</dd>
            <dt>Pelapor</dt><dd>{profil.nama}</dd>
          </dl>
          <p className="warn-line">Laporan tidak bisa dihapus setelah tercatat.</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setTinjau(false)}>Ubah</button>
            <button type="button" className="btn primary" onClick={() => { setTinjau(false); jalankan((onStatus) => klien.laporkanInsiden(dipilih.id, ket.trim(), { onStatus })); }}>Kirim laporan</button>
          </div>
        </Overlay>
      )}
    </Halaman>
  );
}
