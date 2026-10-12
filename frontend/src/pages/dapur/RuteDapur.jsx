import { Route, Routes } from 'react-router-dom';
import Profil from '../Profil.jsx';
import { TABS_DAPUR } from '../tabs.js';
import BerandaDapur from './Beranda.jsx';
import BatchBaru from './BatchBaru.jsx';
import DetailDapur from './Detail.jsx';

export default function RuteDapur() {
  return (
    <Routes>
      <Route index element={<BerandaDapur />} />
      <Route path="baru" element={<BatchBaru />} />
      <Route path="batch/:kode" element={<DetailDapur />} />
      <Route path="profil" element={<Profil tabs={TABS_DAPUR} />} />
    </Routes>
  );
}
