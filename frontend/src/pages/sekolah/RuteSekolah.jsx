import { Route, Routes } from 'react-router-dom';
import Profil from '../Profil.jsx';
import { TABS_SEKOLAH } from '../tabs.js';
import BerandaSekolah from './Beranda.jsx';
import PindaiSekolah from './Pindai.jsx';
import DetailSekolah from './Detail.jsx';
import RiwayatSekolah from './Riwayat.jsx';
import LaporSekolah from './Lapor.jsx';


export default function RuteSekolah() {
  return (
    <Routes>
      <Route index element={<BerandaSekolah />} />
      <Route path="pindai" element={<PindaiSekolah />} />
      <Route path="batch/:kode" element={<DetailSekolah />} />
      <Route path="riwayat" element={<RiwayatSekolah />} />
      <Route path="lapor" element={<LaporSekolah />} />
      <Route path="profil" element={<Profil tabs={TABS_SEKOLAH} />} />
    </Routes>
  );
}
