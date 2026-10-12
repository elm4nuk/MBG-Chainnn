import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SesiProvider, useSesi } from './lib/sesi.jsx';
import { berandaUntuk } from './lib/format.js';
import { AppBar, Halaman, Ikon, Skeleton } from './components/ui.jsx';
import Masuk from './pages/Masuk.jsx';
import RuteSekolah from './pages/sekolah/RuteSekolah.jsx';
import RuteDapur from './pages/dapur/RuteDapur.jsx';
import RuteKurir from './pages/kurir/RuteKurir.jsx';
import RutePuskesmas from './pages/puskesmas/RutePuskesmas.jsx';
import RuteAdmin from './pages/admin/RuteAdmin.jsx';
import Verifikasi from './pages/publik/Verifikasi.jsx';
import Pantau from './pages/publik/Pantau.jsx';

function Gangguan() {
  const { status, coba } = useSesi();
  const belum = status === 'belumDeploy';
  return (
    <Halaman>
      <AppBar judul="MBG-Chain" />
      <div className="status-wrap" role="alert">
        <div className="badge-big bad"><Ikon n={belum ? 'info' : 'x'} /></div>
        <h2>{belum ? 'Kontrak belum di-deploy' : 'Tidak terhubung ke jaringan'}</h2>
        <p>{belum
          ? 'Jalankan npm run chain, lalu npm run deploy dan npm run seed di folder mbg-chain, kemudian muat ulang halaman ini.'
          : 'Node blockchain di 127.0.0.1:8545 tidak menjawab atau kontrak tidak ditemukan. Pastikan npm run chain masih berjalan.'}</p>
      </div>
      <div className="actions"><button type="button" className="btn primary block" onClick={coba}><Ikon n="refresh" />Coba lagi</button></div>
    </Halaman>
  );
}

function Siap({ children }) {
  const { status } = useSesi();
  if (status === 'memuat') return <Halaman><AppBar judul="MBG-Chain" /><div className="content"><Skeleton n={3} teks="Menghubungkan ke jaringan MBG-Chain…" /></div></Halaman>;
  if (status !== 'siap') return <Gangguan />;
  return children;
}

/** Halaman khusus peran tertentu. Peran dibaca dari smart contract saat masuk. */
function Wajib({ jenis, admin, children }) {
  const { profil } = useSesi();
  if (!profil) return <Navigate to="/masuk" replace />;
  const cocok = admin ? profil.admin : !profil.admin && profil.jenis === jenis;
  if (!cocok) return <Navigate to={berandaUntuk(profil)} replace />;
  return children;
}

function Awal() {
  const { profil } = useSesi();
  return <Navigate to={profil ? berandaUntuk(profil) : '/masuk'} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <SesiProvider>
        <Siap>
          <Routes>
            <Route path="/masuk" element={<Masuk />} />
            <Route path="/verifikasi" element={<Verifikasi />} />
            <Route path="/verifikasi/:kode" element={<Verifikasi />} />
            <Route path="/pantau" element={<Pantau />} />
            <Route path="/sekolah/*" element={<Wajib jenis={3}><RuteSekolah /></Wajib>} />
            <Route path="/dapur/*" element={<Wajib jenis={1}><RuteDapur /></Wajib>} />
            <Route path="/kurir/*" element={<Wajib jenis={2}><RuteKurir /></Wajib>} />
            <Route path="/puskesmas/*" element={<Wajib jenis={4}><RutePuskesmas /></Wajib>} />
            <Route path="/admin/*" element={<Wajib admin><RuteAdmin /></Wajib>} />
            <Route path="*" element={<Awal />} />
          </Routes>
        </Siap>
      </SesiProvider>
    </HashRouter>
  );
}
