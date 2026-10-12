// Utilitas proses untuk launcher demo (demo-start.js) dan runner uji browser (uji-e2e.js):
// cek port, tunggu RPC siap, jalankan script sampai selesai, dan hentikan HANYA proses yang dibuat sendiri.
import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

/** true bila ada proses yang menerima koneksi di port ini (IPv4 atau IPv6 localhost). */
export async function portDipakai(port) {
  const coba = (host) => new Promise((selesai) => {
    const s = net.connect({ host, port });
    const akhir = (hasil) => { s.destroy(); selesai(hasil); };
    s.setTimeout(600, () => akhir(false));
    s.once('connect', () => akhir(true));
    s.once('error', () => akhir(false));
  });
  return (await coba('127.0.0.1')) || (await coba('::1'));
}

/**
 * Panggil satu metode JSON-RPC. Melempar error bila node tidak menjawab.
 * Memakai http/https bawaan agar juga bisa lewat proxy /rpc aplikasi HTTPS lokal (sertifikat self-signed).
 */
export function panggilRpc(url, method, params = []) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const mod = url.startsWith('https:') ? https : http;
  return new Promise((selesai, gagal) => {
    const req = mod.request(url, {
      method: 'POST', rejectUnauthorized: false, timeout: 2000,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (res) => {
      let isi = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { isi += d; });
      res.on('end', () => {
        try {
          const j = JSON.parse(isi);
          if (j.error) gagal(new Error(j.error.message)); else selesai(j.result);
        } catch { gagal(new Error(`jawaban bukan JSON-RPC (HTTP ${res.statusCode})`)); }
      });
    });
    req.on('error', gagal);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}

/** Tunggu sampai node menjawab eth_chainId. `cekHidup()` menghentikan penantian bila proses chain sudah mati. */
export async function tungguRpc(url, { batasMs = 30000, cekHidup = () => true } = {}) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    if (!cekHidup()) throw new Error('proses blockchain berhenti sebelum siap');
    try { return Number(await panggilRpc(url, 'eth_chainId')); } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`RPC ${url} tidak menjawab dalam ${Math.round(batasMs / 1000)} detik`);
}

/** Tunggu sampai URL aplikasi menjawab HTTP (sertifikat self-signed diterima karena hanya localhost). */
export async function tungguHttp(url, { batasMs = 30000, cekHidup = () => true } = {}) {
  const mulai = Date.now();
  const coba = () => new Promise((selesai) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { rejectUnauthorized: false, timeout: 2000 }, (res) => { res.resume(); selesai(res.statusCode < 500); });
    req.on('error', () => selesai(false));
    req.on('timeout', () => { req.destroy(); selesai(false); });
  });
  while (Date.now() - mulai < batasMs) {
    if (!cekHidup()) throw new Error('proses aplikasi berhenti sebelum siap');
    if (await coba()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} tidak menjawab dalam ${Math.round(batasMs / 1000)} detik`);
}

/** Cetak output proses anak per baris dengan label, mis. "[chain] ...". */
function teruskan(aliran, label, tujuan, onBaris) {
  let sisa = '';
  aliran.setEncoding('utf8');
  aliran.on('data', (potong) => {
    const baris = (sisa + potong).split(/\r?\n/);
    sisa = baris.pop();
    for (const b of baris) { onBaris?.(b); tujuan.write(`${label} ${b}\n`); }
  });
  aliran.on('end', () => { if (sisa) { onBaris?.(sisa); tujuan.write(`${label} ${sisa}\n`); } });
}

/**
 * Pengelola proses anak. Semua proses yang dibuat lewat `latar()` dicatat dan dihentikan oleh `hentikanSemua()`;
 * proses lain di komputer (mis. chain yang sudah berjalan di terminal lain) tidak pernah disentuh.
 */
export function buatPengelola() {
  const anak = new Set();

  /** Jalankan perintah sampai selesai; resolve dengan kode keluar. */
  function jalankan(label, perintah, args, opsi = {}) {
    return new Promise((selesai, gagal) => {
      const p = spawn(perintah, args, { ...opsi, stdio: ['ignore', 'pipe', 'pipe'] });
      anak.add(p);
      teruskan(p.stdout, label, process.stdout);
      teruskan(p.stderr, label, process.stderr);
      p.once('error', (e) => { anak.delete(p); gagal(e); });
      p.once('exit', (kode, sinyal) => { anak.delete(p); selesai(kode ?? (sinyal ? 1 : 0)); });
    });
  }

  /** Jalankan proses yang tetap hidup (chain, server aplikasi). */
  function latar(label, perintah, args, opsi = {}, onBaris) {
    const p = spawn(perintah, args, { ...opsi, stdio: ['ignore', 'pipe', 'pipe'] });
    anak.add(p);
    p.hidup = true;
    teruskan(p.stdout, label, process.stdout, onBaris);
    teruskan(p.stderr, label, process.stderr, onBaris);
    p.once('exit', () => { p.hidup = false; anak.delete(p); });
    p.once('error', () => { p.hidup = false; anak.delete(p); });
    return p;
  }

  /** Hentikan proses milik pengelola ini: SIGTERM, lalu SIGKILL bila belum berhenti dalam 3 detik. */
  async function hentikanSemua() {
    const daftar = [...anak];
    await Promise.all(daftar.map((p) => new Promise((selesai) => {
      if (p.exitCode !== null || p.signalCode !== null) { selesai(); return; }
      const paksa = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* sudah berhenti */ } }, 3000);
      p.once('exit', () => { clearTimeout(paksa); selesai(); });
      try { p.kill('SIGTERM'); } catch { clearTimeout(paksa); selesai(); }
    })));
  }

  return { jalankan, latar, hentikanSemua };
}
