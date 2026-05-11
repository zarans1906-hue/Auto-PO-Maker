# 🤖 Auto PO Maker Bot
<img width="946" height="365" alt="Screenshot 2026-05-11 105921" src="https://github.com/user-attachments/assets/2591ead0-60aa-4c52-aefb-e4585f36066e" />
<img width="1919" height="987" alt="Screenshot 2026-05-11 105859" src="https://github.com/user-attachments/assets/5aa903b1-642a-456a-942f-769202361fcd" />

style=flat&logo=telegram&logoColor=white)
<img width="920" height="893" alt="Screenshot 2026-05-11 105844" src="https://github.com/user-attachments/assets/53a0f68b-fb47-4520-ae3d-988360e752d2" />

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/37e3319e-4964-404e-af00-12f53720f6a1" />


Automation bot for recording Purchase Orders (PO) directly into Google Sheets through Telegram — built to eliminate manual admin work and reduce human input error in operational workflows.

---

## ✨ Features

- ✅ Telegram-based Purchase Order automation
- 📊 Direct integration with Google Sheets
- 🏨 Multi-hotel spreadsheet support
- 📂 Automatic monthly sheet generation from template
- 🔒 User whitelist system via Telegram User ID
- 💾 Persistent session management (`sessions.json`)
- ⚡ Mutex system to prevent spreadsheet race conditions
- 📅 Indonesian date format validation
- 🛡️ User-friendly error handling

---

## 📸 Preview

> _Add screenshots below_

| Telegram Interaction | Google Sheets Result |
|---|---|
| _(screenshot)_ | _(screenshot)_ |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Telegram Bot API | Bot interface |
| Google Sheets API | Data storage & management |
| Google Service Account | Secure Sheets authentication |
| dotenv | Environment config |

---

## ⚙️ Installation

### 1. Clone Repository

```bash
git clone https://github.com/JEK642/Auto-PO-Maker.git
cd Auto-PO-Maker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Fill all required values inside `.env`. See `.env.example` for the complete reference.

### 4. Setup Google Service Account

- Create a Service Account from [Google Cloud Console](https://console.cloud.google.com/)
- Download the credentials JSON file
- Extract required values into environment variables
- Enable **Google Sheets API** access

### 5. Setup Google Sheets

- Create spreadsheets for each hotel
- Share spreadsheet access with the Service Account email
- Set Spreadsheet IDs inside environment variables

### 6. Run The Bot

```bash
npm start
```

---

## 📖 Usage

1. Start the bot with `/start`
2. Select hotel destination
3. Input transaction date (Indonesian format):
   ```
   27 Maret 2026
   ```
4. Choose PO type: **Regular** or **Urgent**
5. Input PO number (Regular) or amount directly (Urgent)
6. Input total PO amount
7. Finalize or continue adding data

---

## 💬 Commands

| Command | Description |
|---|---|
| `/start` | Start new session |
| `/batal` | Reset current session |
| `/help` | Display help information |

---

## 📌 Notes

- All credentials are loaded securely via `.env` — never hardcoded
- Mutex system ensures data integrity when multiple users submit simultaneously
- Monthly sheets are auto-generated so no manual sheet setup is needed

---

## 👨‍💻 Author

Made with passion by **JEK** — [github.com/JEK642](https://github.com/JEK642)
