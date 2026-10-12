// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  MBG-Chain
 * @notice Pelacakan batch Makan Bergizi Gratis (MBG) dari dapur SPPG sampai disajikan di sekolah.
 *
 *  Aturan utama yang ditegakkan kontrak:
 *  1. Jaringan berizin: hanya petugas yang didaftarkan admin (BGN) yang dapat mencatat.
 *  2. Setiap serah terima ditandatangani pihak PENERIMA: kurir saat mengambil, PIC sekolah saat menerima.
 *  3. Batas konsumsi 4 jam sejak selesai masak dihitung dengan waktu blok, bukan jam perangkat pengguna.
 *     Penyajian setelah batas ditolak oleh kontrak.
 *
 *  Alur status batch:
 *  Terdaftar -> SelesaiMasak -> DalamPerjalanan -> Diterima -> Disajikan | Ditolak
 */
contract MBGChain {
    // ------------------------------------------------------------------ Tipe data

    enum JenisOrganisasi { BelumTerdaftar, SPPG, MitraDistribusi, Sekolah, Puskesmas }
    enum StatusBatch { Terdaftar, SelesaiMasak, DalamPerjalanan, Diterima, Disajikan, Ditolak }
    enum Kelayakan { BelumDimasak, Aman, MendekatiBatas, Kedaluwarsa }
    enum AlasanTolak { TidakAda, LewatBatasWaktu, KondisiTidakLayak, Lainnya }

    struct Organisasi {
        JenisOrganisasi jenis;
        string nama;
    }

    struct Petugas {
        uint32 organisasiId;
        bool aktif;
        string nama;
    }

    /// Field disusun per titik pencatatan (siapa, kapan, berapa porsi) agar setiap
    /// slot penyimpanan 32 byte terisi penuh: satu batch hanya memakai 6 slot.
    struct Batch {
        address petugasDapur;   // slot 0: petugas SPPG yang mencatat selesai masak
        uint64 waktuMasak;      //         awal hitungan 4 jam
        uint32 porsi;           //         porsi yang dimasak untuk sekolah tujuan
        address kurir;          // slot 1: kurir yang mengambil batch
        uint64 waktuDiambil;
        uint32 dapurId;         //         organisasi SPPG pemilik batch
        address penerima;       // slot 2: PIC sekolah yang menerima batch
        uint64 waktuDiterima;
        uint32 porsiDiterima;
        address pencatat;       // slot 3: PIC yang mencatat penyajian / penolakan
        uint64 waktuSelesai;
        uint32 porsiSelesai;    //         porsi disajikan atau porsi ditolak
        uint64 waktuDaftar;     // slot 4
        uint32 sekolahId;       //         organisasi sekolah tujuan
        StatusBatch status;
        AlasanTolak alasanTolak;
        uint16 jumlahInsiden;
        string menu;            // slot 5
    }

    // ------------------------------------------------------------------ Konstanta & penyimpanan

    uint64 public constant BATAS_KONSUMSI = 4 hours;     // aturan BGN
    uint64 public constant AMBANG_PERINGATAN = 1 hours;  // peringatan dini 60 menit sebelum batas

    address public immutable admin;                      // akun BGN yang men-deploy kontrak
    uint32 public jumlahOrganisasi;
    uint256 public jumlahBatch;

    mapping(uint32 => Organisasi) public organisasi;
    mapping(address => Petugas) public petugas;
    mapping(uint256 => Batch) private _batch;

    // ------------------------------------------------------------------ Event = jejak audit yang bisa ditelusuri publik

    event OrganisasiDidaftarkan(uint32 indexed id, JenisOrganisasi jenis, string nama);
    event PetugasDidaftarkan(address indexed akun, uint32 indexed organisasiId, string nama);
    event PetugasDinonaktifkan(address indexed akun);
    event BatchDidaftarkan(uint256 indexed id, uint32 indexed dapurId, uint32 indexed sekolahId, uint32 porsi);
    event BatchSelesaiMasak(uint256 indexed id, address indexed petugas, uint64 batasKonsumsi);
    event BatchDiambil(uint256 indexed id, address indexed kurir);
    event BatchDiterima(uint256 indexed id, address indexed penerima, uint32 porsiDiterima);
    event BatchDisajikan(uint256 indexed id, address indexed pencatat, uint32 porsiDisajikan);
    event BatchDitolak(uint256 indexed id, address indexed pencatat, AlasanTolak alasan, uint32 porsiDitolak, string catatan);
    event InsidenDilaporkan(uint256 indexed id, address indexed pelapor, string keterangan);

    // ------------------------------------------------------------------ Error (custom error lebih hemat gas daripada teks)

    error BukanAdmin();
    error BukanPetugas();                    // akun bukan petugas aktif dengan peran yang dibutuhkan
    error BatchOrganisasiLain();             // batch milik dapur lain / untuk sekolah lain
    error OrganisasiTidakValid();
    error BatchTidakDitemukan();
    error StatusTidakSesuai(StatusBatch statusSaatIni);
    error PorsiTidakValid();
    error AlasanTidakValid();
    error BatasWaktuTerlewati(uint64 batasKonsumsi);
    error BelumKedaluwarsa(uint64 batasKonsumsi);

    modifier hanyaAdmin() {
        if (msg.sender != admin) revert BukanAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // ================================================================== Admin BGN: mengelola peserta jaringan

    function daftarkanOrganisasi(JenisOrganisasi jenis, string calldata nama) external hanyaAdmin returns (uint32 id) {
        if (jenis == JenisOrganisasi.BelumTerdaftar) revert OrganisasiTidakValid();
        id = ++jumlahOrganisasi;
        organisasi[id] = Organisasi(jenis, nama);
        emit OrganisasiDidaftarkan(id, jenis, nama);
    }

    /// Mendaftarkan (atau memperbarui) akun petugas pada sebuah organisasi.
    function daftarkanPetugas(address akun, uint32 organisasiId, string calldata nama) external hanyaAdmin {
        if (organisasiId == 0 || organisasiId > jumlahOrganisasi) revert OrganisasiTidakValid();
        petugas[akun] = Petugas(organisasiId, true, nama);
        emit PetugasDidaftarkan(akun, organisasiId, nama);
    }

    function nonaktifkanPetugas(address akun) external hanyaAdmin {
        petugas[akun].aktif = false;
        emit PetugasDinonaktifkan(akun);
    }

    // ================================================================== Petugas dapur SPPG (UC-01, UC-02)

    function daftarkanBatch(uint32 sekolahId, string calldata menu, uint32 porsi) external returns (uint256 id) {
        uint32 dapurId = _organisasiPemanggil(JenisOrganisasi.SPPG);
        if (organisasi[sekolahId].jenis != JenisOrganisasi.Sekolah) revert OrganisasiTidakValid();
        if (porsi == 0) revert PorsiTidakValid();

        id = ++jumlahBatch;
        Batch storage b = _batch[id];
        b.dapurId = dapurId;
        b.sekolahId = sekolahId;
        b.porsi = porsi;
        b.menu = menu;
        b.waktuDaftar = uint64(block.timestamp);   // status awal = Terdaftar
        emit BatchDidaftarkan(id, dapurId, sekolahId, porsi);
    }

    /// Hitungan 4 jam dimulai dari waktu blok transaksi ini.
    function catatSelesaiMasak(uint256 id) external {
        Batch storage b = _batchMilikPemanggil(id, JenisOrganisasi.SPPG, StatusBatch.Terdaftar);
        b.status = StatusBatch.SelesaiMasak;
        b.petugasDapur = msg.sender;
        b.waktuMasak = uint64(block.timestamp);
        emit BatchSelesaiMasak(id, msg.sender, b.waktuMasak + BATAS_KONSUMSI);
    }

    // ================================================================== Kurir (UC-03)

    /// Serah terima dapur -> kurir, ditandatangani kurir saat memindai QR batch.
    function ambilBatch(uint256 id) external {
        _organisasiPemanggil(JenisOrganisasi.MitraDistribusi);
        Batch storage b = _cariBatch(id);
        if (b.status != StatusBatch.SelesaiMasak) revert StatusTidakSesuai(b.status);
        b.status = StatusBatch.DalamPerjalanan;
        b.kurir = msg.sender;
        b.waktuDiambil = uint64(block.timestamp);
        emit BatchDiambil(id, msg.sender);
    }

    // ================================================================== PIC sekolah (UC-04, UC-06, UC-07)

    /// Serah terima kurir -> sekolah, ditandatangani PIC. Batch yang terlambat tetap bisa
    /// diterima supaya keterlambatannya tercatat sebagai bukti, lalu ditolak.
    function terimaBatch(uint256 id, uint32 porsiDiterima) external {
        Batch storage b = _batchMilikPemanggil(id, JenisOrganisasi.Sekolah, StatusBatch.DalamPerjalanan);
        if (porsiDiterima == 0 || porsiDiterima > b.porsi) revert PorsiTidakValid();
        b.status = StatusBatch.Diterima;
        b.penerima = msg.sender;
        b.waktuDiterima = uint64(block.timestamp);
        b.porsiDiterima = porsiDiterima;
        emit BatchDiterima(id, msg.sender, porsiDiterima);
    }

    function catatPenyajian(uint256 id, uint32 porsiDisajikan) external {
        Batch storage b = _batchMilikPemanggil(id, JenisOrganisasi.Sekolah, StatusBatch.Diterima);
        if (porsiDisajikan == 0 || porsiDisajikan > b.porsiDiterima) revert PorsiTidakValid();
        uint64 batas = b.waktuMasak + BATAS_KONSUMSI;
        if (block.timestamp > batas) revert BatasWaktuTerlewati(batas);   // aturan 4 jam (UC-05)
        _selesaikan(b, StatusBatch.Disajikan, porsiDisajikan);
        emit BatchDisajikan(id, msg.sender, porsiDisajikan);
    }

    /// Alasan "lewat batas waktu" hanya sah bila batch memang sudah kedaluwarsa menurut waktu blok.
    function tolakBatch(uint256 id, AlasanTolak alasan, uint32 porsiDitolak, string calldata catatan) external {
        Batch storage b = _batchMilikPemanggil(id, JenisOrganisasi.Sekolah, StatusBatch.Diterima);
        if (alasan == AlasanTolak.TidakAda) revert AlasanTidakValid();
        if (porsiDitolak == 0 || porsiDitolak > b.porsiDiterima) revert PorsiTidakValid();
        uint64 batas = b.waktuMasak + BATAS_KONSUMSI;
        if (alasan == AlasanTolak.LewatBatasWaktu && block.timestamp <= batas) revert BelumKedaluwarsa(batas);
        b.alasanTolak = alasan;
        _selesaikan(b, StatusBatch.Ditolak, porsiDitolak);
        emit BatchDitolak(id, msg.sender, alasan, porsiDitolak, catatan);
    }

    // ================================================================== PIC sekolah / petugas Puskesmas (UC-08)

    function laporkanInsiden(uint256 id, string calldata keterangan) external {
        Petugas storage p = petugas[msg.sender];
        JenisOrganisasi jenis = organisasi[p.organisasiId].jenis;
        if (!p.aktif || (jenis != JenisOrganisasi.Sekolah && jenis != JenisOrganisasi.Puskesmas)) revert BukanPetugas();
        Batch storage b = _cariBatch(id);
        if (jenis == JenisOrganisasi.Sekolah && p.organisasiId != b.sekolahId) revert BatchOrganisasiLain();
        if (b.status < StatusBatch.Diterima) revert StatusTidakSesuai(b.status);
        b.jumlahInsiden += 1;
        emit InsidenDilaporkan(id, msg.sender, keterangan);
    }

    // ================================================================== Baca data: gratis & terbuka (UC-05, UC-09, UC-10, UC-12)

    function lihatBatch(uint256 id) external view returns (Batch memory) {
        return _cariBatch(id);
    }

    /// Status kelayakan dihitung dari waktu blok terbaru: Aman -> MendekatiBatas (sisa <= 60 menit) -> Kedaluwarsa.
    function cekKelayakan(uint256 id) external view returns (Kelayakan status, uint64 batasKonsumsi, uint64 sisaDetik) {
        Batch storage b = _cariBatch(id);
        if (b.waktuMasak == 0) return (Kelayakan.BelumDimasak, 0, 0);
        batasKonsumsi = b.waktuMasak + BATAS_KONSUMSI;
        if (block.timestamp > batasKonsumsi) return (Kelayakan.Kedaluwarsa, batasKonsumsi, 0);
        sisaDetik = batasKonsumsi - uint64(block.timestamp);
        status = sisaDetik <= AMBANG_PERINGATAN ? Kelayakan.MendekatiBatas : Kelayakan.Aman;
    }

    /// Dipakai aplikasi saat masuk: menentukan peran & organisasi akun yang login.
    function profilPetugas(address akun)
        external
        view
        returns (string memory nama, bool aktif, uint32 organisasiId, JenisOrganisasi jenis, string memory namaOrganisasi)
    {
        Petugas storage p = petugas[akun];
        Organisasi storage o = organisasi[p.organisasiId];
        return (p.nama, p.aktif, p.organisasiId, o.jenis, o.nama);
    }

    // ================================================================== Internal

    function _organisasiPemanggil(JenisOrganisasi jenis) private view returns (uint32 organisasiId) {
        Petugas storage p = petugas[msg.sender];
        organisasiId = p.organisasiId;
        if (!p.aktif || organisasi[organisasiId].jenis != jenis) revert BukanPetugas();
    }

    function _cariBatch(uint256 id) private view returns (Batch storage b) {
        if (id == 0 || id > jumlahBatch) revert BatchTidakDitemukan();
        b = _batch[id];
    }

    /// Urutan validasi: peran pemanggil -> batch ada -> batch milik organisasinya -> status sesuai urutan.
    function _batchMilikPemanggil(uint256 id, JenisOrganisasi jenis, StatusBatch statusWajib)
        private
        view
        returns (Batch storage b)
    {
        uint32 organisasiId = _organisasiPemanggil(jenis);
        b = _cariBatch(id);
        uint32 pemilik = jenis == JenisOrganisasi.SPPG ? b.dapurId : b.sekolahId;
        if (organisasiId != pemilik) revert BatchOrganisasiLain();
        if (b.status != statusWajib) revert StatusTidakSesuai(b.status);
    }

    function _selesaikan(Batch storage b, StatusBatch statusAkhir, uint32 porsi) private {
        b.status = statusAkhir;
        b.pencatat = msg.sender;
        b.waktuSelesai = uint64(block.timestamp);
        b.porsiSelesai = porsi;
    }
}
