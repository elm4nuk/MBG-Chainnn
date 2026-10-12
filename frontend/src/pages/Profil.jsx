import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesi } from '../lib/sesi.jsx';
import { jam } from '../lib/format.js';
import { AppBar, Halaman, Ikon, InfoJaringan, TabBar, useToast } from '../components/ui.jsx';

/** Alat demo presentasi: memajukan jam blockchain lokal agar batas 4 jam bisa diperlihatkan tanpa menunggu. */
function SimulasiWaktu() {
  const { klien, kontrak, sinkron } = useSesi();
  const [proses, setProses] = useState(false);
  const [toast, tampil] = useToast();
  if (!kontrak || (kontrak.chainId !== 1337 && kontrak.chainId !== 31337)) return null;
  const maju = async (menit) => {
    setProses(true);
    try {
      const t = await klien.majukanWaktuLokal(menit);
      await sinkron();
      tampil(`Jam blockchain sekarang ${jam(t)}.`);
    } catch (e) {
      tampil(e.message);
    } finally {
      setProses(false);
    }
  };
  return (
    <section className="card">
      <h3>Alat demo · jaringan lokal</h3>
      <p className="help">Memajukan jam blockchain lokal untuk memperlihatkan batch yang mendekati atau melewati batas 4 jam. Tidak tersedia di jaringan sungguhan.</p>
      <div className="row">
        <button type="button" className="btn secondary sm" disabled={proses} onClick={() => maju(15)}><Ikon n="clock" />+15 menit</button>
        <button type="button" className="btn secondary sm" disabled={proses} onClick={() => maju(60)}><Ikon n="clock" />+1 jam</button>
      </div>
      {toast}
    </section>
  );
}

export default function Profil({ tabs, lebar }) {
  const { profil, keluar, kontrak } = useSesi();
  const nav = useNavigate();
  return (
    <Halaman lebar={lebar}>
      <AppBar judul="Profil" eyebrow={profil.peran} />
      <div className="content sempit">
        <section className="card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="mark" style={{ width: 48, height: 48, borderRadius: 14 }}><Ikon n={profil.admin ? 'shield' : 'user'} /></div>
            <div><h2 style={{ fontSize: 18 }}>{profil.nama}</h2><p className="muted" style={{ margin: 0, fontSize: 14 }}>{profil.organisasi || 'Badan Gizi Nasional'}</p></div>
          </div>
          <dl className="kv">
            <dt>Peran</dt><dd>{profil.peran}</dd>
            <dt>Akun</dt><dd className="mono">{profil.akun}</dd>
            <dt>Jaringan</dt><dd>MBG-Chain {kontrak.jaringan} · chainId {kontrak.chainId}</dd>
            <dt>Kontrak</dt><dd className="mono">{kontrak.address}</dd>
          </dl>
        </section>
        <div className="note info"><Ikon n="info" /><span>Peran dibaca dari smart contract. Transaksi ditandatangani akun ini oleh jaringan berizin, jadi tidak ada pop-up dompet.</span></div>
        <SimulasiWaktu />
        <button type="button" className="btn danger block" onClick={() => { keluar(); nav('/masuk', { replace: true }); }}><Ikon n="logout" />Keluar</button>
      </div>
      <InfoJaringan />
      {tabs && <TabBar items={tabs} />}
    </Halaman>
  );
}
