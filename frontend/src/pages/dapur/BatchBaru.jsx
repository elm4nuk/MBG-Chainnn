// Daftarkan batch baru (UC-01): satu batch untuk satu sekolah tujuan.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMuat, useSesi, useTx } from '../../lib/sesi.jsx';
import { AppBar, Galat, Halaman, Overlay, Pesan, Skeleton, Stepper, TabBar } from '../../components/ui.jsx';
import TxLayar from '../../components/TxLayar.jsx';
import { TABS_DAPUR } from '../tabs.js';

export default function BatchBaru() {
  const { klien, profil } = useSesi();
  const nav = useNavigate();
  const { data: org, loading, error } = useMuat(() => klien.daftarOrganisasi(), []);
  const { tx, jalankan, ulangi, tutup } = useTx();
  const [sekolah, setSekolah] = useState('');
  const [menu, setMenu] = useState('');
  const [porsi, setPorsi] = useState('120');
  const [galat, setGalat] = useState({});
  const [tinjau, setTinjau] = useState(false);
  const daftarSekolah = (org || []).filter((o) => o.jenis === 3);
  const tujuan = daftarSekolah.find((o) => String(o.id) === sekolah);

  if (tx) {
    const kode = tx.bukti?.event?.BatchDidaftarkan ? `B-${String(tx.bukti.event.BatchDidaftarkan.id).padStart(4, '0')}` : '';
    return (
      <Halaman>
        <TxLayar tx={tx}
          teks={{ menunggu: 'Mendaftarkan batch…', tercatat: `Batch ${kode} terdaftar`, ditolak: 'Pendaftaran ditolak sistem',
            pesan: `${porsi} porsi untuk ${tujuan?.nama}. Cetak label QR dan tempel pada wadah sebelum diserahkan ke kurir.` }}
          labelSelesai="Lihat label QR" onSelesai={() => nav(`/dapur/batch/${kode}`, { replace: true })}
          onKembali={tutup} onUlang={ulangi} />
      </Halaman>
    );
  }

  const periksa = (e) => {
    e.preventDefault();
    const g = {};
    if (!tujuan) g.sekolah = 'Pilih sekolah tujuan.';
    if (menu.trim().length < 3) g.menu = 'Isi menu batch.';
    const n = parseInt(porsi, 10) || 0;
    if (n < 1) g.porsi = 'Jumlah porsi minimal 1.';
    if (n > 5000) g.porsi = 'Jumlah porsi terlalu besar untuk satu batch.';
    setGalat(g);
    if (!Object.keys(g).length) setTinjau(true);
  };

  return (
    <Halaman>
      <AppBar judul="Batch baru" eyebrow={profil.organisasi} kembali="/dapur" />
      <div className="content sempit">
        {loading && <Skeleton n={1} teks="Memuat daftar sekolah…" />}
        {error && <Pesan>{error.message}</Pesan>}
        {org && (
          <form className="card form" onSubmit={periksa} noValidate>
            <div className="field">
              <label htmlFor="sekolah">Sekolah tujuan *</label>
              <select id="sekolah" value={sekolah} onChange={(e) => setSekolah(e.target.value)} aria-invalid={!!galat.sekolah || undefined}>
                <option value="">Pilih sekolah…</option>
                {daftarSekolah.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
              </select>
              {galat.sekolah && <Galat>{galat.sekolah}</Galat>}
            </div>
            <div className="field">
              <label htmlFor="menu">Menu *</label>
              <input id="menu" value={menu} onChange={(e) => setMenu(e.target.value)} placeholder="Nasi, ayam teriyaki, tumis buncis, pisang" maxLength={120} aria-invalid={!!galat.menu || undefined} />
              {galat.menu && <Galat>{galat.menu}</Galat>}
            </div>
            <div className="field">
              <label htmlFor="porsi">Jumlah porsi *</label>
              <Stepper id="porsi" label="satu porsi" value={porsi} onChange={(v) => setPorsi(String(v))} invalid={!!galat.porsi} />
              {galat.porsi ? <Galat>{galat.porsi}</Galat> : <p className="help">Sesuai jumlah siswa penerima di sekolah tujuan.</p>}
            </div>
            <button type="submit" className="btn primary block">Tinjau batch</button>
          </form>
        )}
        <Pesan jenis="info" ikon="clock">Batas 4 jam belum berjalan saat batch didaftarkan. Hitungan dimulai ketika Anda mencatat selesai masak.</Pesan>
      </div>
      <TabBar items={TABS_DAPUR} />

      {tinjau && (
        <Overlay jenis="dialog" label="Tinjau batch">
          <h2>Tinjau batch baru</h2>
          <dl className="kv">
            <dt>Sekolah tujuan</dt><dd>{tujuan.nama}</dd>
            <dt>Menu</dt><dd>{menu.trim()}</dd>
            <dt>Porsi</dt><dd>{parseInt(porsi, 10)} porsi</dd>
            <dt>Dapur</dt><dd>{profil.organisasi}</dd>
          </dl>
          <p className="warn-line">Data batch tercatat permanen di blockchain.</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setTinjau(false)}>Ubah</button>
            <button type="button" className="btn primary" onClick={() => { setTinjau(false); jalankan((onStatus) => klien.daftarkanBatch(tujuan.id, menu.trim(), parseInt(porsi, 10), { onStatus })); }}>Daftarkan</button>
          </div>
        </Overlay>
      )}
    </Halaman>
  );
}
