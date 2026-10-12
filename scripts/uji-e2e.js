// Uji end-to-end di browser (tools/e2e_playwright.py) terhadap chain PENGUJIAN tersendiri,
// sehingga chain dan data demo yang sedang dipakai presentasi tidak berubah.
//
//   npm run test:e2e
//
// Urutan: chain uji (port 8546) → deploy → seed → build aplikasi → vite preview (port 4174) → Playwright.
// File deployment lokal yang ditimpa deploy/seed uji dicadangkan dulu dan dikembalikan di akhir,
// termasuk saat gagal atau dihentikan dengan Ctrl+C. Hanya proses buatan runner ini yang dihentikan.
//
// Prasyarat Python: pip install playwright && playwright install chromium
// Pakai interpreter lain dengan PYTHON=/path/ke/python npm run test:e2e
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ROOT } from './util.js';
import { buatPengelola, portDipakai, tungguHttp, tungguRpc } from './proses.js';

const PORT_CHAIN = Number(process.env.E2E_CHAIN_PORT || 8546);
const PORT_APP = Number(process.env.E2E_APP_PORT || 4174);
const RPC = `http://127.0.0.1:${PORT_CHAIN}`;
const APP = `http://127.0.0.1:${PORT_APP}`;
const PYTHON = process.env.PYTHON || 'python3';
const DICADANGKAN = ['deployments/lokal.json', 'deployments/akun-demo.json', 'frontend/public/kontrak.json', 'frontend/public/akun-demo.json'];

const pengelola = buatPengelola();
const cadangan = new Map();
let selesaiDipanggil = false;

function cadangkan() {
  for (const rel of DICADANGKAN) {
    const file = path.join(ROOT, rel);
    cadangan.set(rel, fs.existsSync(file) ? fs.readFileSync(file) : null);
  }
}

function pulihkan() {
  for (const [rel, isi] of cadangan) {
    const file = path.join(ROOT, rel);
    if (isi === null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, isi);
  }
  if (cadangan.size) console.log('File deployment demo dikembalikan seperti sebelum pengujian.');
}

async function selesai(kode) {
  if (selesaiDipanggil) return;
  selesaiDipanggil = true;
  await pengelola.hentikanSemua();
  pulihkan();
  process.exit(kode);
}
process.on('SIGINT', () => selesai(130));
process.on('SIGTERM', () => selesai(143));

async function main() {
  const py = spawnSync(PYTHON, ['-c', 'import playwright'], { stdio: 'ignore' });
  if (py.error || py.status !== 0) {
    console.error(`Playwright untuk Python belum tersedia di "${PYTHON}".`);
    console.error('Pasang: pip install playwright && playwright install chromium (atau set PYTHON=/path/ke/python).');
    process.exit(1);
  }
  for (const port of [PORT_CHAIN, PORT_APP]) {
    if (await portDipakai(port)) {
      console.error(`Port ${port} sudah dipakai. Runner tidak menghentikan proses lain; pilih port lain dengan E2E_CHAIN_PORT / E2E_APP_PORT.`);
      process.exit(1);
    }
  }

  cadangkan();
  const env = { ...process.env, RPC_URL: RPC, PRIVATE_KEY: '', MBG_HTTPS: '', FORCE_COLOR: '0' };
  const node = (label, script) => pengelola.jalankan(label, process.execPath, [path.join(ROOT, 'scripts', script)], { cwd: ROOT, env });

  console.log(`▶ Chain pengujian di port ${PORT_CHAIN}`);
  const chain = pengelola.latar('[chain-uji]', process.execPath, [path.join(ROOT, 'scripts', 'chain.js')], { cwd: ROOT, env: { ...env, PORT: String(PORT_CHAIN) } });
  await tungguRpc(RPC, { batasMs: 30000, cekHidup: () => chain.hidup });

  for (const [label, script] of [['[compile]', 'compile.js'], ['[deploy]', 'deploy.js'], ['[seed]', 'seed.js']]) {
    if (await node(label, script) !== 0) throw new Error(`${script} gagal`);
  }

  const viteBin = path.join(path.dirname(createRequire(path.join(ROOT, 'frontend', 'package.json')).resolve('vite/package.json')), 'bin', 'vite.js');
  const frontend = { cwd: path.join(ROOT, 'frontend'), env };
  console.log('▶ Build aplikasi');
  if (await pengelola.jalankan('[build]', process.execPath, [viteBin, 'build', '--logLevel', 'warn'], frontend) !== 0) throw new Error('build aplikasi gagal');

  console.log(`▶ Aplikasi hasil build di ${APP}`);
  const preview = pengelola.latar('[preview]', process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT_APP), '--strictPort'], frontend);
  await tungguHttp(`${APP}/`, { batasMs: 30000, cekHidup: () => preview.hidup });

  console.log('▶ Playwright (Chromium)');
  const kode = await pengelola.jalankan('[e2e]', PYTHON, ['-u', path.join(ROOT, 'tools', 'e2e_playwright.py'), APP], { cwd: ROOT, env: { ...env, MBG_RPC: RPC, PYTHONUNBUFFERED: '1' } });
  console.log(kode === 0 ? '\n✔ Uji browser lulus. Screenshot: tools/shots/' : `\n✖ Uji browser gagal (kode ${kode}). Lihat langkah GAGAL di atas.`);
  return kode;
}

main().then((kode) => selesai(kode ?? 1)).catch((e) => {
  console.error(`\n✖ ${e.message}`);
  selesai(1);
});
