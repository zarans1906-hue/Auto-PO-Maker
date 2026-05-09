# Auto PO Maker Bot

Bot Telegram untuk mencatat Purchase Order (PO) ke Google Sheets secara otomatis.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Konfigurasi Environment Variables:**
   - Copy `.env.example` ke `.env`
   - Isi semua nilai yang diperlukan

3. **Setup Google Service Account:**
   - Buat Service Account di Google Cloud Console
   - Download credentials JSON
   - Extract nilai-nilai dari JSON ke environment variables

4. **Setup Google Sheets:**
   - Buat spreadsheet untuk setiap hotel
   - Pastikan Service Account memiliki akses edit ke spreadsheet
   - Set ID spreadsheet di environment variables

5. **Jalankan bot:**
   ```bash
   npm start
   ```

## Environment Variables

Lihat `.env.example` untuk daftar lengkap environment variables yang diperlukan.

## Fitur

- ✅ Whitelist user berdasarkan Telegram User ID
- ✅ Persistent session menggunakan file `sessions.json`
- ✅ Mutex per spreadsheet untuk mencegah race condition
- ✅ Validasi format tanggal Indonesia
- ✅ Error handling yang user-friendly
- ✅ Otomatis generate sheet bulan baru dari template

## Penggunaan

1. Start bot dengan `/start`
2. Pilih hotel
3. Masukkan tanggal (format: DD MMMM YYYY, contoh: 27 Maret 2026)
4. Pilih tipe PO (Regular/Urgent)
5. Masukkan nomor PO (untuk Regular) atau langsung jumlah (untuk Urgent)
6. Masukkan jumlah PO
7. Pilih aksi selanjutnya atau finalize invoice

## Commands

- `/start` - Mulai sesi baru
- `/batal` - Reset sesi
- `/help` - Bantuan