require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const { google } = require('googleapis');
const fs = require('fs');

// ============================================================
// VALIDASI ENVIRONMENT VARIABLES
// ============================================================
const requiredEnvVars = [
  'BOT_TOKEN',
  'GOOGLE_CREDENTIALS_PRIVATE_KEY',
  'SPREADSHEET_ID_HOTEL_NEO',
  'SPREADSHEET_ID_HOTEL_WHIZ',
  'SPREADSHEET_ID_HOTEL_GOLDEN',
  'SPREADSHEET_ID_WKB',
  'SPREADSHEET_ID_EMBASSY',
  'SPREADSHEET_ID_HOB',
  'SPREADSHEET_ID_KAROKE',
  'SPREADSHEET_ID_CENTRAL',
  'SPREADSHEET_ID_DRINK'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[ERROR] Environment variable ${envVar} is required`);
    process.exit(1);
  }
}

// ============================================================
// KONSTANTA
// ============================================================
const DATA_START_ROW = 10;
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS ? process.env.ALLOWED_USER_IDS.split(',').map(id => parseInt(id.trim())) : [];

// ============================================================
// CONFIG HOTEL (TINGGAL TAMBAH DI SINI 🔥)
// ============================================================
// Footer default — dipakai hotel yang tidak punya footer khusus
const DEFAULT_FOOTER = {
  bank: 'BCA',
  rekening: '1912147368',
  an: 'KAMAL',
  ttd: 'KAMAL',
};

const HOTEL_CONFIG = {
  // Format: spreadsheetId, footer (opsional — kalau kosong pakai DEFAULT_FOOTER)
  '🏨 Hotel Neo':    { id: process.env.SPREADSHEET_ID_HOTEL_NEO || '',
    footer: { bank: 'Mandiri', rekening: '1490017848898', an: 'KAMAL', ttd: 'KAMAL' },
   },
  '🏨 Hotel Whiz':   { id: process.env.SPREADSHEET_ID_HOTEL_WHIZ || '',
    footer: { bank: 'Mandiri', rekening: '1490017848898', an: 'KAMAL', ttd: 'KAMAL' },
   },
  '🏨 Hotel Golden': { id: process.env.SPREADSHEET_ID_HOTEL_GOLDEN || '' },
  '🏨 WKB':          { id: process.env.SPREADSHEET_ID_WKB || '' },
  '🏨 Embassy':      { id: process.env.SPREADSHEET_ID_EMBASSY || '' },
  '🏨 HOB':          { id: process.env.SPREADSHEET_ID_HOB || '' },
  '🏨 Karoke':       { id: process.env.SPREADSHEET_ID_KAROKE || '' },
  '🏨 Central':      { id: process.env.SPREADSHEET_ID_CENTRAL || '' },
  '🏨 Drink':        { id: process.env.SPREADSHEET_ID_DRINK || '' },

  // Contoh hotel dengan footer BERBEDA — tinggal uncomment & sesuaikan:
  // '🏨 Hotel Neo': {
  //   id: process.env.SPREADSHEET_ID_HOTEL_NEO || '',
  //   footer: { bank: 'Mandiri', rekening: '1234567890', an: 'BUDI', ttd: 'BUDI' },
  // },
};

// ============================================================
// Setup Google Sheets
// ============================================================
function getGoogleAuth() {
  const privateKey = process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('GOOGLE_CREDENTIALS_PRIVATE_KEY environment variable is required');
  }

  const credentials = {
    type: process.env.GOOGLE_CREDENTIALS_TYPE,
    project_id: process.env.GOOGLE_CREDENTIALS_PROJECT_ID,
    private_key_id: process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY_ID,
    private_key: privateKey.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CREDENTIALS_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CREDENTIALS_CLIENT_ID,
    auth_uri: process.env.GOOGLE_CREDENTIALS_AUTH_URI,
    token_uri: process.env.GOOGLE_CREDENTIALS_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_CREDENTIALS_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CREDENTIALS_CLIENT_X509_CERT_URL,
  };

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const auth = getGoogleAuth();
const sheets = google.sheets({ version: 'v4', auth });

// ============================================================
// MUTEX PER SPREADSHEET
// ============================================================
const spreadsheetLocks = new Map();

// ============================================================
// HELPER: Chunk array
// ============================================================
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================
// Inisialisasi Bot + Session Middleware
// ============================================================
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware untuk whitelist user
bot.use(async (ctx, next) => {
  if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(ctx.from.id)) {
    return ctx.reply('⛔ Kamu tidak memiliki akses.');
  }
  return next();
});

// Session berbasis file
bot.use(new LocalSession({ database: 'sessions.json' }).middleware());

// ============================================================
// HELPER: Reset session ke awal (pilih hotel)
// ============================================================
function resetSession(ctx) {
  ctx.session = {
    step: 'PILIH_HOTEL',
    hotel: null,
    tanggal: null,
    tipe: null,
    nomorPO: null,
  };
}

// ============================================================
// HELPER: Reset ke pilih tipe (tanggal dipertahankan)
// ============================================================
function resetKePilihTipe(ctx) {
  ctx.session.step = 'PILIH_TIPE';
  ctx.session.tipe = null;
  ctx.session.nomorPO = null;
}

// ============================================================
// HELPER: Format angka ke Rupiah
// ============================================================
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// ============================================================
// HELPER: Generate nama sheet berdasarkan bulan dari tanggal
// ============================================================
function getSheetName(tanggal) {
  const parts = tanggal.trim().split(' ');
  if (parts.length !== 3) throw new Error('Format tanggal tidak valid');

  const day = parseInt(parts[0], 10);
  const monthName = parts[1].toLowerCase();
  const year = parseInt(parts[2], 10);

  const monthMap = {
    januari: 0,
    februari: 1,
    maret: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    desember: 11,
  };

  if (!day || isNaN(day) || day < 1 || day > 31) {
    throw new Error('Format tanggal tidak valid');
  }
  if (!monthMap.hasOwnProperty(monthName)) {
    throw new Error('Format tanggal tidak valid');
  }
  if (!year || isNaN(year) || year < 2000) {
    throw new Error('Format tanggal tidak valid');
  }

  const date = new Date(year, monthMap[monthName], day);
  if (isNaN(date)) throw new Error('Format tanggal tidak valid');

  const bulan = date.toLocaleDateString('id-ID', { month: 'long' });
  const tahun = date.getFullYear();

  return `${bulan} ${tahun}`;
}

// ============================================================
// HELPER: Pastikan sheet bulan ada (duplikat dari TEMPLATE)
// ============================================================
async function ensurePOSheet(spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some(s => s.properties.title === sheetName);

  if (!exists) {
    const templateSheet = meta.data.sheets.find(s => s.properties.title === 'TEMPLATE');
    if (!templateSheet) {
      throw new Error('Sheet "TEMPLATE" tidak ditemukan di spreadsheet ini!');
    }

    const templateSheetId = templateSheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: templateSheetId,
              insertSheetIndex: meta.data.sheets.length,
              newSheetName: sheetName,
            },
          },
        ],
      },
    });
  }
}

// ============================================================
// HELPER: Cari baris kosong pertama di kolom A (mulai A10 ke bawah)
// ============================================================
async function findEmptyRowLeft(spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A${DATA_START_ROW}:A`,
  });

  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i][0] || rows[i][0].toString().trim() === '') {
      return DATA_START_ROW + i;
    }
  }

  return DATA_START_ROW + rows.length;
}

// ============================================================
// HELPER: Cari baris terakhir yang berisi data di kolom A
// (mulai A10 ke bawah) — digunakan oleh finalizeInvoice
// ============================================================
async function findLastDataRow(spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A${DATA_START_ROW}:A`,
  });

  const rows = res.data.values || [];
  let lastRow = DATA_START_ROW - 1; // default: belum ada data

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().trim() !== '') {
      lastRow = DATA_START_ROW + i;
    }
  }

  return lastRow;
}

// ============================================================
// HELPER: Simpan satu baris PO ke Google Sheets
// Kolom: A=Tanggal, B=Nomor PO, C=Jumlah
// (Hanya menyimpan data PO — total & footer diurus finalizeInvoice)
// ============================================================
async function savePO(spreadsheetId, sheetName, sheetId, tanggal, nomorPO, jumlah) {
  // Acquire lock
  if (spreadsheetLocks.has(spreadsheetId)) {
    throw new Error('Spreadsheet sedang digunakan oleh user lain. Coba lagi nanti.');
  }
  spreadsheetLocks.set(spreadsheetId, true);

  try {
    const nextRow = await findEmptyRowLeft(spreadsheetId, sheetName);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${nextRow}:C${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[tanggal, nomorPO, jumlah]],
      },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: DATA_START_ROW - 1,
                endRowIndex: DATA_START_ROW,
                startColumnIndex: 0,
                endColumnIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: nextRow - 1,
                endRowIndex: nextRow,
                startColumnIndex: 0,
                endColumnIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  backgroundColor: { red: 0.97, green: 0.97, blue: 0.97 },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment)',
            },
          },
        ],
      },
    });

    return { row: nextRow };
  } finally {
    // Release lock
    spreadsheetLocks.delete(spreadsheetId);
  }
}

// ============================================================
// FINALIZE INVOICE: Tulis Total + Footer + TTD ke sheet
// Dipanggil HANYA saat user menekan "✅ Selesai"
// ============================================================
async function finalizeInvoice(spreadsheetId, sheetName, sheetId, footer) {
  // Acquire lock
  if (spreadsheetLocks.has(spreadsheetId)) {
    throw new Error('Spreadsheet sedang digunakan oleh user lain. Coba lagi nanti.');
  }
  spreadsheetLocks.set(spreadsheetId, true);

  try {
    // 1. Cari baris terakhir yang ada datanya
    const lastDataRow = await findLastDataRow(spreadsheetId, sheetName);

    if (lastDataRow < DATA_START_ROW) {
      throw new Error('Tidak ada data PO yang tersimpan di sheet ini.');
    }

    // 2. Tentukan posisi total & footer
    const totalRow = lastDataRow + 2;
    const footerRow = totalRow + 2;

    // 3. Bersihkan area total & footer lama agar tidak duplikat
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A${totalRow}:C${footerRow + 4}`,
    });

    // 4. Tulis TOTAL DINAMIS
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!B${totalRow}:C${totalRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Jumlah', `=SUM(C${DATA_START_ROW}:C${lastDataRow})`]],
      },
    });

    // 5. Tulis FOOTER PAYMENT + TANDA TANGAN dalam kolom A-C
    //    Layout per baris:
    //    A             B              C
    //    PAYMENT       (kosong)       Hormat Kami
    //    Bank          BCA            (kosong)
    //    Rekening      1912147368     (kosong)
    //    A/N           KAMAL          KAMAL
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${footerRow}:C${footerRow + 3}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          ['PAYMENT', '', 'Hormat Kami'],
          ['Bank', footer.bank, ''],
          ['Rekening', footer.rekening, ''],
          ['A/N', footer.an, footer.ttd],
        ],
      },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Baris TOTAL: fill hitam + teks putih + bold + center
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: totalRow - 1,
                endRowIndex: totalRow,
                startColumnIndex: 0,
                endColumnIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0, green: 0, blue: 0 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // Baris PAYMENT (header footer): fill hitam + teks putih + bold + center
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: footerRow - 1,
                endRowIndex: footerRow,
                startColumnIndex: 0,
                endColumnIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0, green: 0, blue: 0 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // Baris detail footer (Bank, Rekening, A/N + KAMAL): bold + center
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: footerRow,
                endRowIndex: footerRow + 3,
                startColumnIndex: 0,
                endColumnIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
        ],
      },
    });

    return { totalRow, footerRow };
  } finally {
    // Release lock
    spreadsheetLocks.delete(spreadsheetId);
  }
}

// ============================================================
// HELPER: Tampilkan keyboard pilih hotel
// ============================================================
async function tanyaHotel(ctx) {
  const hotels = Object.keys(HOTEL_CONFIG);
  const rows = chunkArray(hotels, 4);
  await ctx.reply(
    `🏨 Pilih hotel untuk mencatat PO:`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard(rows).oneTime().resize(),
    }
  );
}

// ============================================================
// HELPER: Tampilkan keyboard setelah data tersimpan
// ============================================================
async function tanyaLanjut(ctx, ringkasan) {
  await ctx.reply(
    `✅ *Data berhasil disimpan!*\n\n${ringkasan}\n\nApa yang ingin dilakukan selanjutnya?`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['➕ Tambah Lagi', '📅 Ganti Tanggal'],
        ['🏨 Ubah Hotel', '✅ Selesai'],
      ]).oneTime().resize(),
    }
  );
}

// ============================================================
// HELPER: Tampilkan keyboard pilih tipe
// ============================================================
async function tanyaTipe(ctx) {
  await ctx.reply(
    `🏨 Hotel: *${ctx.session.hotel}*\n📅 Tanggal: *${ctx.session.tanggal}*\n\nPilih tipe PO:`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🟢 Regular', '🔴 Urgent'],
      ]).oneTime().resize(),
    }
  );
}

// ============================================================
// /start — mulai flow dari awal
// ============================================================
bot.start(async (ctx) => {
  resetSession(ctx);
  const nama = ctx.from.first_name || 'Pengguna';
  await ctx.reply(
    `👋 Halo, *${nama}*!\n\n` +
    `Saya akan membantu kamu mencatat data *Purchase Order* ke Google Sheets.\n\n` +
    `🏨 Pilih hotel terlebih dahulu:`,
    {
      parse_mode: 'Markdown',
      ...Markup.removeKeyboard(),
    }
  );
  return tanyaHotel(ctx);
});

// ============================================================
// /batal — reset ke awal kapan saja
// ============================================================
bot.command('batal', async (ctx) => {
  resetSession(ctx);
  await ctx.reply(
    '🔄 Sesi direset. Pilih hotel baru:',
    {
      parse_mode: 'Markdown',
      ...Markup.removeKeyboard(),
    }
  );
  return tanyaHotel(ctx);
});

// ============================================================
// HANDLER UTAMA: bot.on('text') — kontrol semua step
// ============================================================
bot.on('text', async (ctx) => {
  if (!ctx.session || !ctx.session.step) {
    resetSession(ctx);
  }

  const input = ctx.message.text.trim();

  if (input.startsWith('/')) return;

  // --------------------------------------------------------
  // TOMBOL NAVIGASI GLOBAL
  // --------------------------------------------------------
  if (input === '➕ Tambah Lagi') {
    resetKePilihTipe(ctx);
    return tanyaTipe(ctx);
  }

  if (input === '📅 Ganti Tanggal') {
    ctx.session.step = 'INPUT_TANGGAL';
    ctx.session.tanggal = null;
    ctx.session.tipe = null;
    ctx.session.nomorPO = null;
    return ctx.reply(
      '📅 Masukkan *tanggal* PO baru:',
      {
        parse_mode: 'Markdown',
        ...Markup.removeKeyboard(),
      }
    );
  }

  if (input === '🏨 Ubah Hotel') {
    resetSession(ctx);
    return tanyaHotel(ctx);
  }

  // --------------------------------------------------------
  // TOMBOL SELESAI → FINALIZE INVOICE
  // --------------------------------------------------------
  if (input === '✅ Selesai') {
    const { hotel, tanggal } = ctx.session;

    if (!hotel || !tanggal) {
      return ctx.reply(
        '⚠️ Belum ada data PO yang diinput. Pilih hotel dan masukkan data terlebih dahulu.',
        Markup.removeKeyboard()
      );
    }

    await ctx.reply('⏳ Sedang memfinalisasi invoice...', Markup.removeKeyboard());

    try {
      const spreadsheetId = HOTEL_CONFIG[hotel].id;
      const sheetName = getSheetName(tanggal);
      const footer = { ...DEFAULT_FOOTER, ...HOTEL_CONFIG[hotel].footer };

      // Get sheetId for finalizeInvoice
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" tidak ditemukan.`);
      }
      const sheetId = sheet.properties.sheetId;

      await finalizeInvoice(spreadsheetId, sheetName, sheetId, footer);

      await ctx.reply(
        `🎉 *Invoice bulan ${sheetName} siap dicetak!*\n\n` +
        `🏨 Hotel   : ${hotel}\n` +
        `📅 Bulan   : ${sheetName}\n\n` +
        `Total dan footer telah ditambahkan ke sheet.`,
        {
          parse_mode: 'Markdown',
          ...Markup.removeKeyboard(),
        }
      );

      // Reset session ke awal setelah finalize
      resetSession(ctx);
      return tanyaHotel(ctx);

    } catch (err) {
      console.error('Gagal finalize invoice:', err);
      return ctx.reply(
        '❌ Gagal memfinalisasi invoice. Silakan coba lagi atau gunakan /batal.'
      );
    }
  }

  const { step } = ctx.session;

  // --------------------------------------------------------
  // STEP 0: Pilih Hotel
  // --------------------------------------------------------
  if (step === 'PILIH_HOTEL') {
    if (!HOTEL_CONFIG[input] || !HOTEL_CONFIG[input].id) {
      const hotels = Object.keys(HOTEL_CONFIG).join(', ');
      const rows = chunkArray(Object.keys(HOTEL_CONFIG), 4);
      return ctx.reply(
        `❌ Hotel tidak valid. Pilih salah satu: ${hotels}`,
        Markup.keyboard(rows).oneTime().resize()
      );
    }

    ctx.session.hotel = input;
    ctx.session.step = 'INPUT_TANGGAL';
    return ctx.reply(
      `✅ Hotel: *${input}*\n\n📅 Masukkan *tanggal* PO:\n_Contoh: 27 Maret 2026_`,
      {
        parse_mode: 'Markdown',
        ...Markup.removeKeyboard(),
      }
    );
  }

  // --------------------------------------------------------
  // STEP 1: Input Tanggal
  // --------------------------------------------------------
  if (step === 'INPUT_TANGGAL') {
    if (!input) {
      return ctx.reply('❌ Tanggal tidak boleh kosong. Silakan masukkan tanggal PO:');
    }

    // Validasi format tanggal "DD MMMM YYYY" dalam bahasa Indonesia
    try {
      getSheetName(input); // Akan throw error jika format tidak valid
      ctx.session.tanggal = input;
      ctx.session.step = 'PILIH_TIPE';
      return tanyaTipe(ctx);
    } catch (err) {
      console.error('Validasi tanggal gagal:', err);
      return ctx.reply('❌ Format tanggal tidak valid. Gunakan format: "DD MMMM YYYY" (contoh: 27 Maret 2026)');
    }
  }

  // --------------------------------------------------------
  // STEP 2: Pilih Tipe (Regular / Urgent)
  // --------------------------------------------------------
  if (step === 'PILIH_TIPE') {
    if (input === '🟢 Regular') {
      ctx.session.tipe = 'Regular';
      ctx.session.step = 'INPUT_NOMOR_PO';
      return ctx.reply(
        '🔢 Masukkan *nomor PO* (angka saja):\n_Contoh: 001_',
        {
          parse_mode: 'Markdown',
          ...Markup.removeKeyboard(),
        }
      );
    }

    if (input === '🔴 Urgent') {
      ctx.session.tipe = 'Urgent';
      ctx.session.nomorPO = '-';
      ctx.session.step = 'INPUT_JUMLAH';
      return ctx.reply(
        '💰 Masukkan *jumlah* PO (angka saja):\n_Contoh: 1500000_',
        {
          parse_mode: 'Markdown',
          ...Markup.removeKeyboard(),
        }
      );
    }

    return ctx.reply(
      '⚠️ Pilih salah satu tipe PO:',
      Markup.keyboard([['🟢 Regular', '🔴 Urgent']]).oneTime().resize()
    );
  }

  // --------------------------------------------------------
  // STEP 3: Input Nomor PO (hanya untuk Regular)
  // --------------------------------------------------------
  if (step === 'INPUT_NOMOR_PO') {
    const angka = input.replace(/\D/g, '');
    if (!angka) {
      return ctx.reply('❌ Nomor PO harus berupa angka. Coba lagi:');
    }

    ctx.session.nomorPO = `PO-${angka}`;
    ctx.session.step = 'INPUT_JUMLAH';
    return ctx.reply(
      `✅ Nomor PO: *${ctx.session.nomorPO}*\n\n💰 Masukkan *jumlah* PO (angka saja):\n_Contoh: 1500000_`,
      {
        parse_mode: 'Markdown',
        ...Markup.removeKeyboard(),
      }
    );
  }

  // --------------------------------------------------------
  // STEP 4: Input Jumlah → Simpan ke Google Sheets
  // --------------------------------------------------------
  if (step === 'INPUT_JUMLAH') {
    const jumlahRaw = input.replace(/\./g, '').replace(/,/g, '');
    const jumlah = parseFloat(jumlahRaw);

    if (isNaN(jumlah) || jumlah <= 0) {
      return ctx.reply(
        '❌ Jumlah tidak valid. Masukkan angka saja:\n_Contoh: 1500000_',
        { parse_mode: 'Markdown' }
      );
    }

    const { hotel, tanggal, tipe, nomorPO } = ctx.session;

    try {
      const spreadsheetId = HOTEL_CONFIG[hotel].id;
      const sheetName = getSheetName(tanggal);

      await ensurePOSheet(spreadsheetId, sheetName);

      // Get sheetId for savePO
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" tidak ditemukan.`);
      }
      const sheetId = sheet.properties.sheetId;

      await savePO(spreadsheetId, sheetName, sheetId, tanggal, nomorPO, jumlah);

      const ringkasan =
        `🏨 Hotel     : ${hotel}\n` +
        `📅 Bulan     : ${sheetName}\n` +
        `📅 Tanggal   : ${tanggal}\n` +
        `🏷️ Tipe       : ${tipe}\n` +
        `📄 Nomor PO  : ${nomorPO}\n` +
        `💰 Jumlah     : ${formatRupiah(jumlah)}`;

      resetKePilihTipe(ctx);
      await tanyaLanjut(ctx, ringkasan);

    } catch (err) {
      console.error('Gagal menyimpan PO:', err);
      await ctx.reply('❌ Gagal menyimpan data. Silakan coba lagi dengan /batal.');
    }

    return;
  }
});

// ============================================================
// /help — informasi perintah
// ============================================================
bot.help(async (ctx) => {
  await ctx.reply(
    '📌 *Bantuan Bot PO*\n\n' +
    '/start — mulai ulang sesi\n' +
    '/batal — reset sesi dan pilih hotel baru\n' +
    '➕ Tambah Lagi — input data PO tambahan\n' +
    '📅 Ganti Tanggal — ubah tanggal saat ini\n' +
    '🏨 Ubah Hotel — pilih hotel lain\n' +
    '✅ Selesai — finalize invoice ke sheet',
    { parse_mode: 'Markdown' }
  );
});

// ============================================================
// Jalankan bot
// ============================================================
bot.launch();
console.log('✅ Bot Rekap PO is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));