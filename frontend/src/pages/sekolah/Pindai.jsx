import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSesi } from '../../lib/sesi.jsx';
import { AppBar, Halaman, Ikon } from '../../components/ui.jsx';
import { PemindaiQR } from '../../components/Qr.jsx';

/** Pindai QR batch. Dipakai PIC sekolah; batch dari sekolah lain atau kode yang tidak ada ditolak di sini. */
export default function PindaiSekolah() {
  const { klien, profil } = useSesi();
  const nav = useNavigate();
  const [galat, setGalat] = useState(null);
  const [ulang, setUlang] = useState(0);

  const buka = async (kode) => {
    try {
      const b = await klien.batch(kode);
      if (b.sekolahId !== profil.organisasiId) setGalat(`Batch ${b.kode} ditujukan ke ${b.sekolah}, bukan sekolah ini.`);
      else nav(`/sekolah/batch/${b.kode}`);
    } catch (e) {
      setGalat(e.jenis === 'jaringan' ? e.message : `Batch ${kode} tidak ditemukan di blockchain.`);
    }
  };

  return (
    <Halaman>
      <AppBar judul="Pindai QR batch" kembali="/sekolah" kamera />
      {galat ? (
        <div className="content">
          <div className="card" role="alert">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--bad)', fontWeight: 800, fontSize: 16 }}><Ikon n="x" style={{ width: 20, height: 20 }} />QR tidak dikenali</div>
            <p style={{ margin: 0, fontSize: 14 }}>{galat} Pastikan QR berasal dari batch untuk sekolah ini, lalu pindai ulang.</p>
            <div className="row">
              <Link to="/sekolah" className="btn secondary">Pilih dari daftar</Link>
              <button type="button" className="btn primary" onClick={() => { setGalat(null); setUlang((x) => x + 1); }}>Pindai ulang</button>
            </div>
          </div>
        </div>
      ) : (
        <PemindaiQR key={ulang} onKode={buka} aksiBawah={<Link to="/sekolah" className="btn secondary block">Pilih dari daftar</Link>} />
      )}
    </Halaman>
  );
}
