import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSesi } from '../lib/sesi.jsx';
import { berandaUntuk } from '../lib/format.js';
import { Galat, Halaman, Ikon, InfoJaringan } from '../components/ui.jsx';

const SANDI_DEMO = 'mbgchain';

export default function Masuk() {
  const { profil, masuk, akunDemo } = useSesi();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState(null);
  const [proses, setProses] = useState(false);

  if (profil) return <Navigate to={berandaUntuk(profil)} replace />;

  const semua = akunDemo ? [akunDemo.admin, ...akunDemo.petugas] : [];
  const cariAkun = (masukan) => {
    const t = masukan.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(t)) return t;
    return semua.find((a) => a.id.toLowerCase() === t.toLowerCase())?.akun || null;
  };

  const kirim = async (e) => {
    e.preventDefault();
    setGalat(null);
    if (!id.trim()) { setGalat({ field: 'id', teks: 'Isi ID petugas.' }); return; }
    const akun = cariAkun(id);
    if (!akun) { setGalat({ field: 'id', teks: 'ID petugas tidak dikenal. Periksa kembali atau hubungi admin.' }); return; }
    if (sandi !== SANDI_DEMO) { setGalat({ field: 'sandi', teks: 'Kata sandi salah.' }); return; }
    setProses(true);
    try {
      const p = await masuk(akun);
      nav(berandaUntuk(p), { replace: true });
    } catch (err) {
      setGalat({ field: 'id', teks: err.jenis === 'jaringan' ? err.message : 'Akun ini belum terdaftar atau sudah dinonaktifkan admin BGN.' });
      setProses(false);
    }
  };

  return (
    <Halaman lebar>
      <main className="login">
        <section className="login-hero" aria-labelledby="login-headline">
          <div className="brand">
            <div className="mark"><Ikon n="bowl" /></div>
            <div><b>MBG-Chain</b><span>Jaringan distribusi pangan sekolah</span></div>
          </div>
          <div className="login-copy">
            <span className="section-kicker">Pencatatan yang dapat diverifikasi</span>
            <h1 id="login-headline">Lacak perjalanan makanan, dari dapur sampai disajikan.</h1>
            <p>Setiap serah terima tercatat dan batas konsumsi empat jam dipantau melalui blockchain.</p>
          </div>
          <ol className="login-journey" aria-label="Alur distribusi MBG">
            <li><span><Ikon n="bowl" /></span><b>SPPG</b><small>Memasak</small></li>
            <li><span><Ikon n="truck" /></span><b>Kurir</b><small>Mengantar</small></li>
            <li><span><Ikon n="building" /></span><b>Sekolah</b><small>Menerima</small></li>
            <li><span><Ikon n="check" /></span><b>Disajikan</b><small>Terverifikasi</small></li>
          </ol>
          <div className="login-trust"><Ikon n="shield" /><span><b>Data bersumber dari smart contract</b><small>Status, waktu, dan bukti transaksi dapat diperiksa kembali.</small></span></div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel-head">
            <span className="section-kicker">Portal petugas</span>
            <h2 id="login-title">Masuk ke MBG-Chain</h2>
            <p>Gunakan akun yang telah didaftarkan Admin BGN.</p>
          </div>
          <form className="form" onSubmit={kirim} noValidate>
            <div className="field">
              <label htmlFor="pid">ID petugas</label>
              <input id="pid" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)}
                className={galat?.field === 'id' ? 'invalid' : undefined} aria-invalid={galat?.field === 'id' || undefined} aria-describedby="g-id" />
              {galat?.field === 'id' && <div id="g-id"><Galat>{galat.teks}</Galat></div>}
            </div>
            <div className="field">
              <label htmlFor="pw">Kata sandi</label>
              <input id="pw" type="password" autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)}
                className={galat?.field === 'sandi' ? 'invalid' : undefined} aria-invalid={galat?.field === 'sandi' || undefined} aria-describedby="g-pw" />
              {galat?.field === 'sandi' && <div id="g-pw"><Galat>{galat.teks}</Galat></div>}
            </div>
            <button type="submit" className="btn primary block" disabled={proses}>{proses ? 'Memeriksa akun…' : 'Masuk'}</button>
          </form>

          {semua.length > 0 && (
            <details className="demo">
              <summary>Akun demo (kata sandi: {SANDI_DEMO})</summary>
              <ul>
                {semua.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => { setId(a.id); setSandi(SANDI_DEMO); setGalat(null); }}>
                      <span>{a.nama} · {a.organisasi || 'Badan Gizi Nasional'}</span><b>{a.id}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="links">
            <Link to="/verifikasi" className="btn secondary block"><Ikon n="qr" />Verifikasi batch tanpa login</Link>
            <Link to="/pantau" className="btn ghost block"><Ikon n="chart" />Pantau batch (pengawas BGN / Dinkes)</Link>
          </div>
          <p className="login-help">Akun dibuat oleh admin BGN. Lupa kata sandi? Hubungi admin.</p>
        </section>
      </main>
      <InfoJaringan />
    </Halaman>
  );
}
