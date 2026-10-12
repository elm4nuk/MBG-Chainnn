"""Pemeriksaan tata letak responsif MBG-Chain di Chromium: setiap peran dan halaman publik dibuka pada lebar
375, 768, 1024, dan 1440 px. Diperiksa: tidak ada scroll horizontal, tepat satu navigasi utama yang terlihat,
dan tidak ada error di console browser. Navigasi: tepat satu menu di tablet/desktop, paling banyak satu di HP. Screenshot disimpan ke tools/shots/responsif/.

Dijalankan otomatis oleh `npm run test:e2e` setelah uji alur (chain pengujian tersendiri), atau manual:
  python tools/e2e_playwright.py URL && python tools/responsif_playwright.py URL
"""
import asyncio, json, pathlib, sys, time
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
OUT = pathlib.Path(__file__).parent / 'shots' / 'responsif'
OUT.mkdir(parents=True, exist_ok=True)
LEBAR = [375, 768, 1024, 1440]
TINGGI = {375: 812, 768: 1024, 1024: 900, 1440: 960}
HASIL = []

# (nama peran, ID petugas atau None untuk publik, [(nama halaman, hash route, teks yang ditunggu)])
SKENARIO = [
    ('publik', None, [
        ('masuk', '/masuk', 'Masuk petugas'),
        ('pantau', '/pantau', 'Status distribusi batch'),
        ('verifikasi', '/verifikasi/B-0005', 'Bukti di blockchain'),
        ('pindai_publik', '/verifikasi', 'Atau masukkan kode batch'),
    ]),
    ('sekolah', 'PIC-RI03-021', [
        ('beranda', '/sekolah', 'Pindai QR batch'),
        ('detail', '/sekolah/batch/B-0004', 'Riwayat batch'),
        ('riwayat', '/sekolah/riwayat', 'Riwayat batch'),
        ('lapor', '/sekolah/lapor', 'Keterangan kejadian'),
    ]),
    ('dapur', 'SPPG-CB-007', [
        ('beranda', '/dapur', 'Daftarkan batch baru'),
        ('detail', '/dapur/batch/B-0006', 'Riwayat batch'),
        ('baru', '/dapur/baru', 'Sekolah tujuan'),
    ]),
    ('kurir', 'KUR-MLC-012', [
        ('beranda', '/kurir', 'Siap diambil di dapur'),
        ('detail', '/kurir/batch/B-0007', 'Riwayat batch'),
    ]),
    ('puskesmas', 'PKM-CKG-002', [
        ('beranda', '/puskesmas', 'Batch dengan laporan insiden'),
        ('detail', '/puskesmas/batch/B-0002', 'Laporan insiden'),
    ]),
    ('admin', 'ADM-BGN-001', [
        ('organisasi', '/admin', 'Daftar organisasi'),
        ('petugas', '/admin/petugas', 'Daftar petugas'),
        ('pantau', '/admin/pantau', 'Status distribusi batch'),
        ('profil', '/admin/profil', 'Alat demo'),
    ]),
]


def catat(langkah, ok=True, ket=''):
    HASIL.append((langkah, ok, ket))
    print(('LULUS  ' if ok else 'GAGAL  ') + langkah + (f' — {ket}' if ket else ''), flush=True)


async def periksa(page, nama, galat):
    await page.wait_for_timeout(450)  # animasi masuk 220 ms selesai
    lebar = await page.evaluate('[document.documentElement.scrollWidth, window.innerWidth]')
    nav = await page.evaluate('''() => [...document.querySelectorAll('nav[aria-label="Menu utama"]')]
        .filter((n) => n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden').length''')
    await page.screenshot(path=str(OUT / f'{nama}.png'), full_page=True)
    return lebar, nav, list(galat)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        t0 = time.time()
        for peran, idp, halaman in SKENARIO:
            ctx = await browser.new_context(viewport={'width': 1440, 'height': 960})
            page = await ctx.new_page()
            galat = []
            page.on('pageerror', lambda e: galat.append(f'pageerror: {e}'))
            page.on('console', lambda m: m.type == 'error' and galat.append(f'console: {m.text}'))
            if idp:
                await page.goto(BASE + '/#/masuk')
                await page.fill('#pid', idp)
                await page.fill('#pw', 'mbgchain')
                await page.click('button[type=submit]')
                await page.wait_for_url(lambda u: '/masuk' not in u, timeout=15000)
            for nama, rute, tunggu in halaman:
                for w in LEBAR:
                    await page.set_viewport_size({'width': w, 'height': TINGGI[w]})
                    await page.goto(f'{BASE}/#{rute}')
                    try:
                        await page.get_by_text(tunggu).first.wait_for(timeout=15000)
                    except Exception as e:  # noqa: BLE001
                        catat(f'{peran}/{nama} @{w}px: halaman tampil', False, str(e).splitlines()[0][:160])
                        continue
                    galat.clear()
                    (doc, vw), nav, err = await periksa(page, f'{peran}_{nama}_{w}', galat)
                    pesan = f'lebar dokumen {doc}/{vw}px · navigasi terlihat {nav}'
                    # HP: halaman detail/publik memakai pola halaman penuh + tombol Kembali (0 menu), beranda memakai
                    # bottom navigation (1 menu). Tablet & desktop: sidebar selalu tampil (tepat 1 menu).
                    nav_ok = nama == 'masuk' or (nav == 1 if w >= 768 else nav <= 1)
                    ok = doc <= vw and nav_ok and not err
                    catat(f'{peran}/{nama} @{w}px', ok, pesan + (f' · {err[0][:120]}' if err else ''))
            await ctx.close()
        await browser.close()
    lulus = sum(1 for _, ok, _ in HASIL if ok)
    print(f'\n{lulus}/{len(HASIL)} pemeriksaan responsif lulus dalam {time.time() - t0:.0f} detik · screenshot: {OUT}')
    (OUT / 'hasil.json').write_text(json.dumps(HASIL, ensure_ascii=False, indent=1))
    if lulus != len(HASIL):
        raise SystemExit(1)

asyncio.run(main())
