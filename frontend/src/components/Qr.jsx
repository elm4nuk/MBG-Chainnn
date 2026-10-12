// Pindai QR dengan kamera (jsQR) + input kode manual, dan label QR batch untuk dicetak dapur.
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { Ikon } from './ui.jsx';
import { kodeDariTeks } from '../lib/format.js';

export function PemindaiQR({ onKode, petunjuk = 'Arahkan kamera ke QR pada wadah batch.', aksiBawah }) {
  const video = useRef(null);
  const kanvas = useRef(null);
  const cb = useRef(onKode);
  cb.current = onKode;
  const [kamera, setKamera] = useState('memulai'); // memulai | aktif | tidakAda | ditolak
  const [dikenali, setDikenali] = useState(null);
  const [manual, setManual] = useState('');
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let stream; let raf; let berhenti = false; let terakhir = 0;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setKamera('tidakAda'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (e) {
        setKamera(e?.name === 'NotAllowedError' ? 'ditolak' : 'tidakAda');
        return;
      }
      if (berhenti) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = video.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setKamera('aktif');
      const ctx = kanvas.current.getContext('2d', { willReadFrequently: true });
      const pindai = (t) => {
        if (berhenti) return;
        if (t - terakhir > 180 && v.readyState >= 2 && v.videoWidth) {
          terakhir = t;
          const w = 480; const h = Math.round((w * v.videoHeight) / v.videoWidth);
          kanvas.current.width = w; kanvas.current.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const hasil = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          const kode = hasil && kodeDariTeks(hasil.data);
          if (kode) {
            berhenti = true;
            setDikenali(kode);
            setTimeout(() => cb.current(kode), 650);
            return;
          }
        }
        raf = requestAnimationFrame(pindai);
      };
      raf = requestAnimationFrame(pindai);
    })();
    return () => { berhenti = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const kirimManual = (e) => {
    e.preventDefault();
    const kode = kodeDariTeks(manual);
    if (!kode) { setGalat('Format kode batch: B-0002'); return; }
    setGalat('');
    cb.current(kode);
  };

  return (
    <>
      <div className="camera">
        <video ref={video} muted playsInline aria-hidden="true" style={{ display: kamera === 'aktif' ? 'block' : 'none' }} />
        <canvas ref={kanvas} hidden />
        <div className="viewfinder" aria-hidden="true">
          <span className="c tlc" /><span className="c trc" /><span className="c blc" /><span className="c brc" />
          {kamera !== 'aktif' && <span className="ghost"><Ikon n="qr" /></span>}
        </div>
        <p className="cam-hint" role="status">
          {kamera === 'aktif' && petunjuk}
          {kamera === 'memulai' && 'Menyalakan kamera…'}
          {kamera === 'ditolak' && 'Izin kamera ditolak.'}
          {kamera === 'tidakAda' && 'Kamera tidak tersedia di perangkat ini.'}
          <span>{kamera === 'aktif' ? 'QR terbaca otomatis.' : 'Masukkan kode batch di bawah.'}</span>
        </p>
        {dikenali && <div className="toast-ok" role="status"><Ikon n="check" /><span>Batch {dikenali} dikenali</span></div>}
      </div>
      <div className="content">
        <form className="card form" onSubmit={kirimManual} noValidate>
          <label htmlFor="kode-manual">Atau masukkan kode batch</label>
          <div className="row">
            <input id="kode-manual" placeholder="B-0002" value={manual} autoCapitalize="characters" onChange={(e) => setManual(e.target.value)}
              aria-invalid={!!galat || undefined} aria-describedby={galat ? 'kode-galat' : undefined} />
            <button type="submit" className="btn primary" style={{ flex: 'none' }}>Buka</button>
          </div>
          {galat && <p className="err" id="kode-galat"><Ikon n="alert" /><span>{galat}</span></p>}
        </form>
        {aksiBawah}
      </div>
    </>
  );
}

export function LabelQR({ b }) {
  const [src, setSrc] = useState('');
  const url = `${window.location.origin}${window.location.pathname}#/verifikasi/${b.kode}`;
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 264, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(''));
  }, [url]);
  return (
    <div className="label-qr">
      {src ? <img src={src} alt={`QR batch ${b.kode}`} /> : <div style={{ width: 132, height: 132 }} />}
      <div>
        <div className="eyebrow muted" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em' }}>MBG-CHAIN · LABEL BATCH</div>
        <div className="kode">{b.kode}</div>
        <p><b>{b.porsi} porsi</b> untuk {b.sekolah}</p>
        <p>{b.menu}</p>
        <p className="muted">{b.dapur} · pindai untuk verifikasi</p>
      </div>
    </div>
  );
}
