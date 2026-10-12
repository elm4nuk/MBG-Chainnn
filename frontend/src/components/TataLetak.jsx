// Kerangka responsif bersama semua peran: sidebar permanen di desktop (≥1024 px), rail ringkas di tablet
// (768–1023 px), dan bottom navigation di HP (<768 px, TabBar di tiap halaman). Data dan halaman tetap sama;
// hanya komposisi yang berubah sesuai lebar layar.
import { Link, useLocation } from 'react-router-dom';
import { useSesi } from '../lib/sesi.jsx';
import { Ikon } from './ui.jsx';

function aktif(items, i, path) {
  const t = items[i];
  if (path === t.ke) return true;
  if (i !== 0) return path.startsWith(`${t.ke}/`);
  // menu pertama (beranda) tetap aktif di halaman turunan seperti detail batch, kecuali milik menu lain
  return path.startsWith(`${t.ke}/`) && !items.some((u, j) => j > 0 && (path === u.ke || path.startsWith(`${u.ke}/`)));
}

export default function TataLetak({ items, peran, children }) {
  const { profil, kontrak } = useSesi();
  const { pathname } = useLocation();
  const awal = items[0]?.ke || '/masuk';
  const halamanProfil = items.find((t) => t.ke.endsWith('/profil'))?.ke;
  return (
    <div className="tata">
      <aside className="sidebar">
        <Link to={awal} className="side-brand" aria-label="MBG-Chain, ke beranda">
          <span className="side-mark" aria-hidden="true"><Ikon n="bowl" /></span>
          <span className="side-teks"><b>MBG-Chain</b><small>{peran}</small></span>
        </Link>
        <nav className="side-nav" aria-label="Menu utama">
          {items.map((t, i) => {
            const sedang = aktif(items, i, pathname);
            return (
              <Link key={t.ke} to={t.ke} className="side-link" aria-current={sedang ? 'page' : undefined}>
                <Ikon n={t.ikon} /><span>{t.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="side-kaki">
          {profil && (
            halamanProfil
              ? <Link to={halamanProfil} className="side-akun" aria-label={`Akun ${profil.nama}, ${profil.organisasi || 'Badan Gizi Nasional'}`}>
                  <span className="side-avatar" aria-hidden="true">{profil.nama.slice(0, 1)}</span>
                  <span className="side-teks"><b>{profil.nama}</b><small>{profil.organisasi || 'Badan Gizi Nasional'}</small></span>
                </Link>
              : null
          )}
          {kontrak && (
            <p className="side-net" title={`Kontrak ${kontrak.address}`}>
              <span className="dot-hidup" aria-hidden="true" /><span className="side-teks">Terhubung · {kontrak.jaringan} · chainId {kontrak.chainId}</span>
            </p>
          )}
        </div>
      </aside>
      <div className="tata-main">{children}</div>
    </div>
  );
}
