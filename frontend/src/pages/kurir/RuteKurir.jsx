import { Route, Routes, useNavigate } from 'react-router-dom';
import Profil from '../Profil.jsx';
import { TABS_KURIR } from '../tabs.js';
import BerandaKurir from './Beranda.jsx';
import DetailKurir from './Detail.jsx';
import { AppBar, Halaman, TabBar } from '../../components/ui.jsx';
import { PemindaiQR } from '../../components/Qr.jsx';

function PindaiKurir() {
  const nav = useNavigate();
  return (
    <Halaman>
      <AppBar judul="Pindai QR untuk mengambil" kembali="/kurir" kamera />
      <PemindaiQR onKode={(kode) => nav(`/kurir/batch/${kode}`)} petunjuk="Arahkan kamera ke label QR pada wadah di dapur." />
      <TabBar items={TABS_KURIR} />
    </Halaman>
  );
}

export default function RuteKurir() {
  return (
    <Routes>
      <Route index element={<BerandaKurir />} />
      <Route path="pindai" element={<PindaiKurir />} />
      <Route path="batch/:kode" element={<DetailKurir />} />
      <Route path="profil" element={<Profil tabs={TABS_KURIR} />} />
    </Routes>
  );
}
