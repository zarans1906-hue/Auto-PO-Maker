# 🤖 Auto PO Maker Bot

Automation bot for recording Purchase Orders (PO) directly into Google Sheets through Telegram integration.

Designed to simplify administrative workflows, reduce manual input, and improve operational efficiency.

---

## ✨ Features

- ✅ Telegram-based Purchase Order automation
- 📊 Automatic integration with Google Sheets
- 🔒 User whitelist system using Telegram User ID
- 💾 Persistent session management (`sessions.json`)
- ⚡ Mutex system to prevent spreadsheet race conditions
- 📅 Indonesian date format validation
- 🛡️ User-friendly error handling
- 📂 Automatic monthly sheet generation from template
- 🏨 Multi-hotel spreadsheet support
- 🚀 Fast and lightweight workflow automation

---

## 🛠️ Tech Stack

- Node.js
- Telegram Bot API
- Google Sheets API
- Google Service Account
- dotenv

---

## 📸 Preview

Add screenshots here:
- Telegram bot interaction
- Google Sheets result
- Workflow process
- Final invoice preview

---

# ⚙️ Installation

## 1️⃣ Clone Repository

```bash
git clone https://github.com/username/auto-po-maker-bot.git
cd auto-po-maker-bot
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

---

## 3️⃣ Configure Environment Variables

Copy `.env.example` to `.env`

```bash
cp .env.example .env
```

Fill all required values inside `.env`.

---

## 4️⃣ Setup Google Service Account

- Create a Service Account from Google Cloud Console
- Download the credentials JSON file
- Extract required values into environment variables
- Enable Google Sheets API access

---

## 5️⃣ Setup Google Sheets

- Create spreadsheets for each hotel
- Share spreadsheet access with the Service Account email
- Set Spreadsheet IDs inside environment variables

---

## ▶️ Run The Bot

```bash
npm start
```

---

# 📌 Environment Variables

See `.env.example` for the complete list of required environment variables.

---

# 📖 Usage

1. Start the bot using `/start`
2. Select hotel destination
3. Input transaction date  
   Example:
   ```text
   27 Maret 2026
   ```
4. Choose PO type:
   - Regular
   - Urgent
5. Input PO number (Regular) or amount directly (Urgent)
6. Input total PO amount
7. Finalize invoice or continue adding data

---

# 💬 Commands

| Command | Description |
|---|---|
| `/start` | Start new session |
| `/batal` | Reset current session |
| `/help` | Display help information |

---

# 🎯 Purpose

This project was built to automate Purchase Order recording workflows and simplify administrative processes through Telegram and Google Sheets integration.

---

# 🚀 Benefits

- Faster administrative process
- Reduces repetitive manual work
- Minimizes human input error
- Organized spreadsheet management
- Easy to scale for multiple operational units

---

# 👨‍💻 Author

Made with passion by JEK
