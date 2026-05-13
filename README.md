# 📱 WhatsApp Chatbot — Baileys + Web UI

Chatbot WhatsApp berbasis **Baileys** dengan dashboard web real-time di port **3002**, dikemas dalam **Docker**.

---

## 🚀 Cara Menjalankan

### Prasyarat
- Docker & Docker Compose terinstall
- Akses internet

### Langkah

```bash
# 1. Clone / extract project ini
cd whatsapp-chatbot

# 2. Build & jalankan
docker compose up --build -d

# 3. Buka UI di browser
http://localhost:3002
```

### Tanpa Docker (dev lokal)
```bash
npm install
node src/index.js
```

---

## 📖 Cara Pakai

### 1. Hubungkan WhatsApp
- Buka `http://localhost:3002`
- QR Code akan muncul di panel kiri
- Scan dengan WhatsApp nomor **6285168779389**
- Status berubah jadi **"Terhubung"** ✅

### 2. Tambah Subject Matter
- Panel tengah → input nomor (format: `6281234567890`)
- Klik **"+ Tambah"**
- Nomor yang terdaftar akan muncul di daftar

### 3. Pesan Penolakan
- Pesan yang masuk dari nomor **tidak terdaftar** sebagai Subject Matter akan otomatis mendapat balasan penolakan
- Default: *"Mohon maaf, Anda bukan Subject Matter yang terdaftar..."*
- Bisa diubah di panel konfigurasi

### 4. Broadcast (Spam ke Subject Matter)
- Isi pesan di kolom "Broadcast"
- Klik **"Kirim Broadcast"**
- Pesan terkirim ke semua nomor Subject Matter terdaftar

### 5. Log Aktivitas
- Panel kanan menampilkan semua pesan masuk secara real-time
- 🟢 **ALLOWED** = Subject Matter
- 🔴 **BLOCKED** = Bukan Subject Matter (ditolak)
- 🟡 **BROADCAST** = Pesan dari bot

---

## 📁 Struktur Project

```
whatsapp-chatbot/
├── src/
│   ├── index.js     # Express + Socket.IO server
│   └── bot.js       # Baileys bot core
├── public/
│   └── index.html   # Web UI (dark dashboard)
├── data/
│   ├── auth/        # WhatsApp session (auto-generated)
│   └── config.json  # Konfigurasi & Subject Matter
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## ⚙️ Konfigurasi (`data/config.json`)

| Key | Default | Keterangan |
|-----|---------|------------|
| `subjectMatters` | `[]` | Daftar nomor Subject Matter |
| `rejectMessage` | Pesan penolakan | Balasan otomatis bukan SM |
| `welcomeMessage` | Pesan sambutan | Balasan otomatis untuk SM |
| `botActive` | `true` | Toggle bot on/off |

---

## 🔄 Manajemen Container

```bash
# Lihat log
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Reset sesi WhatsApp (harus scan QR lagi)
rm -rf data/auth
```

---

## 📌 Catatan
- Sesi WhatsApp tersimpan di `data/auth/` — jangan dihapus kecuali ingin logout
- Nomor bot: **6285168779389** (harus pakai nomor ini saat scan)
- Port: **3002** (bisa diubah di `docker-compose.yml`)
