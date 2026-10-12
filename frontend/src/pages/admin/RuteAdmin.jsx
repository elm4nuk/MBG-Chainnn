// Admin BGN: mengelola peserta jaringan berizin (organisasi dan petugas).
import { useDeferredValue, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Profil from '../Profil.jsx';
import { TABS_ADMIN } from '../tabs.js';
import { useMuat, useSesi, useTx } from '../../lib/sesi.jsx';
import { jam } from '../../lib/format.js';
import { AppBar, Chip, Galat, Halaman, Ikon, Overlay, Pesan, Skeleton, TabBar } from '../../components/ui.jsx';
import DasborBatch from '../../components/DasborBatch.jsx';
import TxLayar from '../../components/TxLayar.jsx';

const JENIS = [
  { kode: 1, teks: 'SPPG (dapur)' },
  { kode: 2, teks: 'Mitra distribusi (kurir)' },
  { kode: 3, teks: 'Sekolah' },
  { kode: 4, teks: 'Puskesmas' },
];
const NADA_JENIS = { 1: 'warn', 2: 'pend', 3: 'ok', 4: 'bad' };

function KepalaBagian({ id, judul, deskripsi, jumlah }) {
  return (
    <div className="panel-head">
      <div><h2 id={id}>{judul}</h2><p>{deskripsi}</p></div>
      {jumlah !== undefined && <span className="record-count">{jumlah} data</span>}
    </div>
  );
}

function Pencarian({ value, onChange, placeholder, label }) {
  return (
    <label className="search-field">
      <span className="sr-only">{label}</span>
      <Ikon n="search" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function LayarTx({ tx, teks, tutup, ulangi, reload }) {
  return (
    <Halaman lebar>
      <TxLayar tx={tx} teks={teks} labelSelesai="Kembali ke daftar"
        onSelesai={() => { tutup(); reload(); }} onKembali={() => { tutup(); reload(); }} onUlang={ulangi} />
    </Halaman>
  );
}

function Organisasi() {
  const { klien, sekarang } = useSesi();
  const { data, loading, error, reload } = useMuat(() => klien.daftarOrganisasi(), []);
  const { tx, jalankan, ulangi, tutup } = useTx();
  const [jenis, setJenis] = useState('');
  const [nama, setNama] = useState('');
  const [galat, setGalat] = useState({});
  const [tinjau, setTinjau] = useState(false);
  const [cari, setCari] = useState('');
  const [saringJenis, setSaringJenis] = useState('semua');
  const cariTunda = useDeferredValue(cari.trim().toLocaleLowerCase('id-ID'));

  if (tx) {
    return <LayarTx tx={tx} tutup={() => { tutup(); setNama(''); setJenis(''); }} ulangi={ulangi} reload={reload}
      teks={{ menunggu: 'Mendaftarkan organisasi…', tercatat: 'Organisasi terdaftar', ditolak: 'Pendaftaran ditolak sistem',
        pesan: (x) => `${nama.trim()} terdaftar sebagai ${JENIS.find((j) => String(j.kode) === jenis)?.teks} dengan ID ${x.event.OrganisasiDidaftarkan?.id}.` }} />;
  }
  const periksa = (e) => {
    e.preventDefault();
    const g = {};
    if (!jenis) g.jenis = 'Pilih jenis organisasi.';
    if (nama.trim().length < 3) g.nama = 'Isi nama organisasi.';
    setGalat(g);
    if (!Object.keys(g).length) setTinjau(true);
  };
  const organisasi = data || [];
  const tampil = organisasi.filter((o) => {
    const cocokJenis = saringJenis === 'semua' || String(o.jenis) === saringJenis;
    const teks = `${o.id} ${o.nama} ${o.jenisTeks}`.toLocaleLowerCase('id-ID');
    return cocokJenis && (!cariTunda || teks.includes(cariTunda));
  });
  const resetSaring = () => { setCari(''); setSaringJenis('semua'); };
  return (
    <Halaman lebar>
      <AppBar judul="Organisasi" eyebrow="Admin BGN · peserta jaringan" />
      <div className="content dashboard-content">
        <section className="dashboard-intro" aria-labelledby="judul-organisasi">
          <div><span className="section-kicker">Administrasi jaringan</span><h2 id="judul-organisasi">Kelola organisasi MBG</h2></div>
          <p>Daftarkan lembaga yang boleh terlibat dalam alur batch. Seluruh angka di bawah dibaca dari kontrak.</p>
        </section>
        {data && (
          <div className="stats admin-stats" role="list" aria-label="Ringkasan organisasi">
            <div className="stat" role="listitem"><span>Total organisasi</span><b>{organisasi.length}</b><small>Peserta terdaftar</small></div>
            <div className="stat warn" role="listitem"><span>Dapur SPPG</span><b>{organisasi.filter((o) => o.jenis === 1).length}</b><small>Sumber batch</small></div>
            <div className="stat pend" role="listitem"><span>Mitra distribusi</span><b>{organisasi.filter((o) => o.jenis === 2).length}</b><small>Pengantar batch</small></div>
            <div className="stat ok" role="listitem"><span>Sekolah</span><b>{organisasi.filter((o) => o.jenis === 3).length}</b><small>Penerima batch</small></div>
          </div>
        )}
        <Pesan jenis="info" ikon="shield">Hanya organisasi dan petugas yang didaftarkan di sini yang dapat mencatat transaksi. Peran petugas mengikuti jenis organisasinya.</Pesan>
        {loading && !data && <Skeleton n={2} />}
        {error && <Pesan>{error.message} <button type="button" className="inline-action" onClick={() => reload()}>Coba lagi</button></Pesan>}
        <div className="admin-grid">
          {data && (
            <section className="panel data-panel" aria-labelledby="daftar-organisasi">
              <KepalaBagian id="daftar-organisasi" judul="Daftar organisasi" deskripsi="Identitas peserta yang tersimpan di blockchain." jumlah={tampil.length} />
              <div className="table-toolbar">
                <Pencarian label="Cari organisasi" value={cari} onChange={setCari} placeholder="Cari nama, jenis, atau ID…" />
                <label className="compact-field"><span>Jenis</span><select value={saringJenis} onChange={(e) => setSaringJenis(e.target.value)}><option value="semua">Semua jenis</option>{JENIS.map((j) => <option key={j.kode} value={j.kode}>{j.teks}</option>)}</select></label>
                {(cari || saringJenis !== 'semua') && <button type="button" className="btn ghost sm" onClick={resetSaring}>Reset</button>}
              </div>
              {tampil.length ? (
                <div className="tabel-wrap">
                  <table className="tabel responsive">
                    <caption className="sr-only">Daftar organisasi MBG yang terdaftar</caption>
                    <thead><tr><th>ID</th><th>Nama</th><th>Jenis</th></tr></thead>
                    <tbody>{tampil.map((o) => <tr key={o.id}><td data-label="ID" className="mono"><span className="mobile-cell-label">ID</span>ORG-{String(o.id).padStart(3, '0')}</td><td data-label="Nama"><span className="mobile-cell-label">Nama</span><b>{o.nama}</b></td><td data-label="Jenis"><span className="mobile-cell-label">Jenis</span><Chip nada={NADA_JENIS[o.jenis]}>{o.jenisTeks}</Chip></td></tr>)}</tbody>
                  </table>
                </div>
              ) : <div className="filtered-empty"><Ikon n="search" /><b>Tidak ada hasil</b><span>Ubah kata pencarian atau filter jenis.</span><button type="button" className="btn secondary sm" onClick={resetSaring}>Hapus filter</button></div>}
            </section>
          )}
          <form className="card form admin-form" onSubmit={periksa} noValidate>
            <KepalaBagian judul="Tambah organisasi" deskripsi="Transaksi akan ditinjau sebelum dikirim." />
            <div className="field">
              <label htmlFor="jenis">Jenis *</label>
              <select id="jenis" value={jenis} onChange={(e) => setJenis(e.target.value)} aria-invalid={!!galat.jenis || undefined}>
                <option value="">Pilih jenis…</option>
                {JENIS.map((j) => <option key={j.kode} value={j.kode}>{j.teks}</option>)}
              </select>
              {galat.jenis && <Galat>{galat.jenis}</Galat>}
            </div>
            <div className="field">
              <label htmlFor="nama-org">Nama *</label>
              <input id="nama-org" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="SDN Pulo Gebang 06" maxLength={80} aria-invalid={!!galat.nama || undefined} />
              {galat.nama && <Galat>{galat.nama}</Galat>}
            </div>
            <button type="submit" className="btn primary"><Ikon n="plus" />Tinjau organisasi</button>
          </form>
        </div>
      </div>
      <TabBar items={TABS_ADMIN} />
      {tinjau && (
        <Overlay jenis="dialog" label="Tinjau organisasi">
          <h2>Daftarkan organisasi?</h2>
          <dl className="kv"><dt>Nama</dt><dd>{nama.trim()}</dd><dt>Jenis</dt><dd>{JENIS.find((j) => String(j.kode) === jenis)?.teks}</dd><dt>Waktu</dt><dd>{jam(sekarang())}</dd></dl>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setTinjau(false)}>Ubah</button>
            <button type="button" className="btn primary" onClick={() => { setTinjau(false); jalankan((onStatus) => klien.daftarkanOrganisasi(Number(jenis), nama.trim(), { onStatus })); }}>Daftarkan</button>
          </div>
        </Overlay>
      )}
    </Halaman>
  );
}

function Petugas() {
  const { klien, kontrak } = useSesi();
  const { data, loading, error, reload } = useMuat(async () => {
    const [petugas, organisasi, akun] = await Promise.all([klien.daftarPetugas(), klien.daftarOrganisasi(), klien.akunNode().catch(() => [])]);
    return { petugas, organisasi, akun };
  }, []);
  const { tx, jalankan, ulangi, tutup } = useTx();
  const [akun, setAkun] = useState('');
  const [org, setOrg] = useState('');
  const [nama, setNama] = useState('');
  const [galat, setGalat] = useState({});
  const [tanya, setTanya] = useState(null); // { jenis: 'daftar' } | { jenis: 'nonaktif', p }
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('semua');
  const cariTunda = useDeferredValue(cari.trim().toLocaleLowerCase('id-ID'));

  if (tx) {
    const nonaktif = tanya?.jenis === 'nonaktif';
    return <LayarTx tx={tx} tutup={() => { tutup(); setTanya(null); setAkun(''); setNama(''); }} ulangi={ulangi} reload={reload}
      teks={nonaktif
        ? { menunggu: 'Menonaktifkan petugas…', tercatat: 'Petugas dinonaktifkan', ditolak: 'Ditolak sistem', pesan: `${tanya.p.nama} tidak dapat lagi mencatat transaksi.` }
        : { menunggu: 'Mendaftarkan petugas…', tercatat: 'Petugas terdaftar', ditolak: 'Pendaftaran ditolak sistem', pesan: `${nama.trim()} sekarang dapat masuk dan mencatat sesuai peran organisasinya.` }} />;
  }

  const terdaftar = new Set((data?.petugas || []).map((p) => p.akun.toLowerCase()));
  const admin = kontrak && data ? null : null;
  void admin;
  const akunBebas = (data?.akun || []).filter((a, i) => i > 0 && !terdaftar.has(a.toLowerCase()));
  const periksa = (e) => {
    e.preventDefault();
    const g = {};
    const alamat = akun.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(alamat)) g.akun = 'Pilih atau isi alamat akun yang valid (0x…).';
    else if (/^0x0{40}$/.test(alamat)) g.akun = 'Alamat nol tidak dapat digunakan sebagai akun petugas.';
    else if (terdaftar.has(alamat)) g.akun = 'Akun ini sudah terdaftar. Pilih akun Ganache lain.';
    if (!org) g.org = 'Pilih organisasi.';
    if (nama.trim().length < 2) g.nama = 'Isi nama petugas.';
    setGalat(g);
    if (!Object.keys(g).length) setTanya({ jenis: 'daftar' });
  };
  const namaOrg = (id) => data?.organisasi.find((o) => o.id === id)?.nama;
  const petugas = data?.petugas || [];
  const tampil = petugas.filter((p) => {
    const cocokStatus = status === 'semua' || (status === 'aktif' ? p.aktif : !p.aktif);
    const teks = `${p.nama} ${p.organisasi} ${p.peran} ${p.akun}`.toLocaleLowerCase('id-ID');
    return cocokStatus && (!cariTunda || teks.includes(cariTunda));
  });
  const resetSaring = () => { setCari(''); setStatus('semua'); };

  return (
    <Halaman lebar>
      <AppBar judul="Petugas" eyebrow="Admin BGN · peserta jaringan" />
      <div className="content dashboard-content">
        <section className="dashboard-intro" aria-labelledby="judul-petugas">
          <div><span className="section-kicker">Kontrol akses</span><h2 id="judul-petugas">Kelola petugas jaringan</h2></div>
          <p>Hubungkan akun Ganache ke organisasi dan tinjau status akses pencatatan.</p>
        </section>
        {data && (
          <div className="stats admin-stats three" role="list" aria-label="Ringkasan petugas">
            <div className="stat" role="listitem"><span>Total petugas</span><b>{petugas.length}</b><small>Seluruh akun</small></div>
            <div className="stat ok" role="listitem"><span>Aktif</span><b>{petugas.filter((p) => p.aktif).length}</b><small>Dapat mencatat</small></div>
            <div className="stat bad" role="listitem"><span>Nonaktif</span><b>{petugas.filter((p) => !p.aktif).length}</b><small>Akses dihentikan</small></div>
          </div>
        )}
        {loading && !data && <Skeleton n={2} />}
        {error && <Pesan>{error.message} <button type="button" className="inline-action" onClick={() => reload()}>Coba lagi</button></Pesan>}
        {data && <div className="admin-grid">
          <section className="panel data-panel" aria-labelledby="daftar-petugas">
            <KepalaBagian id="daftar-petugas" judul="Daftar petugas" deskripsi="Akses akun dan organisasi yang menaunginya." jumlah={tampil.length} />
            <div className="table-toolbar">
              <Pencarian label="Cari petugas" value={cari} onChange={setCari} placeholder="Cari nama, organisasi, atau akun…" />
              <label className="compact-field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="semua">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></label>
              {(cari || status !== 'semua') && <button type="button" className="btn ghost sm" onClick={resetSaring}>Reset</button>}
            </div>
            {tampil.length ? <div className="tabel-wrap"><table className="tabel responsive">
              <caption className="sr-only">Daftar petugas MBG yang terdaftar</caption>
              <thead><tr><th>Nama</th><th>Organisasi</th><th>Akun</th><th>Status</th><th><span className="sr-only">Tindakan</span></th></tr></thead>
              <tbody>
                {tampil.map((p) => (
                  <tr key={p.akun}>
                    <td data-label="Nama"><span className="mobile-cell-label">Nama</span><b>{p.nama}</b></td><td data-label="Organisasi"><span className="mobile-cell-label">Organisasi</span>{p.organisasi}<br /><span className="muted cell-sub">{p.peran}</span></td>
                    <td data-label="Akun" className="mono" title={p.akun}><span className="mobile-cell-label">Akun</span>{p.akun.slice(0, 8)}…{p.akun.slice(-4)}</td>
                    <td data-label="Status"><span className="mobile-cell-label">Status</span>{p.aktif ? <Chip nada="ok" ikon="check">Aktif</Chip> : <Chip nada="netral">Nonaktif</Chip>}</td>
                    <td data-label="Tindakan" className="table-action"><span className="mobile-cell-label">Tindakan</span>{p.aktif ? <button type="button" className="mini danger-text" onClick={() => setTanya({ jenis: 'nonaktif', p })}>Nonaktifkan</button> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div> : <div className="filtered-empty"><Ikon n="search" /><b>Tidak ada hasil</b><span>Ubah kata pencarian atau filter status.</span><button type="button" className="btn secondary sm" onClick={resetSaring}>Hapus filter</button></div>}
          </section>
          <form className="card form admin-form" onSubmit={periksa} noValidate>
            <KepalaBagian judul="Tambah petugas" deskripsi="Gunakan akun Ganache yang belum terdaftar." />
            <div className="field">
              <label htmlFor="akun">Akun *</label>
              <select id="akun" value={akunBebas.includes(akun) ? akun : ''} onChange={(e) => setAkun(e.target.value)}>
                <option value="">Pilih akun dari node…</option>
                {akunBebas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <input aria-label="Atau isi alamat akun" placeholder="atau isi alamat 0x…" value={akun} onChange={(e) => setAkun(e.target.value)} className="mono" aria-invalid={!!galat.akun || undefined} />
              {galat.akun ? <Galat>{galat.akun}</Galat> : <p className="help">Prototype: akun dikelola node Ganache, jadi petugas tidak memerlukan dompet.</p>}
            </div>
            <div className="field">
              <label htmlFor="org">Organisasi *</label>
              <select id="org" value={org} onChange={(e) => setOrg(e.target.value)} aria-invalid={!!galat.org || undefined}>
                <option value="">Pilih organisasi…</option>
                {data.organisasi.map((o) => <option key={o.id} value={o.id}>{o.nama} · {o.jenisTeks}</option>)}
              </select>
              {galat.org && <Galat>{galat.org}</Galat>}
            </div>
            <div className="field">
              <label htmlFor="nama-p">Nama petugas *</label>
              <input id="nama-p" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" maxLength={60} aria-invalid={!!galat.nama || undefined} />
              {galat.nama && <Galat>{galat.nama}</Galat>}
            </div>
            <button type="submit" className="btn primary"><Ikon n="plus" />Tinjau petugas</button>
          </form>
        </div>}
      </div>
      <TabBar items={TABS_ADMIN} />

      {tanya?.jenis === 'daftar' && (
        <Overlay jenis="dialog" label="Tinjau petugas">
          <h2>Daftarkan petugas?</h2>
          <dl className="kv"><dt>Nama</dt><dd>{nama.trim()}</dd><dt>Organisasi</dt><dd>{namaOrg(Number(org))}</dd><dt>Akun</dt><dd className="mono">{akun.trim()}</dd></dl>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setTanya(null)}>Ubah</button>
            <button type="button" className="btn primary" onClick={() => jalankan((onStatus) => klien.daftarkanPetugas(akun.trim(), Number(org), nama.trim(), { onStatus }))}>Daftarkan</button>
          </div>
        </Overlay>
      )}
      {tanya?.jenis === 'nonaktif' && (
        <Overlay jenis="dialog" label="Nonaktifkan petugas">
          <h2>Nonaktifkan {tanya.p.nama}?</h2>
          <p className="warn-line" style={{ fontSize: 14 }}>Petugas tidak dapat lagi mencatat transaksi. Riwayat yang sudah tercatat tetap ada.</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setTanya(null)}>Batal</button>
            <button type="button" className="btn primary" style={{ background: 'var(--bad)' }} onClick={() => jalankan((onStatus) => klien.nonaktifkanPetugas(tanya.p.akun, { onStatus }))}>Nonaktifkan</button>
          </div>
        </Overlay>
      )}
    </Halaman>
  );
}

function PantauAdmin() {
  return (
    <Halaman lebar>
      <AppBar judul="Pantau batch" eyebrow="Admin BGN · pengawasan" />
      <div className="content dashboard-content"><DasborBatch /></div>
      <TabBar items={TABS_ADMIN} />
    </Halaman>
  );
}

export default function RuteAdmin() {
  return (
    <Routes>
      <Route index element={<Organisasi />} />
      <Route path="petugas" element={<Petugas />} />
      <Route path="pantau" element={<PantauAdmin />} />
      <Route path="profil" element={<Profil tabs={TABS_ADMIN} lebar />} />
    </Routes>
  );
}
