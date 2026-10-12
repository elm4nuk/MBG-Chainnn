// Pantau batch untuk pengawas BGN / Dinkes (UC-09, UC-11): hanya membaca blockchain, tanpa login.
import { useSesi } from '../../lib/sesi.jsx';
import { berandaUntuk } from '../../lib/format.js';
import { AppBar, Halaman } from '../../components/ui.jsx';
import DasborBatch from '../../components/DasborBatch.jsx';

export default function Pantau() {
  const { profil } = useSesi();
  return (
    <Halaman lebar>
      <AppBar judul="Pantau batch" eyebrow="Pengawas BGN / Dinkes" kembali={profil ? berandaUntuk(profil) : '/masuk'} />
      <div className="content dashboard-content"><DasborBatch /></div>
    </Halaman>
  );
}
